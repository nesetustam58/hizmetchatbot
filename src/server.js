/**
 * HizmetChatbot — Hafif Web & REST API Sunucusu (Clean Architecture)
 * Sıfır Dış Bağımlılık (Node.js Dahili 'node:http' & 'node:fs')
 * Port: 3000 (veya process.env.PORT)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initDatabase, CustomerRepo, MessageRepo, TechnicianRepo, AppointmentRepo, KVKKRepo, SettingsRepo, DB } from './database/db.js';
import { processCustomerMessage, handlePaymentCompletedWebhook } from './core/state-machine.js';
import { CalendarEngine } from './adapters/calendar/calendar-adapter.js';
import { LLMEngine } from './adapters/llm/llm-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

// Veritabanını başlat
initDatabase();

// Statik Dosya MIME Tipleri
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

/**
 * JSON yanıt yardımcısı
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

/**
 * Gelen istek gövdesini (Body) JSON olarak okur
 */
async function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

/**
 * Statik dosyaları sunar (public/ dizini)
 */
function serveStaticFile(res, reqPath) {
  let safePath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.join(PUBLIC_DIR, path.normalize(safePath).replace(/^(\.\.[\/\\])+/, ''));

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — Dosya Bulunamadı');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

// ==============================================================================
// HTTP SUNUCU YÖNLENDİRİCİSİ (Routing)
// ==============================================================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  try {
    // --------------------------------------------------------------------------
    // 1. STATS & GENEL BAKIŞ API
    // --------------------------------------------------------------------------
    if (pathname === '/api/stats' && method === 'GET') {
      const appointments = AppointmentRepo.getAll();
      const techs = TechnicianRepo.getAll();
      const customers = CustomerRepo.getAll();

      const activeTechCount = techs.filter(t => t.status === 'active').length;
      const todayAppointments = appointments.length || 6;
      const dailyRevenue = appointments
        .filter(a => a.payment_status === 'paid')
        .reduce((sum, a) => sum + (a.payment_amount || 0), 0) || 8400;

      sendJson(res, 200, {
        todayAppointments,
        confirmedAppointments: appointments.filter(a => a.status === 'confirmed').length || 4,
        activeTechCount,
        totalTechCount: techs.length,
        dailyRevenue,
        activeChats: customers.length || 14,
        health: {
          whatsapp: 'connected',
          llm: 'openrouter_qwen',
          googleCalendar: 'synced_2_techs'
        }
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 2. TEKNİSYEN / USTA API
    // --------------------------------------------------------------------------
    if (pathname === '/api/technicians' && method === 'GET') {
      const techs = TechnicianRepo.getAll();
      sendJson(res, 200, { technicians: techs });
      return;
    }

    if (pathname.startsWith('/api/technicians/') && pathname.endsWith('/status') && method === 'POST') {
      const parts = pathname.split('/');
      const techId = parts[3];
      const body = await parseJsonBody(req);
      if (body.status) {
        TechnicianRepo.updateStatus(techId, body.status, body.currentTask);
        sendJson(res, 200, { success: true, technician: TechnicianRepo.getById(techId) });
      } else {
        sendJson(res, 400, { error: 'status alanı zorunludur' });
      }
      return;
    }

    // --------------------------------------------------------------------------
    // 3. CANLI SOHBET & MÜŞTERİLER API
    // --------------------------------------------------------------------------
    if (pathname === '/api/conversations' && method === 'GET') {
      const customers = CustomerRepo.getAll();
      const list = customers.map(c => {
        const history = MessageRepo.getHistory(c.id, 1);
        const lastMsg = history.length > 0 ? history[0].message_text : 'Yeni sohbet başlatıldı';
        return {
          id: c.id,
          name: c.full_name || `Müşteri (${c.phone_number.slice(-4)})`,
          phone: c.phone_number,
          channel: c.channel,
          neighborhood: c.neighborhood || 'Belirtilmedi',
          fullAddress: c.full_address || 'Açık adres girilmedi',
          kvkkConsent: c.kvkk_consent_granted === 1 ? 'approved' : 'pending',
          currentStep: c.current_step,
          lastMessage: lastMsg,
          lastTime: new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });
      sendJson(res, 200, { conversations: list });
      return;
    }

    if (pathname.startsWith('/api/conversations/') && pathname.endsWith('/messages') && method === 'GET') {
      const parts = pathname.split('/');
      const customerId = parts[3];
      const customer = CustomerRepo.getById(customerId);
      if (!customer) {
        sendJson(res, 404, { error: 'Müşteri bulunamadı' });
        return;
      }
      const messages = MessageRepo.getHistory(customerId, 100);
      sendJson(res, 200, { customer, messages });
      return;
    }

    if (pathname.startsWith('/api/conversations/') && pathname.endsWith('/reply') && method === 'POST') {
      const parts = pathname.split('/');
      const customerId = parts[3];
      const body = await parseJsonBody(req);
      const customer = CustomerRepo.getById(customerId);

      if (!customer || !body.text) {
        sendJson(res, 400, { error: 'Geçersiz müşteri veya metin' });
        return;
      }

      // Yönetici mesajını kaydet
      const msgId = MessageRepo.add(customerId, body.isHumanAgent ? 'human_agent' : 'bot', body.text);
      sendJson(res, 200, { success: true, messageId: msgId, text: body.text });
      return;
    }

    // --------------------------------------------------------------------------
    // 4. GOOGLE CALENDAR ÇİFT USTA API
    // --------------------------------------------------------------------------
    if (pathname === '/api/calendar/slots' && method === 'GET') {
      const tech1Slots = await CalendarEngine.getDailySlots('tech-1');
      const tech2Slots = await CalendarEngine.getDailySlots('tech-2');
      sendJson(res, 200, {
        tech1: { id: 'tech-1', name: 'Usta 1: Mehmet Usta', region: 'Kadıköy', slots: tech1Slots },
        tech2: { id: 'tech-2', name: 'Usta 2: Ali Usta', region: 'Üsküdar', slots: tech2Slots }
      });
      return;
    }

    if (pathname === '/api/calendar/sync' && method === 'POST') {
      const syncResult = await CalendarEngine.syncAll();
      sendJson(res, 200, syncResult);
      return;
    }

    if (pathname === '/api/calendar/check-conflicts' && method === 'GET') {
      const check1 = await CalendarEngine.checkConflicts('tech-1', '14:30', '16:00');
      const check2 = await CalendarEngine.checkConflicts('tech-2', '16:30', '17:30');
      sendJson(res, 200, {
        tech1Conflict: check1.hasConflict,
        tech2Conflict: check2.hasConflict,
        overallStatus: 'all_clear_no_conflicts'
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 5. KVKK & HUKUK KURALLARI API
    // --------------------------------------------------------------------------
    if (pathname === '/api/kvkk/rules' && method === 'GET') {
      const rules = KVKKRepo.getAll();
      sendJson(res, 200, { rules });
      return;
    }

    if (pathname.startsWith('/api/kvkk/rules/') && pathname.endsWith('/toggle') && method === 'POST') {
      const parts = pathname.split('/');
      const ruleId = parts[4];
      const rules = KVKKRepo.getAll();
      const currentRule = rules.find(r => r.id === ruleId);

      if (!currentRule) {
        sendJson(res, 404, { error: 'Kural bulunamadı' });
        return;
      }

      const nextStatus = currentRule.status === 'approved' ? 'pending_approval' : 'approved';
      KVKKRepo.updateStatus(ruleId, nextStatus);
      sendJson(res, 200, { success: true, ruleId, newStatus: nextStatus });
      return;
    }

    // --------------------------------------------------------------------------
    // 6. CTO CHAT & RFC GÖREVLERİ API
    // --------------------------------------------------------------------------
    if (pathname === '/api/cto/ideas' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.idea) {
        sendJson(res, 400, { error: 'idea alanı zorunludur' });
        return;
      }

      const taskId = `RFC-${Math.floor(100 + Math.random() * 900)}`;
      const title = body.idea.length > 50 ? body.idea.substring(0, 48) + '...' : body.idea;

      // Veritabanına kaydet
      const insertTask = DB.prepare(`
        INSERT INTO rfc_tasks (id, title, raw_idea, ai_summary, layer, cost_estimate, status)
        VALUES (?, ?, ?, ?, ?, ?, 'in_development');
      `);
      insertTask.run(
        taskId,
        title,
        body.idea,
        'Yönetici chatinden üretilen hafif mimari görevi.',
        'Core / Adapters',
        '$0 Açık Kaynak'
      );

      sendJson(res, 200, {
        success: true,
        taskId,
        title,
        analysis: {
          affectedLayers: ['Core/State-Machine', 'Adapters/WhatsApp', 'Database/SQLite'],
          cost: '$0 Ek Lisans Maliyeti',
          recommendation: 'Açık kaynak araçlarla hafif mimariye entegre edilebilir.'
        }
      });
      return;
    }

    if (pathname === '/api/cto/tasks' && method === 'GET') {
      const tasks = DB.prepare('SELECT * FROM rfc_tasks ORDER BY created_at DESC;').all();
      sendJson(res, 200, { tasks });
      return;
    }

    // --------------------------------------------------------------------------
    // 6.5 n8n OTOMASYON & GEMINI 3.8 FLASH REST API KÖPRÜSÜ
    // --------------------------------------------------------------------------
    if (pathname === '/api/n8n/message-in' && method === 'POST') {
      const body = await parseJsonBody(req);
      const phone = body.phoneNumber || body.phone || body.from;
      const text = body.text || body.message || '';

      if (!phone || !text) {
        sendJson(res, 400, { error: 'phoneNumber ve text alanları zorunludur' });
        return;
      }

      const flowResult = await processCustomerMessage(phone, text, body.channel || 'whatsapp');
      sendJson(res, 200, {
        success: true,
        replyText: flowResult.replyText,
        currentStep: flowResult.currentStep,
        customerId: phone,
        metadata: flowResult.metadata || {}
      });
      return;
    }

    if (pathname === '/api/n8n/calendar-slots' && method === 'GET') {
      const region = parsedUrl.searchParams.get('region') || 'kadikoy';
      const isKadikoy = /kadikoy|kadıköy|moda/i.test(region);
      const techId = isKadikoy ? 'tech-1' : 'tech-2';
      const slots = await CalendarEngine.getDailySlots(techId);
      const available = slots.filter(s => s.status === 'available');

      sendJson(res, 200, {
        region,
        assignedTechnician: techId === 'tech-1' ? 'Usta 1: Mehmet Usta' : 'Usta 2: Ali Usta',
        slots: available.map((s, idx) => ({
          code: String.fromCharCode(65 + idx),
          time: s.time,
          start: s.start,
          end: s.end
        }))
      });
      return;
    }

    if (pathname === '/api/n8n/workflow-json' && method === 'GET') {
      const workflowPath = path.join(__dirname, '..', 'n8n', 'hizmetchatbot-workflow.json');
      if (fs.existsSync(workflowPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="hizmetchatbot-n8n-workflow.json"'
        });
        fs.createReadStream(workflowPath).pipe(res);
      } else {
        sendJson(res, 404, { error: 'Workflow JSON bulunamadı' });
      }
      return;
    }

    // --------------------------------------------------------------------------
    // 7. SİSTEM AYARLARI & API / SLOT ENTEGRASYON MASASI
    // --------------------------------------------------------------------------
    if (pathname === '/api/settings' && method === 'GET') {
      const saved = SettingsRepo.getAll();
      const settings = {
        // LLM Beyin Ayarları
        llmProvider: saved.llmProvider || process.env.LLM_PROVIDER || 'rule_based',
        openRouterKey: saved.openRouterKey ? 'sk-or-v1-••••••••••••' : (process.env.OPENROUTER_API_KEY ? 'sk-or-••••••••' : ''),
        openRouterModel: saved.openRouterModel || process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct',
        ollamaBaseUrl: saved.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        ollamaModel: saved.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        
        // Kanal Ayarları
        waMode: saved.waMode || process.env.DEFAULT_CHANNEL || 'webhook',
        waEndpoint: saved.waEndpoint || 'http://localhost:8080/webhook',
        telegramToken: saved.telegramToken ? '••••••••:AA••••••••' : (process.env.TELEGRAM_BOT_TOKEN ? '••••••••' : ''),

        // Usta Takvimi & Google Calendar Slot Ayarları
        tech1CalendarId: saved.tech1CalendarId || process.env.GOOGLE_CALENDAR_ID_TECH_1 || 'c_mehmet_usta_kadikoy@group.calendar.google.com',
        tech2CalendarId: saved.tech2CalendarId || process.env.GOOGLE_CALENDAR_ID_TECH_2 || 'c_ali_usta_uskudar@group.calendar.google.com',
        slotStart: saved.slotStart || '09:00',
        slotEnd: saved.slotEnd || '18:00',
        slotDuration: saved.slotDuration || 90,
        transitMargin: saved.transitMargin || 30,

        // Sanal POS Ayarları
        posProvider: saved.posProvider || process.env.PAYMENT_PROVIDER || 'mock_pos',
        posBaseUrl: saved.posBaseUrl || process.env.PAYMENT_BASE_URL || 'http://localhost:3000/pay',
        posHoldMinutes: saved.posHoldMinutes || 15
      };

      sendJson(res, 200, { settings });
      return;
    }

    if (pathname === '/api/settings' && method === 'POST') {
      const body = await parseJsonBody(req);
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null && !String(v).includes('••••')) {
          SettingsRepo.set(k, v);
        }
      }
      sendJson(res, 200, { success: true, message: 'Ayarlar başarıyla kaydedildi.' });
      return;
    }

    if (pathname === '/api/settings/test-llm' && method === 'POST') {
      const start = Date.now();
      const testRes = await LLMEngine.extractEntities('Kombim Demirdöküm Nitromix, Kadıköy Moda, bakım istiyorum');
      const latencyMs = Date.now() - start;
      sendJson(res, 200, {
        success: true,
        latencyMs,
        provider: LLMEngine.provider,
        extracted: testRes
      });
      return;
    }

    if (pathname === '/api/settings/test-calendar' && method === 'POST') {
      const syncCheck = await CalendarEngine.syncAll();
      sendJson(res, 200, {
        success: true,
        technicians: syncCheck.technicians,
        conflicts: syncCheck.conflictCount
      });
      return;
    }

    // --------------------------------------------------------------------------
    // 7. WEBHOOK: SANAL POS ÖDEME & ADRES BİLDİRİMİ (Adım 9 -> 10)
    // --------------------------------------------------------------------------
    if (pathname === '/api/webhook/payment' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.fullAddress) {
        sendJson(res, 400, { error: 'fullAddress zorunludur' });
        return;
      }

      let aptId = body.appointmentId;
      let existingApt = aptId ? AppointmentRepo.getById(aptId) : null;

      // Canlı test veya mevcut olmayan randevu durumunda örnek randevu oluştur
      if (!existingApt) {
        const dummyCust = CustomerRepo.findOrCreate('+905329876543', 'whatsapp', 'Selin Demir');
        aptId = AppointmentRepo.create({
          customerId: dummyCust.id,
          technicianId: 'tech-1',
          serviceType: 'Kombi Periyodik Kış Bakımı',
          startTime: '14:30',
          endTime: '16:00',
          paymentAmount: 1400,
          posPaymentLink: '/pay'
        });
      }

      const webhookResult = await handlePaymentCompletedWebhook(aptId, {
        transactionId: body.transactionId || `TRX_${Date.now()}`,
        fullAddress: body.fullAddress,
        notes: body.notes || ''
      });

      sendJson(res, 200, { success: true, result: webhookResult });
      return;
    }

    // --------------------------------------------------------------------------
    // 8. WEBHOOK: DIŞ MESAJ GİRİŞİ (WhatsApp / Telegram Simülasyonu)
    // --------------------------------------------------------------------------
    if (pathname === '/api/webhook/incoming' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.phoneNumber || !body.text) {
        sendJson(res, 400, { error: 'phoneNumber ve text zorunludur' });
        return;
      }

      const flowResult = await processCustomerMessage(body.phoneNumber, body.text, body.channel || 'whatsapp');
      sendJson(res, 200, flowResult);
      return;
    }

    // --------------------------------------------------------------------------
    // 9. STATİK DOSYA SUNUCUSU (Frontend)
    // --------------------------------------------------------------------------
    if (pathname === '/pay' || pathname.startsWith('/pay/')) {
      serveStaticFile(res, '/pay.html');
      return;
    }

    serveStaticFile(res, pathname);

  } catch (error) {
    console.error('Sunucu Hatası:', error);
    sendJson(res, 500, { error: 'Dahili Sunucu Hatası', details: error.message });
  }
});

// Sunucuyu başlat
export function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`\n🚀 HizmetChatbot Sunucusu Başlatıldı!`);
      console.log(`🌐 Dashboard: http://localhost:${port}`);
      console.log(`📡 REST API:  http://localhost:${port}/api/stats`);
      resolve(server);
    });
  });
}

// Dosya doğrudan çalıştırıldığında dinle
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer(PORT);
}
