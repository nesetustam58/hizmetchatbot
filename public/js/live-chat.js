/**
 * HizmetChatbot Live Chat & Customer Intelligence Engine
 */

const MockConversations = [
  {
    id: 'cust-1',
    name: 'Selin Demir',
    phone: '+90 532 987 6543',
    channel: 'whatsapp',
    district: 'Kadıköy / Moda Mah.',
    fullAddress: 'Caferağa Mah. Şair Nefi Sok. No:18 D:4 Kadıköy/İstanbul',
    serviceType: 'Kombi Periyodik Bakım',
    servicePrice: '₺1.400',
    paymentStatus: 'paid', // 'paid' | 'pending' | 'unpaid'
    paymentRef: 'iyzico_trx_88921',
    appointmentSlot: '31 Ekim Cumartesi 14:30 - 16:00',
    assignedTech: 'Usta 1: Mehmet Usta',
    googleCalendarEvent: 'GCAL_EVT_MODA_9921',
    kvkkConsent: 'approved',
    aiMemorySummary: 'Demirdöküm Nitromix kombi. Cihaz 4 yaşında. Müşteri geçen kış sıcak suyun dalgalı geldiğini belirtti. Evde kedi var, servis öncesi bilgi rica etti.',
    lastMessage: 'Ödemeyi tamamladım, yarın Mehmet Usta gelmeden arayabilir mi?',
    lastTime: '10:42',
    unreadCount: 0,
    messages: [
      { sender: 'customer', text: 'Merhaba kolay gelsin, kombime kışlık bakım yaptırmak istiyorum.', time: '10:15' },
      { sender: 'bot', text: 'Merhaba Selin Hanım! Kadıköy & Üsküdar Bölgesi Kombi Hizmet Servisi\'ne hoş geldiniz. Devam etmeden önce KVKK aydınlatma metnimizi ve randevu koşullarımızı onaylıyor musunuz?', time: '10:15' },
      { sender: 'customer', text: '1 - Evet onaylıyorum', time: '10:16' },
      { sender: 'bot', text: 'Harika! Hangi hizmetimizle ilgileniyorsunuz?\n\n1️⃣ Kombi Periyodik Kış Bakımı (₺1.400)\n2️⃣ Kombi Arıza & Parça Değişimi\n3️⃣ İlaçlı Petek Temizliği (₺1.200)', time: '10:16' },
      { sender: 'customer', text: '1 numara kombi bakımı lütfen.', time: '10:18' },
      { sender: 'bot', text: 'Hizmetiniz kaydedildi: Kombi Periyodik Bakım (₺1.400). Lütfen bulunduğunuz semt/mahalleyi yazın veya WhatsApp konumunuzu paylaşın.', time: '10:18' },
      { sender: 'customer', text: 'Kadıköy Moda Caferağa', time: '10:20' },
      { sender: 'bot', text: 'Moda bölgesinde çalışan Usta 1 (Mehmet Usta) takvimini kontrol ettim. Sizin için en uygun randevu saatleri:\n\n📅 A) Bugün 14:30 - 16:00\n📅 B) Yarın 11:00 - 12:30\n\nHangi harfi tercih edersiniz?', time: '10:21' },
      { sender: 'customer', text: 'A olsun bugün 14:30 uygun.', time: '10:25' },
      { sender: 'bot', text: 'Randevunuz Google Calendar\'da geçici olarak ayrıldı. Randevunuzun kesinleşmesi için tek kullanımlık güvenli ödeme linkiniz aşağıdadır:\n\n🔗 https://odeme.hizmetchatbot.local/pay/kombi-88921\n(Link üzerinden açık adresinizi ve notunuzu ekleyebilirsiniz)', time: '10:26', isPayment: true },
      { sender: 'customer', text: 'Ödemeyi tamamladım, yarın Mehmet Usta gelmeden arayabilir mi?', time: '10:42' },
      { sender: 'bot', text: 'Ödemeniz ve açık adresiniz başarıyla alındı! ✅ Randevunuz Usta 1 (Mehmet Usta) takviminde kesinleşti. Servis saatinden 30 dk önce usta konum linki WhatsApp\'tan iletilecektir.', time: '10:43' }
    ]
  },
  {
    id: 'cust-2',
    name: 'Emre Can',
    phone: '+90 542 333 4455',
    channel: 'whatsapp',
    district: 'Üsküdar / Acıbadem',
    fullAddress: 'Acıbadem Cad. Dostlar Apt. No:12 D:2 Üsküdar/İstanbul',
    serviceType: 'Kombi Arıza & Isınmama',
    servicePrice: '₺850 (Arıza Tespit)',
    paymentStatus: 'pending',
    paymentRef: 'iyzico_link_sent',
    appointmentSlot: 'Bugün 16:30 - 17:30',
    assignedTech: 'Usta 2: Ali Usta',
    googleCalendarEvent: 'GCAL_HOLD_USKUDAR_441',
    kvkkConsent: 'approved',
    aiMemorySummary: 'ECA Proteus Plus kombi. E03 hata kodu veriyor, fan motoru veya prosestat şüphesi var. Basınç 0.5 bara inmiş.',
    lastMessage: 'Ödeme linkine tıkladım kartımı giriyorum.',
    lastTime: '11:15',
    unreadCount: 1,
    messages: [
      { sender: 'customer', text: 'İyi günler kombi E03 hatası veriyor çalışmıyor acil usta yönlendirebilir misiniz?', time: '11:02' },
      { sender: 'bot', text: 'Merhaba Emre Bey! Acil kombi arıza talebinizi aldık. KVKK bilgilendirme metnimizi onaylıyor musunuz?', time: '11:03' },
      { sender: 'customer', text: 'Onaylıyorum acil usta lazım', time: '11:04' },
      { sender: 'bot', text: 'Üsküdar / Acıbadem bölgesinde Ali Usta şu an serviste. Saat 16:30 için arıza tespit slotu açabiliriz. Ödeme linki oluşturuldu:\n\n🔗 https://odeme.hizmetchatbot.local/pay/ariza-441', time: '11:05', isPayment: true },
      { sender: 'customer', text: 'Ödeme linkine tıkladım kartımı giriyorum.', time: '11:15' }
    ]
  },
  {
    id: 'cust-3',
    name: 'Zehra Korkmaz',
    phone: '+90 505 678 1234',
    channel: 'telegram',
    district: 'Kadıköy / Koşuyolu',
    fullAddress: 'Koşuyolu Mah. Cenap Şahabettin Sok. No:5 Kadıköy',
    serviceType: 'İlaçlı Petek Temizliği (6 Petek)',
    servicePrice: '₺1.600',
    paymentStatus: 'unpaid',
    paymentRef: 'pending_checkout',
    appointmentSlot: '1 Kasım Pazar 10:00 - 12:00',
    assignedTech: 'Usta 1: Mehmet Usta',
    googleCalendarEvent: 'PENDING_SLOT_KOŞU',
    kvkkConsent: 'approved',
    aiMemorySummary: 'Dublex daire, alt kat petekleri ılık üst kat soğuk kalıyor. Kimyasallı makineyle temizlik talep ediyor.',
    lastMessage: 'Pazar sabah 10:00 uygun mudur?',
    lastTime: '09:30',
    unreadCount: 2,
    messages: [
      { sender: 'customer', text: 'Merhaba Telegram botunuz üzerinden petek temizliği fiyatı alabilir miyim?', time: '09:20' },
      { sender: 'bot', text: 'Merhaba Zehra Hanım! Standart 6 peteğe kadar makine ile ilaçlı petek temizleme servisimiz ₺1.600\'dir. Hangi gün için düşünürsünüz?', time: '09:22' },
      { sender: 'customer', text: 'Pazar sabah 10:00 uygun mudur?', time: '09:30' }
    ]
  },
  {
    id: 'cust-4',
    name: 'Burak Yıldız',
    phone: '+90 553 222 9988',
    channel: 'whatsapp',
    district: 'Üsküdar / Kuzguncuk',
    fullAddress: 'Giriş yapılmadı',
    serviceType: 'Klima Kış Bakımı & Gaz Dolumu',
    servicePrice: '₺1.500',
    paymentStatus: 'unpaid',
    paymentRef: 'none',
    appointmentSlot: 'Belirlenmedi',
    assignedTech: 'Henüz Atanmadı',
    googleCalendarEvent: 'none',
    kvkkConsent: 'pending',
    aiMemorySummary: 'İlk kez yazdı. Henüz açık rıza vermedi. Kuzguncuk bölgesinde Arçelik inverter klima.',
    lastMessage: 'Klima sıcak üflemiyor gazı mı bitti acaba?',
    lastTime: '08:55',
    unreadCount: 0,
    messages: [
      { sender: 'customer', text: 'Klima sıcak üflemiyor gazı mı bitti acaba?', time: '08:55' },
      { sender: 'bot', text: 'Merhaba! Kuzguncuk ve çevresine klima bakım/onarım hizmeti sunmaktayız. Detayları paylaşabilmemiz için 6698 sayılı KVKK kapsamındaki açık rıza metnini onaylamanız gerekmektedir. Onaylıyor musunuz?', time: '08:56' }
    ]
  }
];

