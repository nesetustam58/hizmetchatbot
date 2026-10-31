/**
 * HizmetChatbot n8n REST API Köprüsü Testi
 */

import http from 'node:http';
import { startServer } from '../src/server.js';

const TEST_PORT = 3003;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${TEST_PORT}${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
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

async function runN8nTests() {
  console.log('🧪 n8n REST API Köprüsü & Şablon Testleri Başlatılıyor...\n');
  const server = await startServer(TEST_PORT);

  try {
    // 1. n8n Mesaj Girişi Testi
    console.log('1. Test: POST /api/n8n/message-in');
    const msgRes = await request('/api/n8n/message-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        phoneNumber: '+905321122334',
        text: 'Merhaba kombim Demirdöküm Nitromix, bakım yaptırmak istiyorum',
        channel: 'whatsapp'
      }
    });
    console.log('   Durum Kodu:', msgRes.status);
    console.log('   Dönen Bot Cevabı:', msgRes.data.replyText.split('\n')[0]);
    console.log('   Mevcut Adım:', msgRes.data.currentStep);
    if (msgRes.status !== 200 || !msgRes.data.success) throw new Error('n8n message-in başarısız!');

    // 2. n8n Takvim Slot Sorgusu
    console.log('2. Test: GET /api/n8n/calendar-slots?region=kadikoy');
    const slotsRes = await request('/api/n8n/calendar-slots?region=kadikoy');
    console.log('   Atanan Usta:', slotsRes.data.assignedTechnician);
    console.log('   Müsait Slot Sayısı:', slotsRes.data.slots.length);
    if (slotsRes.data.slots.length === 0) throw new Error('Slot bulunamadı!');

    // 3. n8n Workflow JSON İndirme Testi
    console.log('3. Test: GET /api/n8n/workflow-json');
    const workflowRes = await request('/api/n8n/workflow-json');
    console.log('   İçerik Tipi:', workflowRes.headers['content-type']);
    console.log('   n8n Düğüm Sayısı (Nodes):', workflowRes.data.nodes?.length);
    if (!workflowRes.data.nodes || workflowRes.data.nodes.length < 5) throw new Error('Workflow JSON eksik veya geçersiz!');

    console.log('\n✅ TÜM n8n ENTEGRASYON TESTLERİ %100 BAŞARIYLA GEÇTİ!');
  } finally {
    server.close();
  }
}

runN8nTests().catch(err => {
  console.error('❌ n8n Test Hatası:', err);
  process.exit(1);
});
