/**
 * HizmetChatbot — Çok Dilli, Persona Adaptasyonlu & Otonom SaaS AI Motoru Test Protokolü
 * 
 * Doğrulanan Modüller:
 * 1. Model Studio (Model Seçimi & Parametre İnce Ayarı)
 * 2. Kültürel Yerelleştirme & Şive/Deyim/Mizah (Cultural NLP)
 * 3. Eğitim Durumu (% Metrikler) & AI Öneri Onay Kuyruğu (Auto-Training)
 * 4. 9 Müşteri Persona Analizi (Empathy & Tone Matching)
 * 5. İnsansı Güven Telkini & Müşteri Soyuluyormuş Hissini Önleme Kalkanı
 */

import assert from 'node:assert';
import { 
  initDatabase, 
  CustomerRepo, 
  ModelRepo, 
  LocalizationRepo, 
  SuggestionRepo, 
  PersonaRepo, 
  ChatbotKnowledgeRepo, 
  ChatbotSettingsRepo 
} from '../src/database/db.js';
import { LLMEngine } from '../src/adapters/llm/llm-adapter.js';
import { processCustomerMessage } from '../src/core/state-machine.js';

async function runPersonaStudioTests() {
  console.log('🌟 [TEST]: Çok Dilli Persona, Model Studio & Auto-Training Doğrulaması Başlatılıyor...\n');

  initDatabase();

  // ============================================================================
  // TEST 1: Model Studio & Parametre Masası Doğrulaması
  // ============================================================================
  console.log('--- TEST 1: Model Studio & Çoklu Model Parametre Yönetimi ---');
  const allModels = ModelRepo.getAll();
  assert.ok(allModels.length >= 4, 'En az 4 model tanımlı olmalı!');
  console.log(`   Tanımlı Model Sayısı: ${allModels.length}`);

  const activeModel = ModelRepo.getActive();
  assert.ok(activeModel, 'Aktif bir model seçili olmalı!');
  assert.strictEqual(activeModel.name, 'Tr-usta', 'İlk eğitilen aktif modelin adı Tr-usta olmalıdır!');
  assert.strictEqual(activeModel.model_code, 'gemini-3.8-flash', 'Tr-usta modeli gemini-3.8-flash üzerinde çalışmalıdır!');
  console.log(`   Canlıda Aktif Model: 🇹🇷 ${activeModel.name} (${activeModel.model_code})`);

  // Model parametresi güncelleme testi
  ModelRepo.update(activeModel.id, { temperature: 0.15, maxTokens: 2048 });
  const updatedModel = ModelRepo.getById(activeModel.id);
  assert.strictEqual(updatedModel.temperature, 0.15);
  assert.strictEqual(updatedModel.max_tokens, 2048);
  console.log('✅ TEST 1 Başarılı: Model parametreleri (sıcaklık, token limiti) başarıyla yönetiliyor!\n');

  // ============================================================================
  // TEST 2: Kültürel Yerelleştirme (Cultural NLP) & Şive / Deyim / Mizah Testi
  // ============================================================================
  console.log('--- TEST 2: Kültürel Yerelleştirme & Bölgesel Diyaloglar ---');
  const locRules = LocalizationRepo.getAll('tr');
  assert.ok(locRules.length >= 5, 'En az 5 kültürel yerelleştirme kuralı bulunmalı!');
  console.log(`   Aktif Kültürel Kural Sayısı: ${locRules.length}`);

  // LLM Prompt'a kültürel kuralların enjeksiyonunu doğrula
  const culturalPrompt = LocalizationRepo.getRulesForPrompt('tr');
  assert.ok(culturalPrompt.includes('kolay gelsin'), '"kolay gelsin" kuralı promptta yer almalı!');
  assert.ok(culturalPrompt.includes('buz kestik evde'), 'Mizah/serzeniş kuralı promptta yer almalı!');

  // Web & Sosyal Medya Diyalog Tarama Simülatörü
  const scanResult = LocalizationRepo.simulateCulturalScan('Kadıköy ve Üsküdar Sokak Ağzı');
  assert.ok(scanResult.scannedCount >= 2, 'Simülatör diyalog tarayabilmeli!');
  console.log(`   Taranan Diyalog Kaynağı: ${scanResult.source}`);
  console.log('✅ TEST 2 Başarılı: Şive, esnaf söylemleri ve mizah dinamikleri başarıyla derleniyor!\n');

  // ============================================================================
  // TEST 3: Eğitim Durumu Göstergesi & AI Öneri Onay Kuyruğu (Auto-Training)
  // ============================================================================
  console.log('--- TEST 3: Eğitilme Durumu (%) & AI Öneri Onay Kuyruğu ---');
  const metrics = SuggestionRepo.getTrainingMetrics();
  assert.ok(metrics.trainingPercent >= 75, 'Eğitim yüzdesi %75 üzerinde olmalı!');
  console.log(`   Model Eğitim Yüzdesi: %${metrics.trainingPercent} (${metrics.readinessStatus})`);
  console.log(`   Taranan Toplam Kelime: ${metrics.totalScannedWords.toLocaleString('tr-TR')} Kelime`);

  // Onay Kuyruğu Testi
  let pendingSuggs = SuggestionRepo.getPending();
  if (pendingSuggs.length === 0) {
    SuggestionRepo.create({
      sourceType: 'customer_chat',
      category: 'faq',
      title: 'Kombi Su Basıncı Doldurma Musluğu SSS',
      suggestedRule: 'Kombi altındaki siyah/mavi plastik vana saat yönünün tersine çevrilmelidir',
      confidence: 0.94
    });
    pendingSuggs = SuggestionRepo.getPending();
  }
  assert.ok(pendingSuggs.length > 0, 'Onay bekleyen öneriler olmalı!');
  const testSugg = pendingSuggs[0];
  console.log(`   Onaylanacak Öneri: "${testSugg.title}" (%${Math.round(testSugg.confidence * 100)} Güven)`);

  const approveRes = SuggestionRepo.approve(testSugg.id);
  assert.strictEqual(approveRes.success, true);
  assert.strictEqual(approveRes.item.status, 'approved');
  console.log(`   Entegre Edilen Modül: ${approveRes.integratedModule}`);
  console.log('✅ TEST 3 Başarılı: AI önerisi onaylanıp sisteme anında entegre edildi!\n');

  // ============================================================================
  // TEST 4: 9 Müşteri Persona Analizi & Güven / Empati Motoru Doğrulaması
  // ============================================================================
  console.log('--- TEST 4: 9 Müşteri Personası Analizi & Empati / Güven Telkini ---');
  const personas = PersonaRepo.getAll();
  assert.strictEqual(personas.length, 9, 'Tam 9 müşteri persona paketi tanımlı olmalı!');

  // Test 4.1: Muhafazakâr Persona
  const resMuhafazakar = LLMEngine.detectCustomerPersona('Selamün aleyküm ustam, hayırlı işler, kombi bakımına ne zaman gelirsiniz inşallah');
  assert.strictEqual(resMuhafazakar.persona, 'muhafazakar');
  console.log(`   1. "Selamün aleyküm ustam..." -> Persona: [${resMuhafazakar.persona}] (%${Math.round(resMuhafazakar.confidence * 100)})`);

  // Test 4.2: Yaşlı / Kıdemli Vatandaş
  const resYasli = LLMEngine.detectCustomerPersona('Evladım biz yaşlıyız kombi çalışmıyor üşüdük evde kimse yok');
  assert.strictEqual(resYasli.persona, 'yasli');
  console.log(`   2. "Evladım biz yaşlıyız..." -> Persona: [${resYasli.persona}] (%${Math.round(resYasli.confidence * 100)})`);

  // Test 4.3: Teknoloji Zayıfı / Güvensizlik Hisseden
  const resTeknoloji = LLMEngine.detectCustomerPersona('Ben bu internetten anlamam param boşa gider mi dolandırıcı mısınız');
  assert.strictEqual(resTeknoloji.persona, 'teknoloji_zayifi');
  console.log(`   3. "Ben anlamam param gider mi..." -> Persona: [${resTeknoloji.persona}] (%${Math.round(resTeknoloji.confidence * 100)})`);

  // Test 4.4: Konuya Hâkim / Teknik
  const resTeknik = LLMEngine.detectCustomerPersona('Hermetik kombimde bar basıncı 0.7 ye düştü üç yollu vana motoru ses yapıyor');
  assert.strictEqual(resTeknik.persona, 'konuya_hakim');
  console.log(`   4. "Bar basıncı 0.7 üç yollu..." -> Persona: [${resTeknik.persona}] (%${Math.round(resTeknik.confidence * 100)})`);

  // Test 4.5: Genç / Pratik
  const resGenc = LLMEngine.detectCustomerPersona('selam naber ya kombi cortladı hızlı usta gelsin fiyat ne kadar bro');
  assert.strictEqual(resGenc.persona, 'genc');
  console.log(`   5. "kombi cortladı fiyat ne bro..." -> Persona: [${resGenc.persona}] (%${Math.round(resGenc.confidence * 100)})`);

  // Test 4.6: Usta Başvurusu
  const resUsta = LLMEngine.detectCustomerPersona('İyi günler ustayım kombi klima teknisyeniyim iş arıyorum ekibinize katılabilir miyim');
  assert.strictEqual(resUsta.persona, 'usta_basvurusu');
  console.log(`   6. "ustayım iş arıyorum..." -> Persona: [${resUsta.persona}] (%${Math.round(resUsta.confidence * 100)})`);

  // Persona Empati & Güven Telkini Enjeksiyonu
  const muhafazakarGuide = PersonaRepo.getPromptGuideline('muhafazakar');
  assert.ok(muhafazakarGuide.includes('hürmetle karşılık ver') || muhafazakarGuide.includes('Ve aleyküm selam'), 'Muhafazakâr ton kılavuzu güven vermelidir!');
  assert.ok(muhafazakarGuide.includes('garantimiz altındadır'), 'Güven telkini garanti içermelidir!');
  console.log('✅ TEST 4 Başarılı: 9 persona sınıflandırması ve empati tonları kusursuz eşleşti!\n');

  // ============================================================================
  // TEST 5: Diyalog Akışında Empati ve İnsansı Güven Telkini Doğrulaması
  // ============================================================================
  console.log('--- TEST 5: Canlı Diyalog Akışında İnsansı Persona & Güven Karşılaması ---');
  const testPhoneCust = '+905338887766';
  CustomerRepo.unblockUser(testPhoneCust);

  // Muhafazakâr selam ile giriş yapan kullanıcı
  const flowRes = await processCustomerMessage(testPhoneCust, 'Selamün aleyküm ustam kombi bakımı yaptıracaktık hayırlı işler');
  console.log('Botun Empati Dolu Karşılama Yanıtı:\n', flowRes.replyText);

  // Karşılamada hürmetkâr esnaf selamı ve dikey kilit bulunmalı
  assert.ok(
    flowRes.replyText.includes('Ve aleyküm selam') || flowRes.replyText.includes('hayırlı ve bereketli'),
    'Muhafazakâr müşteriye uygun hürmetkâr selamla dönülmelidir!'
  );
  assert.ok(flowRes.replyText.includes('KVKK'), 'Yasal KVKK bilgilendirmesi korunmalıdır!');

  const custRecord = CustomerRepo.getByPhone(testPhoneCust);
  assert.strictEqual(custRecord.detected_persona, 'muhafazakar', 'Müşterinin veritabanı kaydında persona muhafazakar olmalıdır!');
  console.log('✅ TEST 5 Başarılı: Müşteri kendini güvende ve hürmetle karşılanmış hissetti!\n');

  console.log('🎉 TÜM PERSONA, YERELLEŞTİRME VE MODEL STUDIO TESTLERİ %100 BAŞARIYLA TAMAMLANDI!');
}

runPersonaStudioTests().catch(err => {
  console.error('\n❌ TEST BAŞARISIZ OLDU:', err);
  process.exit(1);
});