let selectedCustomerId = 'cust-1';
let isHumanTakeover = false;

function renderConversationList(filterQuery = '') {
  const container = document.getElementById('chat-conversations-list');
  if (!container) return;

  const filtered = MockConversations.filter(c => {
    return c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
           c.district.toLowerCase().includes(filterQuery.toLowerCase()) ||
           c.phone.includes(filterQuery);
  });

  container.innerHTML = filtered.map(c => {
    const isActive = c.id === selectedCustomerId;
    const isWhatsapp = c.channel === 'whatsapp';
    const paymentBadge = c.paymentStatus === 'paid' 
      ? '<span class="badge badge-success" style="font-size:10px; padding:2px 6px;">Ödendi</span>'
      : c.paymentStatus === 'pending'
      ? '<span class="badge badge-warning" style="font-size:10px; padding:2px 6px;">Ödeme Bekliyor</span>'
      : '<span class="badge badge-neutral" style="font-size:10px; padding:2px 6px;">Slot Aşamasında</span>';

    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" onclick="selectCustomer('${c.id}')">
        <div class="conv-avatar">
          ${c.name.charAt(0)}
          <span class="conv-channel-badge" style="background:${isWhatsapp ? '#25d366' : '#0088cc'};">
            ${isWhatsapp ? 'W' : 'T'}
          </span>
        </div>
        <div class="conv-body">
          <div class="conv-header">
            <span class="conv-name">${c.name}</span>
            <span class="conv-time">${c.lastTime}</span>
          </div>
          <div class="conv-last-msg">${c.lastMessage}</div>
          <div class="conv-tags">
            ${paymentBadge}
            <span style="font-size:11px; color:#5f6368;">${c.district.split('/')[0]}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function selectCustomer(customerId) {
  selectedCustomerId = customerId;
  const customer = MockConversations.find(c => c.id === customerId);
  if (!customer) return;

  renderConversationList();
  renderChatThread(customer);
  renderCustomerIntel(customer);
}

function renderChatThread(customer) {
  const headerName = document.getElementById('thread-customer-name');
  const headerMeta = document.getElementById('thread-customer-meta');
  const messagesBox = document.getElementById('chat-messages-box');

  if (headerName) headerName.textContent = customer.name;
  if (headerMeta) {
    headerMeta.textContent = `${customer.phone} • ${customer.channel.toUpperCase()} • ${customer.district}`;
  }

  if (!messagesBox) return;

  messagesBox.innerHTML = customer.messages.map(m => {
    const isBot = m.sender === 'bot';
    const isAgent = m.sender === 'human_agent';
    const isCust = m.sender === 'customer';
    const senderLabel = isCust ? customer.name : isAgent ? 'Yetkili Yönetici (Siz)' : 'HizmetChatbot (Yapay Zekâ)';
    const rowClass = isCust ? 'customer' : isAgent ? 'agent' : 'bot';

    let extraHtml = '';
    if (m.isPayment) {
      extraHtml = `
        <div class="chat-pos-card">
          <div style="font-weight:700; margin-bottom:4px;">💳 Sanal POS Ödeme Formu</div>
          <div style="font-size:12px;">Tutar: <strong>${customer.servicePrice}</strong></div>
          <div style="font-size:11px; margin-top:4px;">Durum: <strong>${customer.paymentStatus === 'paid' ? 'Tahsil Edildi ✅' : 'Bekleniyor ⏳'}</strong></div>
        </div>
      `;
    }

    return `
      <div class="chat-bubble-row ${rowClass}">
        <span class="chat-bubble-meta">${senderLabel} • ${m.time}</span>
        <div class="chat-bubble">
          ${m.text.replace(/\n/g, '<br>')}
          ${extraHtml}
        </div>
      </div>
    `;
  }).join('');

  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function renderCustomerIntel(customer) {
  const panel = document.getElementById('customer-intel-container');
  if (!panel) return;

  const isConsentApproved = customer.kvkkConsent === 'approved';

  panel.innerHTML = `
    <!-- 1. Temel Müşteri Bilgisi -->
    <div class="intel-card">
      <div class="intel-card-title">
        <span>Müşteri Bilgisi</span>
        <span class="badge ${isConsentApproved ? 'badge-success' : 'badge-warning'}">
          ${isConsentApproved ? 'KVKK Onaylı' : 'KVKK Bekliyor'}
        </span>
      </div>
      <div class="intel-field">
        <span class="label">Ad Soyad:</span>
        <span class="val">${customer.name}</span>
      </div>
      <div class="intel-field">
        <span class="label">Telefon:</span>
        <span class="val">${customer.phone}</span>
      </div>
      <div class="intel-field">
        <span class="label">Kanal:</span>
        <span class="val">${customer.channel.toUpperCase()}</span>
      </div>
    </div>

    <!-- 2. Adres & Semt Kartı -->
    <div class="intel-card">
      <div class="intel-card-title">
        <span>Bölge & Adres</span>
      </div>
      <div class="intel-field">
        <span class="label">Semt:</span>
        <span class="val">${customer.district}</span>
      </div>
      <div style="font-size:12px; margin-top:4px; color:var(--md-sys-color-on-surface);">
        <strong>Açık Adres:</strong><br>${customer.fullAddress}
      </div>
    </div>

    <!-- 3. Seçilen Hizmet & Ödeme Kartı -->
    <div class="intel-card">
      <div class="intel-card-title">
        <span>Hizmet & Sanal POS</span>
        <span class="badge ${customer.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}">
          ${customer.paymentStatus === 'paid' ? 'Tahsil Edildi' : 'Ödeme Bekliyor'}
        </span>
      </div>
      <div class="intel-field">
        <span class="label">Hizmet:</span>
        <span class="val">${customer.serviceType}</span>
      </div>
      <div class="intel-field">
        <span class="label">Tutar:</span>
        <span class="val">${customer.servicePrice}</span>
      </div>
      <div class="intel-field">
        <span class="label">Referans:</span>
        <span class="val" style="font-family:var(--md-sys-typescale-font-mono); font-size:11px;">${customer.paymentRef}</span>
      </div>
    </div>

    <!-- 4. Usta & Google Calendar Senkronizasyonu -->
    <div class="intel-card">
      <div class="intel-card-title">
        <span>Google Calendar Usta Slotu</span>
      </div>
      <div class="intel-field">
        <span class="label">Atanan Usta:</span>
        <span class="val">${customer.assignedTech}</span>
      </div>
      <div class="intel-field">
        <span class="label">Zaman Slotu:</span>
        <span class="val">${customer.appointmentSlot}</span>
      </div>
      <div class="intel-field">
        <span class="label">GCal ID:</span>
        <span class="val" style="font-family:var(--md-sys-typescale-font-mono); font-size:11px;">${customer.googleCalendarEvent}</span>
      </div>
    </div>

    <!-- 5. AI Hafıza & Özet Notları -->
    <div class="intel-card" style="background:#f0f4f9;">
      <div class="intel-card-title" style="color:var(--md-sys-color-primary);">
        <span>Yapay Zekâ Hafızası & Teşhis</span>
      </div>
      <p style="font-size:12.5px; line-height:1.45; color:var(--md-sys-color-on-surface);">
        ${customer.aiMemorySummary}
      </p>
    </div>
  `;
}

// Manual Manager Intervene Toggle
function initChatIntervention() {
  const toggleBtn = document.getElementById('btn-toggle-agent-mode');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    isHumanTakeover = !isHumanTakeover;
    if (isHumanTakeover) {
      toggleBtn.classList.remove('btn-outlined');
      toggleBtn.classList.add('btn-primary');
      toggleBtn.innerHTML = `
        <span class="pulse-dot live" style="background:#fff;"></span>
        Yönetici Devraldı (Manuel)
      `;
      showToast('Yapay zekâ otonom yanıtları durduruldu. Sohbeti siz yönetiyorsunuz.', 'warning');
    } else {
      toggleBtn.classList.remove('btn-primary');
      toggleBtn.classList.add('btn-outlined');
      toggleBtn.innerHTML = `
        <span class="pulse-dot live" style="background:#137333;"></span>
        Yapay Zekâ Otonom Devrede
      `;
      showToast('Yapay zekâ otonom yanıt motoru tekrar aktif edildi.', 'success');
    }
  });
}

// Send Message Handler
function initChatComposer() {
  const form = document.getElementById('chat-composer-form');
  const input = document.getElementById('chat-composer-input');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const customer = MockConversations.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    customer.messages.push({
      sender: isHumanTakeover ? 'human_agent' : 'bot',
      text: text,
      time: timeStr
    });
    customer.lastMessage = text;
    customer.lastTime = timeStr;

    input.value = '';
    renderChatThread(customer);
    renderConversationList();

    // If bot sent, or manual takeover sent, simulate customer reaction after 1.5s
    if (isHumanTakeover) {
      setTimeout(() => {
        customer.messages.push({
          sender: 'customer',
          text: 'Anladım teşekkür ederim, bekliyorum.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        customer.lastMessage = 'Anladım teşekkür ederim, bekliyorum.';
        renderChatThread(customer);
        renderConversationList();
      }, 1500);
    }
  });
}

// Search Filter
function initChatSearch() {
  const searchInput = document.getElementById('chat-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderConversationList(e.target.value);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderConversationList();
  selectCustomer(selectedCustomerId);
  initChatIntervention();
  initChatComposer();
  initChatSearch();
});
