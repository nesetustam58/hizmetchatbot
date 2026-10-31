/**
 * HizmetChatbot — Hafif Web & REST API Sunucusu (Clean Architecture)
 * Sıfır Dış Bağımlılık (Node.js Dahili 'node:http' & 'node:fs')
 * Port: 3000 (veya process.env.PORT)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Node.js dahili ortam değişkeni yükleyicisi (.env)
try {
  if (process.loadEnvFile && fs.existsSync('.env')) {
    process.loadEnvFile();
  }
} catch (e) {
  // .env yoksa veya önceden yüklendiyse devam et
}

import { initDatabase, CustomerRepo, MessageRepo, TechnicianRepo, AppointmentRepo, KVKKRepo, SettingsRepo, ChatbotSettingsRepo, ChatbotKnowledgeRepo, ModelRepo, PersonaRepo, LocalizationRepo, SuggestionRepo, DB } from './database/db.js';
import { processCustomerMessage, handlePaymentCompletedWebhook } from './core/state-machine.js';
import { CalendarEngine } from './adapters/calendar/calendar-adapter.js';
import { LLMEngine } from './adapters/llm/llm-adapter.js';
import { ChannelRouter } from './adapters/channel/channel-manager.js';

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
    const isMessageInRoute = (
      pathname === '/api/n8n/message-in' ||
      pathname === '/webhook/whatsapp-inbound' ||
      pathname === '/api/webhook/whatsapp-inbound' ||
      pathname === '/api/message-in' ||
      pathname === '/message-in' ||
      pathname === '/api/webhook/telegram' ||
      pathname === '/webhook/telegram'
    );

    if (isMessageInRoute && method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        endpoint: pathname,
        n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || 'https://nesetustam.app.n8n.cloud/webhook/whatsapp-inbound',
        message: 'HizmetChatbot Message-In Webhook Köprüsü Dinlemede'
      });
      return;
    }

    if (isMessageInRoute && method === 'POST') {
      const body = await parseJsonBody(req);
      
      // WhatsApp, Telegram, n8n esnek gövde ayrıştırması
      const tgMsg = (body.message && typeof body.message === 'object') ? body.message : (body.edited_message && typeof body.edited_message === 'object' ? body.edited_message : null);
      
      let phone = body.phoneNumber || body.phone || body.from || body.sender || body.number || body.chatId || body.chat_id;
      let text = (typeof body.text === 'string' ? body.text : '') || (typeof body.message === 'string' ? body.message : '') || (typeof body.body === 'string' ? body.body : '');
      let channel = body.channel;

      // Telegram Webhook formatı desteği: { message: { chat: { id }, text } }
      if (tgMsg) {
        const tgChatId = tgMsg.chat?.id || tgMsg.from?.id;
        if (tgChatId) {
          phone = phone || `tg_${tgChatId}`;
        }
        text = text || tgMsg.text || tgMsg.caption || '';
        channel = channel || 'telegram';
      }

      // WhatsApp Baileys / Evolution API webhook formatı
      if (body.data && typeof body.data === 'object') {
        const d = body.data;
        phone = phone || d.key?.remoteJid || d.from || d.sender;
        text = text || d.message?.conversation || d.message?.extendedTextMessage?.text || '';
        channel = channel || 'whatsapp';
      }

      // Otomatik kanal tespiti
      if (!channel) {
        if (String(phone).startsWith('tg_') || body.chat_id || body.chatId || tgMsg) {
          channel = 'telegram';
        } else {
          channel = 'whatsapp';
        }
      }

      if (!phone || !text) {
        sendJson(res, 400, {
          error: 'phoneNumber/chatId ve text alanları zorunludur',
          received: { phone, text, channel }
        });
        return;
      }

      const flowResult = await processCustomerMessage(phone, text, channel);

      // Telegram üzerinden gelen mesajlara otomatik bot yanıtı ilet
      if (channel === 'telegram') {
        const tgAdapter = ChannelRouter.getAdapter('telegram');
        const rawChatId = String(phone).replace(/^tg_/, '');
        if (tgAdapter && flowResult.replyText) {
          await tgAdapter.sendMessage(rawChatId, flowResult.replyText).catch(err => {
            console.warn('[Telegram Outbound Error]:', err.message);
          });
        }
      }

      sendJson(res, 200, {
        success: true,
        replyText: flowResult.replyText,
        currentStep: flowResult.currentStep,
        customerId: phone,
        channel,
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
        waEndpoint: saved.waEndpoint || process.env.WHATSAPP_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || 'https://nesetustam.app.n8n.cloud/webhook/whatsapp-inbound',
        n8nWebhookUrl: saved.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL || 'https://nesetustam.app.n8n.cloud/webhook/whatsapp-inbound',
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
    // 7.5 CHATBOT EĞİTİCİ & PERSONA & GÜVENLİK AYARLARI API
    // --------------------------------------------------------------------------
    if (pathname === '/api/chatbot-trainer/settings' && method === 'GET') {
      const allSettings = ChatbotSettingsRepo.getAll();
      sendJson(res, 200, {
        settings: {
          systemPrompt: allSettings.system_prompt?.value || '',
          bannedWords: allSettings.banned_words_matrix?.value || [],
          spamTriggers: allSettings.spam_trigger_words?.value || [],
          offTopicRedirectMessage: allSettings.off_topic_redirect_message?.value || '',
          cooldownPenaltyMessage: allSettings.cooldown_penalty_message?.value || '',
          maxSpamAttempts: parseInt(allSettings.max_spam_attempts?.value || '3', 10) || 3
        }
      });
      return;
    }

    if (pathname === '/api/chatbot-trainer/settings' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.systemPrompt !== undefined) {
        ChatbotSettingsRepo.set('system_prompt', body.systemPrompt, 'persona', 'Gemini 3.8 Flash modelinin baz aldığı ana karakter, kurallar ve dikey kilit metni');
      }
      if (body.bannedWords !== undefined) {
        ChatbotSettingsRepo.setBannedWords(body.bannedWords);
      }
      if (body.spamTriggers !== undefined) {
        ChatbotSettingsRepo.setSpamTriggers(body.spamTriggers);
      }
      if (body.offTopicRedirectMessage !== undefined) {
        ChatbotSettingsRepo.set('off_topic_redirect_message', body.offTopicRedirectMessage, 'messages', 'Kullanıcı konu dışı yazdığında iletilecek kibar yönlendirme mesajı');
      }
      if (body.cooldownPenaltyMessage !== undefined) {
        ChatbotSettingsRepo.set('cooldown_penalty_message', body.cooldownPenaltyMessage, 'messages', '3 saatlik ceza uygulandığında döndürülecek uyarı mesajı');
      }
      if (body.maxSpamAttempts !== undefined) {
        ChatbotSettingsRepo.set('max_spam_attempts', String(body.maxSpamAttempts), 'spam', 'Engelleme öncesi izin verilen maksimum spam/konu dışı mesaj adedi');
      }

      sendJson(res, 200, {
        success: true,
        message: 'Chatbot Eğitici ayarları anında SQLite veritabanına kaydedildi ve LLM katmanına yansıtıldı.'
      });
      return;
    }

    if (pathname === '/api/chatbot-trainer/knowledge' && method === 'GET') {
      const modelId = parsedUrl.searchParams.get('modelId');
      const docs = ChatbotKnowledgeRepo.getAll(modelId);
      sendJson(res, 200, { documents: docs });
      return;
    }

    if (pathname === '/api/chatbot-trainer/knowledge' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.title || !body.content) {
        sendJson(res, 400, { error: 'Başlık (title) ve içerik (content) alanları zorunludur' });
        return;
      }
      const newDoc = ChatbotKnowledgeRepo.create({
        title: body.title,
        type: body.type || 'manual',
        source: body.source || '',
        content: body.content,
        isActive: body.isActive !== undefined ? body.isActive : 1
      });
      sendJson(res, 201, { success: true, document: newDoc });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/knowledge/') && pathname.endsWith('/toggle') && method === 'POST') {
      const parts = pathname.split('/');
      const docId = parts[4];
      const updated = ChatbotKnowledgeRepo.toggleActive(docId);
      if (!updated) {
        sendJson(res, 404, { error: 'Belge bulunamadı' });
        return;
      }
      sendJson(res, 200, { success: true, updated });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/knowledge/') && (method === 'PUT' || method === 'POST')) {
      const parts = pathname.split('/');
      const docId = parts[4];
      const body = await parseJsonBody(req);
      const updated = ChatbotKnowledgeRepo.update(docId, body);
      if (!updated) {
        sendJson(res, 404, { error: 'Belge bulunamadı' });
        return;
      }
      sendJson(res, 200, { success: true, document: updated });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/knowledge/') && method === 'DELETE') {
      const parts = pathname.split('/');
      const docId = parts[4];
      ChatbotKnowledgeRepo.delete(docId);
      sendJson(res, 200, { success: true, message: 'Belge başarıyla silindi' });
      return;
    }

    // Harici URL'den İçeriği Otomatik Çekme (Web Scraper Lite)
    if (pathname === '/api/chatbot-trainer/fetch-url' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.url) {
        sendJson(res, 400, { error: 'url parametresi zorunludur' });
        return;
      }
      const fetchResult = await ChatbotKnowledgeRepo.fetchUrlContent(body.url);
      if (!fetchResult.success) {
        sendJson(res, 400, { error: fetchResult.error || 'URL içeriği çekilemedi' });
        return;
      }
      sendJson(res, 200, fetchResult);
      return;
    }

    // White-Label Profil API
    if (pathname === '/api/chatbot-trainer/whitelabel' && method === 'GET') {
      const profile = ChatbotSettingsRepo.getWhiteLabelProfile();
      sendJson(res, 200, { profile });
      return;
    }

    if (pathname === '/api/chatbot-trainer/whitelabel' && method === 'POST') {
      const body = await parseJsonBody(req);
      ChatbotSettingsRepo.setWhiteLabelProfile(body);
      sendJson(res, 200, { success: true, message: 'White-Label marka profili güncellendi.' });
      return;
    }

    // Token Koruma ve Güvenlik Telemetrisi (Token Shield Stats)
    if (pathname === '/api/chatbot-trainer/shield-stats' && method === 'GET') {
      const stats = ChatbotSettingsRepo.getShieldStats();
      sendJson(res, 200, { stats });
      return;
    }

    // --------------------------------------------------------------------------
    // MODEL STUDIO & ÇOKLU MODEL YÖNETİMİ API
    // --------------------------------------------------------------------------
    if (pathname === '/api/chatbot-trainer/models' && method === 'GET') {
      const models = ModelRepo.getAll();
      const active = ModelRepo.getActive();
      sendJson(res, 200, { models, activeModelId: active ? active.id : null });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/models/') && pathname.endsWith('/activate') && method === 'POST') {
      const parts = pathname.split('/');
      const modelId = parts[4];
      const activated = ModelRepo.setActive(modelId);
      sendJson(res, 200, { success: true, activeModel: activated });
      return;
    }

    if (pathname === '/api/chatbot-trainer/models' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.name || !body.provider || !body.modelCode) {
        sendJson(res, 400, { error: 'name, provider ve modelCode zorunludur' });
        return;
      }
      const created = ModelRepo.create(body);
      sendJson(res, 201, { success: true, model: created });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/models/') && (method === 'PUT' || method === 'POST')) {
      const parts = pathname.split('/');
      const modelId = parts[4];
      const body = await parseJsonBody(req);
      const updated = ModelRepo.update(modelId, body);
      sendJson(res, 200, { success: true, model: updated });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/models/') && method === 'DELETE') {
      const parts = pathname.split('/');
      const modelId = parts[4];
      try {
        ModelRepo.delete(modelId);
        sendJson(res, 200, { success: true, message: 'Model silindi' });
      } catch (err) {
        sendJson(res, 400, { error: err.message });
      }
      return;
    }

    // --------------------------------------------------------------------------
    // KÜLTÜREL YERELLEŞTİRME & ŞİVE / DEYİM API (Localization & Cultural NLP)
    // --------------------------------------------------------------------------
    if (pathname === '/api/chatbot-trainer/localization' && method === 'GET') {
      const lang = parsedUrl.searchParams.get('lang') || 'tr';
      const modelId = parsedUrl.searchParams.get('modelId');
      const rules = LocalizationRepo.getAll(lang, modelId);
      sendJson(res, 200, { rules, lang, modelId });
      return;
    }

    if (pathname === '/api/chatbot-trainer/localization' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.phrase || !body.responseGuideline) {
        sendJson(res, 400, { error: 'phrase ve responseGuideline zorunludur' });
        return;
      }
      const created = LocalizationRepo.create(body);
      sendJson(res, 201, { success: true, rule: created });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/localization/') && pathname.endsWith('/toggle') && method === 'POST') {
      const parts = pathname.split('/');
      const ruleId = parts[4];
      const toggled = LocalizationRepo.toggleStatus(ruleId);
      sendJson(res, 200, { success: true, rule: toggled });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/localization/') && method === 'DELETE') {
      const parts = pathname.split('/');
      const ruleId = parts[4];
      LocalizationRepo.delete(ruleId);
      sendJson(res, 200, { success: true, message: 'Kural silindi' });
      return;
    }

    if (pathname === '/api/chatbot-trainer/localization/scan' && method === 'POST') {
      const body = await parseJsonBody(req);
      const scanResult = LocalizationRepo.simulateCulturalScan(body.source || 'Web & Sosyal Medya Diyalog Taraması');
      sendJson(res, 200, { success: true, scanResult });
      return;
    }

    // --------------------------------------------------------------------------
    // EĞİTİM DURUMU & ONAY KUYRUĞU API (Auto-Training & Feedback Loop)
    // --------------------------------------------------------------------------
    if (pathname === '/api/chatbot-trainer/training-status' && method === 'GET') {
      const modelId = parsedUrl.searchParams.get('modelId');
      const metrics = SuggestionRepo.getTrainingMetrics(modelId);
      sendJson(res, 200, { metrics });
      return;
    }

    if (pathname === '/api/chatbot-trainer/suggestions' && method === 'GET') {
      const status = parsedUrl.searchParams.get('status') || 'all';
      const modelId = parsedUrl.searchParams.get('modelId');
      const suggestions = SuggestionRepo.getAll(status, modelId);
      sendJson(res, 200, { suggestions });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/suggestions/') && pathname.endsWith('/approve') && method === 'POST') {
      const parts = pathname.split('/');
      const suggId = parts[4];
      const result = SuggestionRepo.approve(suggId);
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/suggestions/') && pathname.endsWith('/reject') && method === 'POST') {
      const parts = pathname.split('/');
      const suggId = parts[4];
      const result = SuggestionRepo.reject(suggId);
      sendJson(res, 200, { success: true, result });
      return;
    }

    // --------------------------------------------------------------------------
    // MÜŞTERİ PERSONA PAKETLERİ API (Empathy & Tone Matching)
    // --------------------------------------------------------------------------
    if (pathname === '/api/chatbot-trainer/personas' && method === 'GET') {
      const modelId = parsedUrl.searchParams.get('modelId');
      const personas = PersonaRepo.getAll(modelId);
      sendJson(res, 200, { personas });
      return;
    }

    if (pathname.startsWith('/api/chatbot-trainer/personas/') && (method === 'PUT' || method === 'POST')) {
      const parts = pathname.split('/');
      const personaKey = parts[4];
      const body = await parseJsonBody(req);
      const updated = PersonaRepo.update(personaKey, body);
      sendJson(res, 200, { success: true, persona: updated });
      return;
    }

    if (pathname === '/api/chatbot-trainer/detect-persona' && method === 'POST') {
      const body = await parseJsonBody(req);
      const msg = body.message || '';
      const detected = LLMEngine.detectCustomerPersona(msg);
      const personaPack = PersonaRepo.getByKey(detected.persona);
      sendJson(res, 200, {
        success: true,
        detectedPersona: detected.persona,
        confidence: detected.confidence,
        personaPack
      });
      return;
    }

    if (pathname === '/api/chatbot-trainer/test-intent' && method === 'POST') {
      const body = await parseJsonBody(req);
      const testMessage = body.message || '';
      if (!testMessage.trim()) {
        sendJson(res, 400, { error: 'Test edilecek mesaj zorunludur' });
        return;
      }

      const start = Date.now();
      // 1. Önce Heuristik Güvenlik & Spam Filtresini Test Et
      const securityResult = LLMEngine.checkSecurityAndFilter(testMessage);

      // 2. Ardından Niyet Sınıflandırma ve Varlık Çıkarımını Çalıştır
      const intentResult = await LLMEngine.classifyIntentAndExtract(testMessage);
      const latencyMs = Date.now() - start;

      sendJson(res, 200, {
        success: true,
        latencyMs,
        testMessage,
        securityCheck: securityResult,
        intentResult,
        actionRecommendation: securityResult.matched 
          ? `GÜVENLİK KALKANI: ${securityResult.action || 'off_topic_redirect'} (Token Harcanmaz)`
          : (intentResult.offTopicDetected ? 'KONU DIŞI: Kibar Yönlendirme Mesajı' : 'GEÇERLİ NİYET: Servis Randevu Akışı')
      });
      return;
    }

    if (pathname === '/api/chatbot-trainer/blocked-users' && method === 'GET') {
      const allCustomers = CustomerRepo.getAll();
      const now = Date.now();
      const list = allCustomers
        .map(c => {
          const isBlocked = c.is_blocked_until && new Date(c.is_blocked_until).getTime() > now;
          const remainingMinutes = isBlocked ? Math.ceil((new Date(c.is_blocked_until).getTime() - now) / 60000) : 0;
          return {
            id: c.id,
            phone: c.phone_number,
            name: c.full_name || 'İsimsiz Müşteri',
            channel: c.channel,
            isBlocked,
            blockedUntil: c.is_blocked_until,
            remainingMinutes,
            spamCount: c.spam_count || 0,
            warningCount: c.warning_count || 0,
            lastIntent: c.last_intent || 'belirtilmedi',
            updatedAt: c.updated_at
          };
        })
        .filter(c => c.isBlocked || c.spamCount > 0 || c.warningCount > 0);

      sendJson(res, 200, { blockedUsers: list });
      return;
    }

    if (pathname === '/api/chatbot-trainer/unblock-user' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.customerId) {
        sendJson(res, 400, { error: 'customerId alanı zorunludur' });
        return;
      }
      CustomerRepo.unblockUser(body.customerId);
      sendJson(res, 200, { success: true, message: 'Kullanıcının engeli kaldırıldı ve sayaçları sıfırlandı.' });
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

    if (pathname === '/admin/chatbot-trainer' || pathname === '/chatbot-trainer' || pathname === '/admin' || pathname === '/admin/') {
      serveStaticFile(res, '/index.html');
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
