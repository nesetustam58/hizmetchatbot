/**
 * HizmetChatbot Sunucu & REST API Entegrasyon Testi
 */

import http from 'node:http';
import { startServer } from '../src/server.js';

const TEST_PORT = 3001;

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

async function runServerTests() {
  console.log('🧪 HizmetChatbot REST API & Sunucu Testleri Başlatılıyor...\n');
  const server = await startServer(TEST_PORT);

  try {
    // 1. Stats Testi
    console.log('1. Test: GET /api/stats');
    const statsRes = await request('/api/stats');
    console.log('   Durum Kodu:', statsRes.status);
    console.log('   Aktif Usta Sayısı:', statsRes.data.activeTechCount);
    if (statsRes.status !== 200) throw new Error('Stats API başarısız!');

    // 2. Teknisyenler Testi
    console.log('2. Test: GET /api/technicians');
    const techRes = await request('/api/technicians');
    console.log('   Toplam Usta:', techRes.data.technicians.length);
    if (techRes.data.technicians.length !== 2) throw new Error('2 usta bekleniyordu!');

    // 3. Teknisyen Durum Değiştirme
    console.log('3. Test: POST /api/technicians/tech-1/status');
    const updateTechRes = await request('/api/technicians/tech-1/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { status: 'busy', currentTask: 'Fenerbahçe Acil Kombi Bakımı' }
    });
    console.log('   Güncellenen Durum:', updateTechRes.data.technician.status);
    if (updateTechRes.data.technician.status !== 'busy') throw new Error('Usta durumu güncellenemedi!');

    // 4. Google Calendar Slots Testi
    console.log('4. Test: GET /api/calendar/slots');
    const calSlotsRes = await request('/api/calendar/slots');
    console.log('   Usta 1 Slot Sayısı:', calSlotsRes.data.tech1.slots.length);
    console.log('   Usta 2 Slot Sayısı:', calSlotsRes.data.tech2.slots.length);
    if (calSlotsRes.status !== 200) throw new Error('Calendar slots başarısız!');

    // 5. Google Calendar Senkronizasyon Testi
    console.log('5. Test: POST /api/calendar/sync');
    const syncRes = await request('/api/calendar/sync', { method: 'POST' });
    console.log('   Senkronize Edilen Usta:', syncRes.data.technicians.length);
    console.log('   Çakışma Sayısı:', syncRes.data.conflictCount);
    if (syncRes.data.conflictCount !== 0) throw new Error('Çakışma bulundu!');

    // 6. Çakışma Kontrol Testi
    console.log('6. Test: GET /api/calendar/check-conflicts');
    const conflictRes = await request('/api/calendar/check-conflicts');
    console.log('   Genel Çakışma Durumu:', conflictRes.data.overallStatus);

    // 7. KVKK Kural Setleri Testi
    console.log('7. Test: GET /api/kvkk/rules');
    const kvkkRes = await request('/api/kvkk/rules');
    console.log('   Kural Sayısı:', kvkkRes.data.rules.length);

    // 8. KVKK Kuralı Durum Değiştirme
    console.log('8. Test: POST /api/kvkk/rules/rule-spam-frequency/toggle');
    const toggleRuleRes = await request('/api/kvkk/rules/rule-spam-frequency/toggle', { method: 'POST' });
    console.log('   Yeni Kural Durumu:', toggleRuleRes.data.newStatus);

    // 9. CTO Fikir Gönderimi
    console.log('9. Test: POST /api/cto/ideas');
    const ctoRes = await request('/api/cto/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { idea: 'Kombi bakımından sonra 30 gün sonra WhatsApp anket hatırlatması' }
    });
    console.log('   Üretilen Görev ID:', ctoRes.data.taskId);

    // 10. Webhook Dış Mesaj Simülasyonu
    console.log('10. Test: POST /api/webhook/incoming (WhatsApp Simülasyonu)');
    const incomingRes = await request('/api/webhook/incoming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { phoneNumber: '+905327778899', text: 'Merhaba kombim arızalandı' }
    });
    console.log('   Gelen Cevap Özeti:', incomingRes.data.replyText.split('\n')[0]);
    console.log('   Adım:', incomingRes.data.currentStep);

    console.log('\n✅ TÜM SUNUCU VE ENTEGRASYON TESTLERİ BAŞARIYLA GEÇTİ!');
  } finally {
    server.close();
  }
}

runServerTests().catch(err => {
  console.error('❌ Sunucu Test Hatası:', err);
  process.exit(1);
});
