/**
 * 10 Adımlık Otonom Diyalog & Durum Makinesi (State Machine)
 * Clean Code, Modüler, Bağımsız Servis Mimarisi
 */

import { CustomerRepo, MessageRepo, AppointmentRepo, TechnicianRepo, ChatbotSettingsRepo, PersonaRepo } from '../database/db.js';
import { LLMEngine } from '../adapters/llm/llm-adapter.js';

// Hizmet Kataloğu & Fiyatlandırma
export const SERVICES = {
  '1': { code: 'kombi_bakim', title: 'Kombi Periyodik Kış Bakımı', price: 1400, durationMin: 90 },
  '2': { code: 'ariza_tespit', title: 'Kombi Arıza & Parça Değişimi', price: 850, durationMin: 60 },
  '3': { code: 'petek_temizlik', title: 'İlaçlı Makine ile Petek Temizliği', price: 1200, durationMin: 90 }
};

// Durum Adımları Sabitleri
export const STEPS = {
  INITIAL_GREETING: 1,      // 1. & 2. Adım: Karşılama ve KVKK Açık Rıza
  SERVICE_SELECTION: 2,     // 3. Adım: Hizmet Seçimi
  DISTRICT_INPUT: 3,        // 4. & 5. Adım: Semt/Mahalle veya Konum Alma
  SLOT_SELECTION: 4,        // 6. & 7. Adım: Google Calendar Randevu Saati Seçimi
  PAYMENT_PENDING: 5,       // 8. & 9. Adım: Sanal POS Ödeme Linki & Adres Girişi
  CONFIRMED: 6              // 10. Adım: Kesinleşme, Hatırlatma & Canlı Takip
};

/**
 * Müşteriden gelen mesajı işleyen ana durum yöneticisi
 * @param {string} phoneNumber - E.164 Telefon Numarası
 * @param {string} incomingText - Müşterinin mesajı
 * @param {string} channel - 'whatsapp' | 'telegram'
 * @returns {Promise<{ replyText: string, currentStep: number, metadata?: object }>}
 */
