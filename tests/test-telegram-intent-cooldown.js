/**
 * HizmetChatbot — Telegram Kanalı Uçtan Uca Niyet Yönlendirme & Token Korumalı Cooldown Test Protokolü
 * 
 * Doğrulanan Senaryolar:
 * 1. Niyet Yönlendirme (Irrelevant Intent & Dikey Kilit):
 *    - Konu dışı sohbet girişimlerinde ("Bugün hava çok güzel, ne düşünüyorsun?")
 *      Gemini 3.8 Flash modelinin veya heuristic niyet filtresinin konuyu profesyonelce reddedip
 *      Kadıköy & Üsküdar kombi/klima randevu akışına yönlendirmesi.
 * 2. Spam, Token Koruma ve 3 Saatlik Cooldown:
 *    - Ard arda anlamsız spam mesajlarında ilk aşamalarda kibar uyarı,
 *      ısrar halinde SQLite'ta 3 saatlik blok (is_blocked_until) ve spam_count artışı.
 *    - Blok süresince harici LLM (Gemini 3.8 Flash) çağrısı yapılmaksızın doğrudan $0 token ile
 *      SQLite tabanlı ceza metninin dönmesi.
 * 3. Telegram Webhook & n8n Köprüsü (/api/webhook/telegram) Uçtan Uca HTTP Entegrasyonu.
 */

import assert from 'node:assert';
import http from 'node:http';
import { 
  initDatabase, 
  CustomerRepo, 
  ChatbotSettingsRepo 
} from '../src/database/db.js';
import { processCustomerMessage } from '../src/core/state-machine.js';
import { LLMEngine } from '../src/adapters/llm/llm-adapter.js';
import { startServer } from '../src/server.js';

const TEST_PORT = 3003;

