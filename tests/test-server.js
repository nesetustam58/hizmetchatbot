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

    // 11. Chatbot Eğitici: Ayarları Getirme
    console.log('11. Test: GET /api/chatbot-trainer/settings');
    const trainerSettingsRes = await request('/api/chatbot-trainer/settings');
    console.log('   Durum Kodu:', trainerSettingsRes.status);
    console.log('   Yasaklı Kelime Sayısı:', trainerSettingsRes.data.settings.bannedWords.length);
    if (trainerSettingsRes.status !== 200) throw new Error('Trainer settings API başarısız!');

    // 12. Chatbot Eğitici: Kütüphane / RAG Lite Listeleme
    console.log('12. Test: GET /api/chatbot-trainer/knowledge');
    const knowledgeRes = await request('/api/chatbot-trainer/knowledge');
    console.log('   Kütüphane Belge Sayısı:', knowledgeRes.data.documents.length);
    if (knowledgeRes.status !== 200) throw new Error('Trainer knowledge API başarısız!');

    // 13. Chatbot Eğitici: Canlı Intent & Güvenlik Testi
    console.log('13. Test: POST /api/chatbot-trainer/test-intent');
    const testIntentRes = await request('/api/chatbot-trainer/test-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Kombim sıcak su vermiyor, Kadıköy Acıbadem' }
    });
    console.log('   Tespit Edilen Niyet:', testIntentRes.data.intentResult?.intent);
    console.log('   Aksiyon:', testIntentRes.data.actionRecommendation);
    if (testIntentRes.status !== 200) throw new Error('Trainer test-intent API başarısız!');

    // 14. /admin/chatbot-trainer Sayfa Rotası Testi
    console.log('14. Test: GET /admin/chatbot-trainer');
    const pageRes = await request('/admin/chatbot-trainer');
    console.log('   Sayfa HTTP Durumu:', pageRes.status);
    if (pageRes.status !== 200) throw new Error('Admin chatbot-trainer sayfası yüklenemedi!');

    // 15. Model Studio API Testi
    console.log('15. Test: GET /api/chatbot-trainer/models');
    const modelsRes = await request('/api/chatbot-trainer/models');
    console.log('   Toplam Model Sayısı:', modelsRes.data.models.length);
    if (modelsRes.status !== 200 || modelsRes.data.models.length < 4) throw new Error('Models API başarısız!');

    // 16. Kültürel Yerelleştirme API Testi
    console.log('16. Test: GET /api/chatbot-trainer/localization?lang=tr');
    const locRes = await request('/api/chatbot-trainer/localization?lang=tr');
    console.log('   Kültürel Kural Sayısı:', locRes.data.rules.length);
    if (locRes.status !== 200 || locRes.data.rules.length < 5) throw new Error('Localization API başarısız!');

    // 17. Eğitilme Durumu (Auto-Training) API Testi
    console.log('17. Test: GET /api/chatbot-trainer/training-status');
    const statusRes = await request('/api/chatbot-trainer/training-status');
    console.log('   Eğitim Seviyesi:', `%${statusRes.data.metrics.trainingPercent} (${statusRes.data.metrics.readinessStatus})`);
    if (statusRes.status !== 200) throw new Error('Training status API başarısız!');

    // 18. 9 Persona Paketleri API Testi
    console.log('18. Test: GET /api/chatbot-trainer/personas');
    const personasRes = await request('/api/chatbot-trainer/personas');
    console.log('   Persona Paketi Sayısı:', personasRes.data.personas.length);
    if (personasRes.status !== 200 || personasRes.data.personas.length !== 9) throw new Error('Personas API başarısız!');

    // 19. Canlı Persona Tespiti API Testi
    console.log('19. Test: POST /api/chatbot-trainer/detect-persona');
    const detectRes = await request('/api/chatbot-trainer/detect-persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Selamün aleyküm ustam hayırlı işler' }
    });
    console.log('   Tespit Edilen Persona:', detectRes.data.detectedPersona);
    if (detectRes.data.detectedPersona !== 'muhafazakar') throw new Error('Persona tespiti başarısız!');

    console.log('\n✅ TÜM SUNUCU VE ENTEGRASYON TESTLERİ BAŞARIYLA GEÇTİ!');
  } finally {
    server.close();
  }
}

runServerTests().catch(err => {
  console.error('❌ Sunucu Test Hatası:', err);
  process.exit(1);
});