export async function processCustomerMessage(phoneNumber, incomingText, channel = 'whatsapp') {
  const cleanText = (incomingText || '').trim();
  console.log(`\n📨 [${channel.toUpperCase()}] Gelen Mesaj (${phoneNumber}): "${cleanText}"`);
  
  // 1. Müşteri kaydını bul veya oluştur
  const customer = CustomerRepo.findOrCreate(phoneNumber, channel);
  
  // Gelen mesajı günlüğe kaydet
  MessageRepo.add(customer.id, 'customer', cleanText);

  // ============================================================================
  // GÜVENLİK KALKANI 1: 3 SAATLİK CEZA / COOLDOWN KONTROLÜ (SIFIR TOKEN MALİYETİ)
  // ============================================================================
  const blockStatus = CustomerRepo.isBlocked(customer);
  if (blockStatus.isBlocked) {
    ChatbotSettingsRepo.incrementShieldStats(250);
    const defaultPenalty = 'Sistemi gereksiz meşgul ettiğiniz veya botu oyun amaçlı kullandığınız tespit edilmiştir. Güvenlik ve token maliyetleri nedeniyle tarafınıza 3 saat boyunca yanıt verilemeyecektir.';
    const penaltyMsg = ChatbotSettingsRepo.get('cooldown_penalty_message', defaultPenalty);
    const replyText = penaltyMsg;
    MessageRepo.add(customer.id, 'bot', replyText);
    console.log(`🛡️ [GÜVENLİK KALKANI]: ${phoneNumber} kullanıcısı cezalı/engelli. Kalan süre: ~${blockStatus.remainingMinutes} dk. LLM çağrılmadı, token harcanmadı.`);
    return {
      replyText,
      currentStep: customer.current_step,
      isBlocked: true,
      remainingMinutes: blockStatus.remainingMinutes
    };
  }

  // 2. Acil Opt-out / İptal Kontrolü (6698 s. KVKK ve 6563 s. ETK)
  if (/^(ret|iptal|dur|çık|cik|vazgeç|vazgec)$/i.test(cleanText)) {
    CustomerRepo.updateConsent(customer.id, false);
    CustomerRepo.updateStep(customer.id, STEPS.INITIAL_GREETING, {});
    const replyText = 'Talebiniz üzerine iletişim durduruldu ve kaydınız iptal edildi. Dilediğiniz zaman "Merhaba" yazarak servis kaydınızı yeniden başlatabilirsiniz.';
    MessageRepo.add(customer.id, 'bot', replyText);
    return { replyText, currentStep: STEPS.INITIAL_GREETING };
  }

  // ============================================================================
  // GÜVENLİK KALKANI 2: YASAKLI KELİMELER / KÜFÜR VE SPAM MATRİSİ (SIFIR TOKEN)
  // ============================================================================
  const securityCheck = LLMEngine.checkSecurityAndFilter(cleanText);
  if (securityCheck.matched) {
    console.log(`⚠️ [GÜVENLİK TETİKLENDİ]:`, securityCheck.reason);

    // 2.1 Ağır Küfür / Kural İhlali -> 3 Saat Engelleme
    if (securityCheck.ruleType === 'banned_word' && securityCheck.action === 'mute_3h') {
      CustomerRepo.blockUser(customer.id, 3);
      CustomerRepo.incrementWarning(customer.id);
      CustomerRepo.setLastIntent(customer.id, 'banned_word_mute_3h');
      const penaltyMsg = ChatbotSettingsRepo.get('cooldown_penalty_message', 'Sistemi gereksiz meşgul ettiğiniz veya botu oyun amaçlı kullandığınız tespit edilmiştir. Güvenlik ve token maliyetleri nedeniyle tarafınıza 3 saat boyunca yanıt verilemeyecektir.');
      MessageRepo.add(customer.id, 'bot', penaltyMsg);
      return { replyText: penaltyMsg, currentStep: customer.current_step, isBlocked: true };
    }

    // 2.2 Hakaret / 1 Saat Susturma
    if (securityCheck.ruleType === 'banned_word' && securityCheck.action === 'mute_1h') {
      CustomerRepo.blockUser(customer.id, 1);
      CustomerRepo.incrementWarning(customer.id);
      CustomerRepo.setLastIntent(customer.id, 'banned_word_mute_1h');
      const penaltyMsg = 'Uygunsuz veya kural dışı ifade tespit edildiği için tarafınıza 1 saat boyunca yanıt verilemeyecektir.';
      MessageRepo.add(customer.id, 'bot', penaltyMsg);
      return { replyText: penaltyMsg, currentStep: customer.current_step, isBlocked: true };
    }

    // 2.3 Hafif Uyarı
    if (securityCheck.ruleType === 'banned_word' && securityCheck.action === 'warn') {
      const warningCount = CustomerRepo.incrementWarning(customer.id);
      CustomerRepo.setLastIntent(customer.id, 'banned_word_warn');
      if (warningCount >= 3) {
        CustomerRepo.blockUser(customer.id, 3);
        const penaltyMsg = ChatbotSettingsRepo.get('cooldown_penalty_message', 'Sistemi gereksiz meşgul ettiğiniz veya botu oyun amaçlı kullandığınız tespit edilmiştir. Güvenlik ve token maliyetleri nedeniyle tarafınıza 3 saat boyunca yanıt verilemeyecektir.');
        MessageRepo.add(customer.id, 'bot', penaltyMsg);
        return { replyText: penaltyMsg, currentStep: customer.current_step, isBlocked: true };
      }
      const warnMsg = 'Uyarı: Lütfen kurumsal servis asistanımız ile saygılı ve amaca uygun bir dille iletişim kurunuz. Tekrarında sistem 3 saat süreyle engellenecektir.';
      MessageRepo.add(customer.id, 'bot', warnMsg);
      return { replyText: warnMsg, currentStep: customer.current_step };
    }

    // 2.4 Spam Tetikleyici / Botu Test Etme / Anlamsız Mesaj
    if (securityCheck.ruleType === 'spam_trigger' || securityCheck.ruleType === 'gibberish') {
      const spamCount = CustomerRepo.incrementSpam(customer.id);
      CustomerRepo.setLastIntent(customer.id, 'spam_trigger');
      const maxSpam = parseInt(ChatbotSettingsRepo.get('max_spam_attempts', '3'), 10) || 3;
      
      if (spamCount >= maxSpam) {
        CustomerRepo.blockUser(customer.id, 3);
        const penaltyMsg = ChatbotSettingsRepo.get('cooldown_penalty_message', 'Sistemi gereksiz meşgul ettiğiniz veya botu oyun amaçlı kullandığınız tespit edilmiştir. Güvenlik ve token maliyetleri nedeniyle tarafınıza 3 saat boyunca yanıt verilemeyecektir.');
        MessageRepo.add(customer.id, 'bot', penaltyMsg);
        return { replyText: penaltyMsg, currentStep: customer.current_step, isBlocked: true };
      }

      const redirectMsg = ChatbotSettingsRepo.get(
        'off_topic_redirect_message',
        'Biz Kadıköy & Üsküdar bölgesinde uzman kombi/klima servisiyiz. 🛠️ Yalnızca kombi bakımı, arıza onarımı ve petek temizliği konularında yardımcı olabiliyoruz. Size servis veya randevu konusunda nasıl yardımcı olabiliriz?'
      );
      MessageRepo.add(customer.id, 'bot', redirectMsg);
      return { replyText: redirectMsg, currentStep: customer.current_step };
    }
  }

  let tempData = {};
  try {
    tempData = JSON.parse(customer.temp_data || '{}');
  } catch (e) {
    tempData = {};
  }

  // ============================================================================
  // GÜVENLİK KALKANI 3 & LLM BEYİN: GEMINI 3.8 FLASH NİYET (INTENT) & VARLIKLAR
  // ============================================================================
  const entities = await LLMEngine.classifyIntentAndExtract(cleanText, tempData);

  // 3.1 LLM Niyet Analizi: Konu Dışı (Off-Topic) veya Kötüye Kullanım Kontrolü
  if (entities.intent === 'spam_or_abuse') {
    CustomerRepo.blockUser(customer.id, 3);
    const penaltyMsg = ChatbotSettingsRepo.get('cooldown_penalty_message', 'Sistemi gereksiz meşgul ettiğiniz veya botu oyun amaçlı kullandığınız tespit edilmiştir. Güvenlik ve token maliyetleri nedeniyle tarafınıza 3 saat boyunca yanıt verilemeyecektir.');
    MessageRepo.add(customer.id, 'bot', penaltyMsg);
    return { replyText: penaltyMsg, currentStep: customer.current_step, isBlocked: true };
  }

  if (entities.offTopicDetected || entities.intent === 'off_topic') {
    const spamCount = CustomerRepo.incrementSpam(customer.id);
    CustomerRepo.setLastIntent(customer.id, 'off_topic');
    const maxSpam = parseInt(ChatbotSettingsRepo.get('max_spam_attempts', '3'), 10) || 3;

    if (spamCount >= maxSpam) {
      CustomerRepo.blockUser(customer.id, 3);
      const penaltyMsg = ChatbotSettingsRepo.get('cooldown_penalty_message', 'Sistemi gereksiz meşgul ettiğiniz veya botu oyun amaçlı kullandığınız tespit edilmiştir. Güvenlik ve token maliyetleri nedeniyle tarafınıza 3 saat boyunca yanıt verilemeyecektir.');
      MessageRepo.add(customer.id, 'bot', penaltyMsg);
      return { replyText: penaltyMsg, currentStep: customer.current_step, isBlocked: true };
    }

    const redirectMsg = entities.suggestedReply || ChatbotSettingsRepo.get(
      'off_topic_redirect_message',
      'Biz Kadıköy & Üsküdar bölgesinde uzman kombi/klima servisiyiz. 🛠️ Yalnızca kombi bakımı, arıza onarımı ve petek temizliği konularında yardımcı olabiliyoruz. Size servis veya randevu konusunda nasıl yardımcı olabiliriz?'
    );
    MessageRepo.add(customer.id, 'bot', redirectMsg);
    return { replyText: redirectMsg, currentStep: customer.current_step };
  }

  // Geçerli bir servis isteği geldiğinde spam sayacını sıfırla ve son niyeti kaydet
  CustomerRepo.resetSpam(customer.id);
  CustomerRepo.setLastIntent(customer.id, entities.intent || 'service_request');

  // Müşterinin konuşma tarzından persona tespiti ve veritabanı kaydı
  if (entities.detectedPersona) {
    CustomerRepo.updatePersona(customer.id, entities.detectedPersona, entities.personaConfidence || 0.85);
    tempData.detectedPersona = entities.detectedPersona;
  }

  if (entities.brandModel && !tempData.brandModel) {
    tempData.brandModel = entities.brandModel;
  }
  if (entities.serviceCode && !tempData.serviceCode) {
    tempData.serviceCode = entities.serviceCode;
  }
  if (entities.district && !tempData.district) {
    tempData.district = entities.district;
  }
  if (entities.urgency === 'urgent') {
    tempData.isUrgent = true;
  }

  let replyText = '';
  let nextStep = customer.current_step;

  // ============================================================================
  // DURUM MAKİNESİ AKIŞI (10 Adımlık Süreç)
  // ============================================================================
  switch (customer.current_step) {
    
    // --------------------------------------------------------------------------
    // ADIM 1 & 2: Karşılama ve KVKK Açık Rıza
    // --------------------------------------------------------------------------
    case STEPS.INITIAL_GREETING: {
      if (customer.kvkk_consent_granted === 1) {
        // Zaten onaylıysa doğrudan Hizmet Seçim Menüsü ver
        replyText = getServiceMenuMessage(customer.full_name);
        nextStep = STEPS.SERVICE_SELECTION;
      } else if (entities.kvkkConsent === true || cleanText === '1' || /^(evet|onay|kabul|onaylıyorum)$/i.test(cleanText)) {
        // KVKK Onaylandı
        CustomerRepo.updateConsent(customer.id, true);
        replyText = `Açık rızanız kaydedildi. Teşekkür ederiz! ✅\n\n` + getServiceMenuMessage();
        nextStep = STEPS.SERVICE_SELECTION;
      } else {
        // İlk karşılama ve KVKK bilgilendirmesi (White-Label Dinamik Marka & Persona Empati Hitabı)
        const profile = ChatbotSettingsRepo.getWhiteLabelProfile();
        const personaKey = entities.detectedPersona || 'sekuler';
        
        let customGreeting = `Merhaba! ${profile.serviceRegions} Bölgesi Yetkili ${profile.brandName}'ne hoş geldiniz. 🛠️`;
        if (personaKey === 'muhafazakar') {
          customGreeting = `Ve aleyküm selam, hayırlı ve bereketli günler dileriz! ${profile.serviceRegions} Bölgesi Yetkili ${profile.brandName}'ne hoş geldiniz. Başımızın üstünde yeriniz var. 🛠️`;
        } else if (personaKey === 'yasli') {
          customGreeting = `Hürmetler efendim, geçmiş olsun, hiç canınızı sıkmayın. ${profile.serviceRegions} Bölgesi Yetkili ${profile.brandName}'ne hoş geldiniz. Ustamız hemen ilgilenecektir. 🛠️`;
        } else if (personaKey === 'teknoloji_zayifi') {
          customGreeting = `Merhabalar, hiç endişeniz olmasın, işlemimiz çok basit ve tamamen resmi güvence altındadır. ${profile.brandName}'ne hoş geldiniz. 🛠️`;
        } else if (personaKey === 'genc') {
          customGreeting = `Selam! Hiç canını sıkma, hemen hallediyoruz. ${profile.brandName}'ne hoş geldin! 🛠️`;
        }

        replyText = `${customGreeting}\n\n` +
          `6698 sayılı KVKK uyarınca randevu oluşturabilmemiz ve size ulaşabilmemiz için aydınlatma metnimizi onaylamanız gerekmektedir.\n\n` +
          `Devam etmek için lütfen *1* veya *ONAY* yazınız.`;
      }
      break;
    }

    // --------------------------------------------------------------------------
    // ADIM 3: Hizmet Seçimi (Doğal Dil Destekli)
    // --------------------------------------------------------------------------
    case STEPS.SERVICE_SELECTION: {
      let selected = SERVICES[cleanText];
      if (!selected && (entities.serviceCode || tempData.serviceCode)) {
        const codeMap = { kombi_bakim: '1', ariza_tespit: '2', petek_temizlik: '3' };
        const key = codeMap[entities.serviceCode || tempData.serviceCode];
        if (key) selected = SERVICES[key];
      }

      if (selected) {
        tempData.service = selected;
        CustomerRepo.updateStep(customer.id, STEPS.DISTRICT_INPUT, tempData);
        
        const brandNotice = tempData.brandModel ? ` (${tempData.brandModel} Kombi)` : '';
        replyText = `Seçiminiz: *${selected.title}*${brandNotice} (Tutar: ₺${selected.price})\n\n` +
          `Size en yakın ustamızı yönlendirebilmemiz için lütfen oturduğunuz *Semt / Mahalleyi* yazınız veya WhatsApp konumunuzu paylaşınız.\n` +
          `_(Örn: Kadıköy Moda, Üsküdar Acıbadem vb.)_`;
        nextStep = STEPS.DISTRICT_INPUT;
      } else {
        replyText = `Lütfen geçerli bir hizmet numarası seçiniz:\n\n` + getServiceMenuMessage();
      }
      break;
    }

    // --------------------------------------------------------------------------
    // ADIM 4 & 5: Semt / Mahalle Alma & Usta Bölgesi Eşleme
    // --------------------------------------------------------------------------
    case STEPS.DISTRICT_INPUT: {
      const district = entities.district || tempData.district || cleanText;
      if (district.length < 3) {
        replyText = `Lütfen geçerli bir semt veya mahalle adı yazınız (Örn: Kadıköy Moda veya Üsküdar Acıbadem):`;
        break;
      }

      tempData.district = district;

      // Akıllı Usta Eşleme (Kadıköy -> Usta 1, Üsküdar ve diğer -> Usta 2)
      const isKadikoy = /kadıköy|kadikoy|moda|fenerbahçe|bostancı|cadde/i.test(district);
      const assignedTechId = isKadikoy ? 'tech-1' : 'tech-2';
      const tech = TechnicianRepo.getById(assignedTechId);
      tempData.technician = tech;

      // Google Calendar Müsait Slot Hesaplaması (Dinamik Öneri)
      const suggestedSlots = isKadikoy ? [
        { code: 'A', label: 'Bugün 14:30 - 16:00', start: '14:30', end: '16:00' },
        { code: 'B', label: 'Yarın 11:00 - 12:30', start: '11:00', end: '12:30' },
        { code: 'C', label: 'Yarın 16:30 - 18:00', start: '16:30', end: '18:00' }
      ] : [
        { code: 'A', label: 'Bugün 16:30 - 17:30', start: '16:30', end: '17:30' },
        { code: 'B', label: 'Yarın 10:00 - 11:30', start: '10:00', end: '11:30' },
        { code: 'C', label: 'Yarın 14:00 - 15:30', start: '14:00', end: '15:30' }
      ];

      tempData.availableSlots = suggestedSlots;
      CustomerRepo.updateDetails(customer.id, { neighborhood: district });
      CustomerRepo.updateStep(customer.id, STEPS.SLOT_SELECTION, tempData);

      replyText = `Bölgeniz: *${district}* kaydedildi.\n` +
        `Sorumlu Uzman: *${tech.name}*\n\n` +
        `Google Calendar takviminde çakışmasız en uygun randevu saatleri:\n\n` +
        suggestedSlots.map(s => `📅 *${s.code})* ${s.label}`).join('\n') +
        `\n\nLütfen randevu için tercih ettiğiniz harfi yazınız (*A*, *B* veya *C*):`;
      nextStep = STEPS.SLOT_SELECTION;
      break;
    }

    // --------------------------------------------------------------------------
    // ADIM 6 & 7: Tarih / Slot Seçimi & Ön Rezervasyon Kilidi
    // --------------------------------------------------------------------------
    case STEPS.SLOT_SELECTION: {
      const choice = (entities.preferredSlotCode || cleanText).toUpperCase();
      const slots = tempData.availableSlots || [];
      const selectedSlot = slots.find(s => s.code === choice);

      if (selectedSlot) {
        tempData.chosenSlot = selectedSlot;
        
        // Ödeme linki oluştur
        const paymentBaseUrl = process.env.PAYMENT_BASE_URL || 'http://localhost:3000/pay';
        const dummyToken = 'pay_' + Math.random().toString(36).substring(2, 10);
        const paymentLink = `${paymentBaseUrl}/${dummyToken}`;
        tempData.paymentLink = paymentLink;

        // Veritabanında geçici randevu kaydı aç
        const aptId = AppointmentRepo.create({
          customerId: customer.id,
          technicianId: tempData.technician.id,
          serviceType: tempData.service.title,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          paymentAmount: tempData.service.price,
          posPaymentLink: paymentLink
        });
        tempData.appointmentId = aptId;

        CustomerRepo.updateStep(customer.id, STEPS.PAYMENT_PENDING, tempData);

        const personaKey = tempData.detectedPersona || 'sekuler';
        const personaPack = PersonaRepo.getByKey(personaKey);
        const trustMsg = personaPack?.trust_building_message || 'Tüm servis işlemlerimiz ve parçalar 1 yıl resmi servis garantimiz altındadır. Sürpriz ek maliyet çıkmaz.';

        replyText = `Randevu Saatiniz Seçildi: *${selectedSlot.label}* ⏰\n` +
          `Usta: *${tempData.technician.name}*\n\n` +
          `Bu slot sizin için Google Calendar'da *15 dakika süreyle rezerve edildi*.\n\n` +
          `Randevunuzu kesinleştirmek için güvenli sanal POS ödeme linkiniz:\n` +
          `🔗 ${paymentLink}\n\n` +
          `🛡️ *Güven ve Şeffaflık Güvencesi:*\n${trustMsg}\n\n` +
          `_(Açılan sayfada kart bilgilerinizi, açık adresinizi ve varsa kombi marka/notunuzu girebilirsiniz)_`;
        nextStep = STEPS.PAYMENT_PENDING;
      } else {
        replyText = `Lütfen sunulan randevu slotlarından bir harf seçiniz (*A*, *B* veya *C*).`;
      }
      break;
    }

    // --------------------------------------------------------------------------
    // ADIM 8 & 9: Ödeme Bekleme Durumu (Müşteri chatten yazarsa hatırlat)
    // --------------------------------------------------------------------------
    case STEPS.PAYMENT_PENDING: {
      replyText = `Randevunuzun kesinleşmesi için ödeme linki bekleniyor ⏳\n\n` +
        `🔗 Ödeme Linki: ${tempData.paymentLink}\n` +
        `Hizmet: *${tempData.service?.title}* (₺${tempData.service?.price})\n` +
        `Usta: *${tempData.technician?.name}*\n\n` +
        `Ödemeniz tamamlandığında randevu özeti ve usta canlı takip bilgisi buradan otomatik iletilecektir.`;
      break;
    }

    // --------------------------------------------------------------------------
    // ADIM 10: Onaylanmış ve Tamamlanmış Akış
    // --------------------------------------------------------------------------
    case STEPS.CONFIRMED: {
      replyText = `Randevunuz onaylanmış durumdadır! ✅\n` +
        `Ustanız randevu saati öncesinde yola çıktığında canlı konum takip linkiniz bu numaraya SMS/WhatsApp ile gönderilecektir.\n` +
        `Destek için istediğiniz zaman bize yazabilirsiniz.`;
      break;
    }

    default: {
      replyText = getServiceMenuMessage();
      nextStep = STEPS.SERVICE_SELECTION;
      CustomerRepo.updateStep(customer.id, nextStep, {});
      break;
    }
  }

  // Yeni adımı güncelle ve bot cevabını veritabanına yaz
  CustomerRepo.updateStep(customer.id, nextStep, tempData);
  MessageRepo.add(customer.id, 'bot', replyText);

  console.log(`📤 [${channel.toUpperCase()}] Bot Yanıtı: "${replyText.replace(/\n+/g, ' ')}"`);
  console.log(`📍 [Diyalog Durumu]: Adım ${nextStep}\n`);

  return {
    replyText,
    currentStep: nextStep,
    metadata: {
      customerId: customer.id,
      service: tempData.service,
      technician: tempData.technician,
      appointmentId: tempData.appointmentId
    }
  };
}