function makeHttpRequest(path, method = 'POST', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${TEST_PORT}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTelegramTestProtocol() {
  console.log('🤖 [TELEGRAM TEST PROTOKOLÜ]: Niyet Yönlendirme & Token Korumalı Cooldown Doğrulaması\n');
  
  // 1. Veritabanını hazırla
  initDatabase();

  // ============================================================================
  // SENARYO 1: TELEGRAM KANALINDA NİYET YÖNLENDİRME (IRRELEVANT INTENT & DİKEY KİLİT)
  // ============================================================================
  console.log('======================================================================');
  console.log('📌 SENARYO 1: Telegram Kanalında Niyet Yönlendirme (Irrelevant Intent)');
  console.log('======================================================================');

  const tgUser1 = 'tg_8899001122';
  CustomerRepo.unblockUser(tgUser1); // Test öncesi temiz başlangıç

  console.log('\n[Simülasyon 1.1]: Telegram kullanıcısı konu dışı genel sohbet mesajı gönderiyor:');
  console.log('>> Kullanıcı Mesajı: "Bugün hava çok güzel, ne düşünüyorsun?"');

  const intentStart = Date.now();
  const res1 = await processCustomerMessage(tgUser1, 'Bugün hava çok güzel, ne düşünüyorsun?', 'telegram');
  const intentLatency = Date.now() - intentStart;

  console.log(`<< Bot Yanıtı (${intentLatency}ms):\n"${res1.replyText}"\n`);

  // Doğrulamalar:
  assert.strictEqual(res1.isBlocked, undefined, 'Konu dışı ilk mesajda kullanıcı bloklanmamalıdır!');
  
  // Beklenen: Kombi/klima servisi, bakım, randevu veya Kadıköy/Üsküdar yönlendirmesi içermeli
  const hasServiceGuidance = /kombi|klima|servis|randevu|kadıköy|üsküdar|bakım/i.test(res1.replyText);
  assert.ok(hasServiceGuidance, 'Bot yanıtı kombi/klima servisine ve randevu sürecine kibarca yönlendirmelidir!');

  // Veritabanı durumunu doğrula
  const custRecord1 = CustomerRepo.getByPhone(tgUser1);
  assert.ok(custRecord1, 'Telegram müşterisi veritabanında oluşturulmuş olmalıdır!');
  assert.strictEqual(custRecord1.channel, 'telegram', 'Müşteri kanalı telegram olarak kaydedilmelidir!');
  assert.strictEqual(custRecord1.spam_count, 1, 'Konu dışı mesaj sonrası spam_count 1 artmalıdır!');
  assert.strictEqual(custRecord1.last_intent, 'off_topic', 'Son niyet off_topic olarak işaretlenmelidir!');
  console.log('✅ [SENARYO 1 DOĞRULANDI]: Gemini 3.8 Flash / Niyet Motoru konu dışı sohbeti başarıyla dikey servise yönlendirdi!\n');


  // ============================================================================
  // SENARYO 2: SPAM, TOKEN KORUMA VE 3 SAATLİK COOLDOWN CEZA PROTOKOLÜ
  // ============================================================================
  console.log('======================================================================');
  console.log('📌 SENARYO 2: Telegram Spam, Token Koruma ve 3 Saatlik Cooldown Cezası');
  console.log('======================================================================');

  const tgUserSpam = 'tg_9988776655';
  CustomerRepo.unblockUser(tgUserSpam); // Temiz başlangıç

  // Adım 2.1: İlk spam girişimi (Anlamsız klavye flood)
  console.log('\n[Simülasyon 2.1]: 1. Spam Mesajı Gönderiliyor (Klavye Flood): "asdasdasdasd"');
  const spamRes1 = await processCustomerMessage(tgUserSpam, 'asdasdasdasd', 'telegram');
  console.log(`<< 1. Yanıt: "${spamRes1.replyText}"`);

  let spamCust = CustomerRepo.getByPhone(tgUserSpam);
  assert.strictEqual(spamCust.spam_count, 1, '1. spam sonrası spam_count 1 olmalı');
  assert.strictEqual(spamCust.is_blocked_until, null, '1. spamde henüz blok uygulanmamalı');
  assert.match(spamRes1.replyText, /Biz Kadıköy & Üsküdar bölgesinde uzman kombi\/klima servisiyiz/i, 'İlk aşamada kibar yönlendirme yapılmalı');

  // Adım 2.2: İkinci spam girişimi (Botu test etme / fıkra isteme)
  console.log('\n[Simülasyon 2.2]: 2. Spam Mesajı Gönderiliyor: "Bana bir masal veya fıkra anlat"');
  const spamRes2 = await processCustomerMessage(tgUserSpam, 'Bana bir masal veya fıkra anlat', 'telegram');
  console.log(`<< 2. Yanıt: "${spamRes2.replyText}"`);

  spamCust = CustomerRepo.getByPhone(tgUserSpam);
  assert.strictEqual(spamCust.spam_count, 2, '2. spam sonrası spam_count 2 olmalı');
  assert.strictEqual(spamCust.is_blocked_until, null, '2. spamde henüz blok uygulanmamalı');

  // Adım 2.3: Üçüncü spam girişimi (Israrcı meşgul etme - Eşik Aşımı)
  console.log('\n[Simülasyon 2.3]: 3. Spam Mesajı Gönderiliyor (Tolerans Sınırı): "zzzzzzzzzz"');
  const spamRes3 = await processCustomerMessage(tgUserSpam, 'zzzzzzzzzz', 'telegram');
  console.log(`<< 3. Yanıt (Ceza Mesajı): "${spamRes3.replyText}"`);

  spamCust = CustomerRepo.getByPhone(tgUserSpam);
  assert.strictEqual(spamCust.spam_count, 3, '3. spam sonrası spam_count 3 olmalı');
  assert.ok(spamCust.is_blocked_until, '3. spamde is_blocked_until alanı doldurulmalı!');
  assert.strictEqual(spamRes3.isBlocked, true, 'isBlocked bayrağı true dönmelidir!');

  // 3 saatlik süreyi doğrula
  const blockedTimeMs = new Date(spamCust.is_blocked_until).getTime() - Date.now();
  const blockedHours = blockedTimeMs / (3600 * 1000);
  assert.ok(blockedHours >= 2.8 && blockedHours <= 3.1, 'Ceza süresi 3 saat (+/- tolerans) olmalıdır!');

  // Ceza metnini doğrula
  const expectedPenaltyRegex = /Sistemi gereksiz meşgul ettiğiniz veya botu oyun amaçlı kullandığınız tespit edilmiştir.*3 saat boyunca yanıt verilemeyecektir/i;
  assert.match(spamRes3.replyText, expectedPenaltyRegex, '3 saatlik resmi ceza metni dönmelidir!');
  console.log('✅ [2.3 DOĞRULANDI]: Kullanıcı başarıyla 3 saatlik cooldown cezasına alındı!');

  // Adım 2.4: Token Koruma Doğrulaması (Blokluyken Yeni Mesaj Gelmesi)
  console.log('\n[Simülasyon 2.4]: Kullanıcı blokluyken yeni mesaj atıyor (Token Kalkanı Testi):');
  console.log('>> Gönderilen: "Lütfen açın, kombim bozuldu acil randevu istiyorum"');

  const shieldStatsBefore = ChatbotSettingsRepo.getShieldStats();
  const tokenShieldStart = Date.now();

  // Bu çağrıda LLM API kesinlikle çağrılmamalı, anında (<10ms) yerel SQLite yanıtı dönmelidir
  const blockedCallRes = await processCustomerMessage(tgUserSpam, 'Lütfen açın, kombim bozuldu acil randevu istiyorum', 'telegram');
  const tokenShieldLatency = Date.now() - tokenShieldStart;

  console.log(`<< Bloklu Yanıt (${tokenShieldLatency}ms - $0 Token Maliyeti):\n"${blockedCallRes.replyText}"\n`);

  assert.strictEqual(blockedCallRes.isBlocked, true, 'Kullanıcı hala bloklu olmalı!');
  assert.match(blockedCallRes.replyText, expectedPenaltyRegex, 'Ceza metni harici API çağrısı olmadan dönmelidir!');
  assert.ok(tokenShieldLatency < 100, `Token kalkanı anında yanıt vermelidir (Ölçülen: ${tokenShieldLatency}ms)!`);

  // Telemetri sayacının arttığını doğrula
  const shieldStatsAfter = ChatbotSettingsRepo.getShieldStats();
  assert.ok(shieldStatsAfter.tokensSavedEstimate > shieldStatsBefore.tokensSavedEstimate, 'Kurtarılan tahmini token miktarı artmalıdır!');
  console.log(`✅ [2.4 DOĞRULANDI]: Sıfır Token Kalkanı devrede! Harici LLM çağrılmadı, ${tokenShieldLatency}ms içinde yerel ceza döndü.\n`);


  // ============================================================================
  // SENARYO 3: TELEGRAM WEBHOOK REST API KÖPRÜSÜ (/api/webhook/telegram)
  // ============================================================================
  console.log('======================================================================');
  console.log('📌 SENARYO 3: Telegram Webhook Köprüsü (/api/webhook/telegram) Testi');
  console.log('======================================================================');

  const server = await startServer(TEST_PORT);
  try {
    const rawTgChatId = 7711223344;
    CustomerRepo.unblockUser(`tg_${rawTgChatId}`); // Test öncesi temizle

    // Telegram Bot API standart webhook yükü simülasyonu
    const tgWebhookPayload = {
      update_id: 100001,
      message: {
        message_id: 42,
        from: { id: rawTgChatId, first_name: 'Ahmet', is_bot: false },
        chat: { id: rawTgChatId, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: 'Hava durumu nasıl olacak bugün?'
      }
    };

    console.log(`\n[Simülasyon 3.1]: POST http://localhost:${TEST_PORT}/api/webhook/telegram`);
    const webhookRes = await makeHttpRequest('/api/webhook/telegram', 'POST', tgWebhookPayload);
    
    console.log('<< HTTP Status:', webhookRes.status);
    console.log('<< HTTP Yanıt Gövdesi:', JSON.stringify(webhookRes.data, null, 2));

    assert.strictEqual(webhookRes.status, 200, 'Telegram webhook HTTP 200 dönmelidir!');
    assert.strictEqual(webhookRes.data.success, true);
    assert.strictEqual(webhookRes.data.channel, 'telegram');
    assert.strictEqual(webhookRes.data.customerId, `tg_${rawTgChatId}`);
    assert.ok(/kombi|klima|servis|randevu/i.test(webhookRes.data.replyText), 'Webhook cevabı servis yönlendirmesi içermelidir!');

    console.log('✅ [SENARYO 3 DOĞRULANDI]: Telegram Webhook uçtan uca niyet yönlendirmesiyle başarıyla çalıştı!');

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log('🎉 TÜM TELEGRAM NİYET YÖNLENDİRME VE COOLDOWN SENARYOLARI EKSİKSİZ GEÇTİ!');
  console.log('======================================================================\n');
}

runTelegramTestProtocol().catch(err => {
  console.error('\n❌ TELEGRAM TEST PROTOKOLÜ BAŞARISIZ OLDU:', err);
  process.exit(1);
});
