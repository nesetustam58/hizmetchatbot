/**
 * HizmetChatbot Sistem Ayarları & API/Slot Entegrasyon Testi
 */

import http from 'node:http';
import { startServer } from '../src/server.js';

const TEST_PORT = 3002;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${TEST_PORT}${path}`, options, (res) => {
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
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSettingsTests() {
  console.log('🧪 Ayarlar & API/Slot Entegrasyon Testleri Başlatılıyor...\n');
  const server = await startServer(TEST_PORT);

  try {
    // 1. Ayarları Çek
    console.log('1. Test: GET /api/settings');
    const getRes = await request('/api/settings');
    console.log('   Durum Kodu:', getRes.status);
    console.log('   LLM Sağlayıcı:', getRes.data.settings.llmProvider);
    console.log('   Usta 1 Takvim:', getRes.data.settings.tech1CalendarId);
    if (getRes.status !== 200) throw new Error('Settings GET başarısız!');

    // 2. Ayarları Güncelle
    console.log('2. Test: POST /api/settings');
    const updateRes = await request('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        slotDuration: 120,
        transitMargin: 45,
        openRouterModel: 'qwen/qwen-2.5-72b-instruct'
      }
    });
    console.log('   Kayıt Sonucu:', updateRes.data.success);
    if (!updateRes.data.success) throw new Error('Settings POST başarısız!');

    // 3. Güncellenen Ayarları Doğrula
    console.log('3. Test: GET /api/settings (Güncellenmiş Kontrolü)');
    const verifyRes = await request('/api/settings');
    console.log('   Güncel Servis Süresi:', verifyRes.data.settings.slotDuration);
    console.log('   Güncel İntikal Payı:', verifyRes.data.settings.transitMargin);
    if (verifyRes.data.settings.slotDuration !== 120) throw new Error('slotDuration güncellenemedi!');

    // 4. LLM API Bağlantı Testi
    console.log('4. Test: POST /api/settings/test-llm');
    const testLlmRes = await request('/api/settings/test-llm', { method: 'POST' });
    console.log('   LLM Test Sonucu:', testLlmRes.data.success);
    console.log('   Gecikme Süresi:', testLlmRes.data.latencyMs, 'ms');
    console.log('   Çıkarılan Semt:', testLlmRes.data.extracted.district);
    if (!testLlmRes.data.success) throw new Error('LLM Test başarısız!');

    // 5. Takvim Bağlantı Testi
    console.log('5. Test: POST /api/settings/test-calendar');
    const testCalRes = await request('/api/settings/test-calendar', { method: 'POST' });
    console.log('   Takvim Test Sonucu:', testCalRes.data.success);
    console.log('   Toplam Usta:', testCalRes.data.technicians.length);
    console.log('   Çakışma Sayısı:', testCalRes.data.conflicts);
    if (!testCalRes.data.success) throw new Error('Calendar Test başarısız!');

    console.log('\n✅ TÜM AYARLAR VE API/SLOT TESTLERİ BAŞARIYLA TAMAMLANDI!');
  } finally {
    server.close();
  }
}

runSettingsTests().catch(err => {
  console.error('❌ Ayarlar Test Hatası:', err);
  process.exit(1);
});