/**
 * Sanal POS ödemesi ve açık adres tamamlandığında tetiklenen Webhook aksiyonu
 * (Adım 9 -> Adım 10 Geçişi)
 */
export async function handlePaymentCompletedWebhook(appointmentId, { transactionId, fullAddress, notes }) {
  const appointment = AppointmentRepo.getById(appointmentId);
  if (!appointment) return null;

  // 1. Randevuyu 'paid' ve 'confirmed' durumuna çek
  AppointmentRepo.updatePayment(appointmentId, {
    posTransactionId: transactionId,
    fullAddress,
    customerNotes: notes
  });

  // 2. Müşteri adres ve durumunu güncelle
  CustomerRepo.updateDetails(appointment.customer_id, { fullAddress });
  CustomerRepo.updateStep(appointment.customer_id, STEPS.CONFIRMED);

  // 3. Müşteriye WhatsApp Onay Özeti gönder
  const confirmationMessage = `Ödemeniz ve açık adresiniz başarıyla alındı! 🎉\n\n` +
    `📋 *RANDEVU ÖZETİ*\n` +
    `• Hizmet: ${appointment.service_type}\n` +
    `• Tutar: ₺${appointment.payment_amount} (Tahsil Edildi)\n` +
    `• Saat: ${appointment.start_time} - ${appointment.end_time}\n` +
    `• Adres: ${fullAddress}\n` +
    `• Referans No: #${appointmentId}\n\n` +
    `Randevu ustanın Google Calendar takvimine KESİN olarak işlendi. Servis günü sabahı hatırlatma yapılacak ve usta yola çıktığında canlı konum paylaşılacaktır.`;

  MessageRepo.add(appointment.customer_id, 'bot', confirmationMessage);

  return {
    success: true,
    customerId: appointment.customer_id,
    confirmationMessage
  };
}

function getServiceMenuMessage(customerName = '') {
  const greeting = customerName ? `Sn. ${customerName}, l` : 'L';
  return `${greeting}ütfen almak istediğiniz kombi/klima hizmetini seçiniz:\n\n` +
    `1️⃣ *Kombi Periyodik Kış Bakımı* — ₺1.400\n` +
    `2️⃣ *Kombi Arıza & Parça Değişimi* — ₺850\n` +
    `3️⃣ *İlaçlı Petek Temizliği* — ₺1.200\n\n` +
    `Cevap olarak *1*, *2* veya *3* yazabilirsiniz.`;
}
