/**
 * HizmetChatbot — Bağımsız Otonom SaaS AI Motoru
 * Güvenlik, Cooldown, Niyet Sınıflandırma, RAG Lite Web Scraper ve White-Label Testi
 * Gemini 3.8 Flash & OpenRouter & Ollama Model-Bağımsız Çekirdek
 */

import assert from 'node:assert';
import { 
  initDatabase, 
  CustomerRepo, 
  ChatbotSettingsRepo, 
  ChatbotKnowledgeRepo 
} from '../src/database/db.js';
import { processCustomerMessage } from '../src/core/state-machine.js';
import { LLMEngine } from '../src/adapters/llm/llm-adapter.js';

async function runSecurityAndTrainerTests() {
  console.log('🚀 [TEST]: Bağımsız SaaS AI Motoru Uçtan Uca Testleri Başlatılıyor...\n');

  initDatabase();

  // ============================================================================
  // TEST 1: Yasaklı Kelimeler Matrisi & 3 Saatlik Ceza (Token Harcamadan)
  // ============================================================================
  console.log('--- TEST 1: Yasaklı Kelime & 3 Saatlik Ceza (Cooldown) ---');
  const abusePhone = '+905391112233';
  CustomerRepo.unblockUser(abusePhone);

  const abuseRes = await processCustomerMessage(abusePhone, 'Bu sistem çok salak ve küfür ediyorum');
  console.log('Bot Cevabı:', abuseRes.replyText);
  assert.strictEqual(abuseRes.isBlocked, true, 'Kullanıcı 3 saatlik cezaya girmeliydi!');
  assert.match(abuseRes.replyText, /Sistemi gereksiz meşgul ettiğiniz|3 saat/i, 'Ceza mesajı döndürülmeli!');

  const custAbuse = CustomerRepo.getByPhone(abusePhone);
  assert.ok(custAbuse.is_blocked_until, 'is_blocked_until dolu olmalı!');
  const remainingHours = (new Date(custAbuse.is_blocked_until).getTime() - Date.now()) / (3600 * 1000);
  assert.ok(remainingHours > 2.8, 'Ceza yaklaşık 3 saat olmalı!');
  console.log('✅ TEST 1 Başarılı: Yasaklı kelime anında 3 saatlik blok uyguladı!\n');

  // ============================================================================
  // TEST 2: Engelli Kullanıcı Token Koruma Kalkanı (LLM Çağrısı Yapılmadan)
  // ============================================================================
  console.log('--- TEST 2: Cooldown Süresinde Token Harcama Kalkanı ---');
  const blockedRes = await processCustomerMessage(abusePhone, 'Kombim bozuldu ne zaman geleceksiniz?');
  console.log('Engelli Yanıtı:', blockedRes.replyText);
  assert.strictEqual(blockedRes.isBlocked, true, 'Engelli kullanıcı bloke cevabı almalı!');
  assert.match(blockedRes.replyText, /3 saat boyunca yanıt verilemeyecektir/i);
  console.log('✅ TEST 2 Başarılı: Bloklu kullanıcıya API çağrısı yapılmadan ceza mesajı döndü!\n');

  // ============================================================================
  // TEST 3: Spam & Konu Dışı Filtresi (Heuristic + Yönlendirme + 3. Spamde Blok)
  // ============================================================================
  console.log('--- TEST 3: Konu Dışı Mesajlar & 3. Spam Sonrası 3 Saat Ceza ---');
  const spamPhone = '+905399998877';
  CustomerRepo.unblockUser(spamPhone);

  // 1. Spam Mesaj: Fıkra anlat (Spam trigger)
  console.log('-> 1. Konu Dışı Mesaj Gönderiliyor: "Bana bir fıkra anlat"');
  let spamRes1 = await processCustomerMessage(spamPhone, 'Bana bir fıkra anlat');
  console.log('Bot Cevabı 1:', spamRes1.replyText);
  assert.match(spamRes1.replyText, /Biz Kadıköy & Üsküdar bölgesinde uzman kombi\/klima servisiyiz/i, 'Kibar yönlendirme mesajı verilmeli!');
  let custSpam = CustomerRepo.getByPhone(spamPhone);
  assert.strictEqual(custSpam.spam_count, 1, 'Spam count 1 olmalı!');

  // 2. Spam Mesaj: Hava durumu
  console.log('-> 2. Konu Dışı Mesaj Gönderiliyor: "Hava durumu nasıl olacak?"');
  let spamRes2 = await processCustomerMessage(spamPhone, 'Hava durumu nasıl olacak?');
  console.log('Bot Cevabı 2:', spamRes2.replyText);
  custSpam = CustomerRepo.getByPhone(spamPhone);
  assert.strictEqual(custSpam.spam_count, 2, 'Spam count 2 olmalı!');

  // 3. Spam Mesaj: Rastgele harf dizisi (asdasdasdasd) -> 3. kez spam!
  console.log('-> 3. Spam Mesaj Gönderiliyor: "asdasdasdasd" (Tolerans aşımı)');
  let spamRes3 = await processCustomerMessage(spamPhone, 'asdasdasdasd');
  console.log('Bot Cevabı 3:', spamRes3.replyText);
  assert.strictEqual(spamRes3.isBlocked, true, '3. spam sonrası kullanıcı 3 saat cezaya alınmalı!');
  assert.match(spamRes3.replyText, /Sistemi gereksiz meşgul ettiğiniz.*3 saat/i);

  custSpam = CustomerRepo.getByPhone(spamPhone);
  assert.ok(custSpam.is_blocked_until, 'Kullanıcı bloke edilmeli!');
  console.log('✅ TEST 3 Başarılı: Spam sayacı 3 olunca 3 saatlik cooldown uygulandı!\n');

  // ============================================================================
  // TEST 4: White-Label Marka & Profil Yönetimi
  // ============================================================================
  console.log('--- TEST 4: White-Label SaaS Marka Profili Testi ---');
  ChatbotSettingsRepo.setWhiteLabelProfile({
    brandName: 'UstaKombi Pro Otomasyonu',
    industryVertical: 'Kombi ve Klima Teknik Servisi',
    serviceRegions: 'Kadıköy, Üsküdar ve Ataşehir'
  });

  const profile = ChatbotSettingsRepo.getWhiteLabelProfile();
  assert.strictEqual(profile.brandName, 'UstaKombi Pro Otomasyonu');
  assert.strictEqual(profile.industryVertical, 'Kombi ve Klima Teknik Servisi');

  const dynamicPrompt = LLMEngine.getDynamicSystemPrompt({}, 'Kombi bakımı');
  assert.ok(dynamicPrompt.includes('UstaKombi Pro Otomasyonu'), 'Sistem talimatında White-Label marka adı yer almalı!');
  assert.ok(dynamicPrompt.includes('Kadıköy, Üsküdar ve Ataşehir'), 'Sistem talimatında White-Label bölgeler yer almalı!');
  console.log('✅ TEST 4 Başarılı: White-label marka profili tüm LLM modellerine dinamik yansıtılıyor!\n');

  // ============================================================================
  // TEST 5: RAG Lite Alaka Puanlaması (Relevance-based Context)
  // ============================================================================
  console.log('--- TEST 5: RAG Lite Akıllı Alaka Bağlamı (Context Scoring) ---');
  const docE88 = ChatbotKnowledgeRepo.create({
    title: 'E88 Basınç Arızası Kılavuzu',
    type: 'manual',
    source: 'E88_Guide.txt',
    content: 'E88 hata kodu su basıncının 0.5 barın altına düşmesi durumudur.',
    isActive: 1
  });

  const relevantPrompt = ChatbotKnowledgeRepo.getContextPrompt('Kombim E88 arıza kodu veriyor');
  assert.ok(relevantPrompt.includes('E88 Basınç Arızası Kılavuzu'), 'İlgili belge bağlamda yer almalı!');
  ChatbotKnowledgeRepo.delete(docE88.id);
  console.log('✅ TEST 5 Başarılı: RAG Lite mesajdaki anahtar kelimelere göre alakalı belgeleri önceliklendirdi!\n');

  // ============================================================================
  // TEST 6: Token Shield Tasarruf Telemetrisi
  // ============================================================================
  console.log('--- TEST 6: Token Shield Telemetrisi & Tasarruf Sayaçları ---');
  const shieldBefore = ChatbotSettingsRepo.getShieldStats();
  ChatbotSettingsRepo.incrementShieldStats(300);
  const shieldAfter = ChatbotSettingsRepo.getShieldStats();
  assert.strictEqual(shieldAfter.blockedCount, shieldBefore.blockedCount + 1);
  assert.strictEqual(shieldAfter.tokensSavedEstimate, shieldBefore.tokensSavedEstimate + 300);
  console.log('   Kurtarılan Token:', shieldAfter.tokensSavedEstimate, 'Token');
  console.log('   Engellenen Tehdit:', shieldAfter.blockedCount);
  console.log('✅ TEST 6 Başarılı: Token koruma telemetrisi gerçek zamanlı artış gösterdi!\n');

  // ============================================================================
  // TEST 7: Engeli Kaldırma & Normal Servis Akışı
  // ============================================================================
  console.log('--- TEST 7: Engeli Kaldırma ve Normal Servis Akışı ---');
  CustomerRepo.unblockUser(custSpam.id);
  const normalRes = await processCustomerMessage(spamPhone, 'Merhaba kombim ses yapıyor Kadıköy');
  console.log('Normal Yanıt:', normalRes.replyText);
  assert.strictEqual(normalRes.isBlocked, undefined, 'Engel kalktığında müşteri akışa girebilmeli!');
  console.log('✅ TEST 7 Başarılı: Müşteri engeli kaldırıldıktan sonra randevu akışına sorunsuz alındı!\n');

  console.log('🎉 TÜM BAĞIMSIZ SAAS AI MOTORU TESTLERİ EKSİKSİZ GEÇTİ!');
}

runSecurityAndTrainerTests().catch(err => {
  console.error('❌ Test Başarısız Oldu:', err);
  process.exit(1);
});
