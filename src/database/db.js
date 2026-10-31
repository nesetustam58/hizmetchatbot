/**
 * Hafif Veritabanı Modülü — HizmetChatbot
 * Sıfır Dış Bağımlılık (Node.js Dahili 'node:sqlite' - WAL Modu)
 * Clean Architecture & Repository Deseni
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DATABASE_PATH || './data/hizmetchatbot.sqlite';

// Dizin varlığını garantiye al
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Veritabanı bağlantısı (Singleton)
const db = new DatabaseSync(DB_PATH);

// Yüksek performans ve veri bütünlüğü ayarları
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');

/**
 * Tabloları oluşturur ve varsayılan verileri tohumlar
 */
export function initDatabase() {
  db.exec(`
    -- 1. Müşteriler & KVKK Kayıtları
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      full_name TEXT,
      channel TEXT DEFAULT 'whatsapp',
      neighborhood TEXT,
      full_address TEXT,
      kvkk_consent_granted INTEGER DEFAULT 0, -- 1: Onay, 0: Bekliyor, -1: Red
      kvkk_consent_date DATETIME,
      current_step INTEGER DEFAULT 1,         -- 10 adımlık State Machine konumu
      temp_data TEXT DEFAULT '{}',            -- Seçilen hizmet, slot vb. ara durum verisi
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Usta Tanımları (2 Usta)
    CREATE TABLE IF NOT EXISTS technicians (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      google_calendar_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',           -- 'active' | 'busy' | 'off_duty'
      assigned_region TEXT,
      current_task TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Randevular & Servis Siparişleri
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      technician_id TEXT REFERENCES technicians(id),
      service_type TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT DEFAULT 'pending_payment',  -- 'pending_payment' | 'confirmed' | 'completed' | 'cancelled'
      google_event_id TEXT,
      payment_status TEXT DEFAULT 'unpaid',   -- 'unpaid' | 'paid' | 'refunded'
      payment_amount REAL NOT NULL,
      pos_payment_link TEXT,
      pos_transaction_id TEXT,
      customer_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Sohbet Mesajları & Konuşma Geçmişi
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      sender TEXT NOT NULL,                  -- 'customer' | 'bot' | 'human_agent'
      message_text TEXT NOT NULL,
      raw_payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Hukuk & KVKK Onay Kural Setleri
    CREATE TABLE IF NOT EXISTS kvkk_rules (
      id TEXT PRIMARY KEY,
      rule_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      law_reference TEXT,
      description TEXT NOT NULL,
      system_action TEXT NOT NULL,
      status TEXT DEFAULT 'approved',         -- 'approved' | 'pending_approval' | 'rejected'
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. CTO Chat & İş Geliştirme RFC Görevleri
    CREATE TABLE IF NOT EXISTS rfc_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      raw_idea TEXT NOT NULL,
      ai_summary TEXT NOT NULL,
      layer TEXT,
      cost_estimate TEXT,
      status TEXT DEFAULT 'in_development',   -- 'in_development' | 'tested' | 'deployed'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Sistem & API / Slot Ayarları Masası
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedInitialData();
}

/**
 * İlk kurulumda 2 usta ve temel KVKK kurallarını veritabanına ekler
 */
function seedInitialData() {
  // 1. Usta Kontrolü
  const techCount = db.prepare('SELECT COUNT(*) as count FROM technicians;').get().count;
  if (techCount === 0) {
    const insertTech = db.prepare(`
      INSERT INTO technicians (id, name, phone, google_calendar_id, status, assigned_region, current_task)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `);

    insertTech.run(
      'tech-1',
      'Usta 1: Mehmet Usta',
      '+90 532 111 2233',
      'c_mehmet_usta_kadikoy@group.calendar.google.com',
      'active',
      'Kadıköy (Moda - Fenerbahçe - Bostancı)',
      'Moda Cad. Periyodik Kombi Bakımında'
    );

    insertTech.run(
      'tech-2',
      'Usta 2: Ali Usta',
      '+90 533 444 5566',
      'c_ali_usta_uskudar@group.calendar.google.com',
      'busy',
      'Üsküdar (Acıbadem - Koşuyolu - Altunizade)',
      'Acıbadem Mah. Petek Temizliği Servisinde'
    );
  }

  // 2. KVKK Kuralları Kontrolü
  const ruleCount = db.prepare('SELECT COUNT(*) as count FROM kvkk_rules;').get().count;
  if (ruleCount === 0) {
    const insertRule = db.prepare(`
      INSERT INTO kvkk_rules (id, rule_key, title, law_reference, description, system_action, status, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);

    insertRule.run(
      'rule-spam-frequency',
      'spam_frequency_guard',
      'Spam Koruması & Mesaj Frekans Sınırı',
      '6563 s. Elektronik Ticaret Kanunu m.6',
      'Müşteriye aynı gün içinde açık rıza olmaksızın 2\'den fazla hatırlatma mesajı atılamaz. 21:00-09:00 arası otomatik mesaj bloke edilir.',
      'Outbound kuyruk filtresinde rate-limit uygular.',
      'approved',
      new Date().toISOString()
    );

    insertRule.run(
      'rule-opt-in-first-contact',
      'first_contact_consent',
      'İlk Temas Açık Rıza Metni',
      '6698 s. KVKK m.5/1',
      'Hizmet menüsü öncesinde aydınlatma ve açık rıza onayı zorunludur.',
      'State machine State 0 -> State 1 geçiş kilidi.',
      'approved',
      new Date().toISOString()
    );

    insertRule.run(
      'rule-auto-opt-out',
      'auto_opt_out_regex',
      'Otomatik Opt-out / RET Kelime Kalkanı',
      '6563 s. Kanun m.8 (Alıcının Reddetme Hakkı)',
      'Müşteri RET, İPTAL, ÇIK yazdığında bot anında durur ve numarayı DND listesine alır.',
      'Inbound webhook en yüksek öncelikli regex kesmesi.',
      'approved',
      new Date().toISOString()
    );
  }
}

// ==============================================================================
// REPOSITORY METOTLARI (Clean Code API)
// ==============================================================================

export const CustomerRepo = {
  findOrCreate(phoneNumber, channel = 'whatsapp', fullName = '') {
    const findStmt = db.prepare('SELECT * FROM customers WHERE phone_number = ?;');
    let customer = findStmt.get(phoneNumber);

    if (!customer) {
      const id = 'cust_' + Math.random().toString(36).substring(2, 10);
      const insertStmt = db.prepare(`
        INSERT INTO customers (id, phone_number, full_name, channel, current_step, temp_data)
        VALUES (?, ?, ?, ?, 1, '{}');
      `);
      insertStmt.run(id, phoneNumber, fullName, channel);
      customer = findStmt.get(phoneNumber);
    }

    return customer;
  },

  getById(id) {
    return db.prepare('SELECT * FROM customers WHERE id = ?;').get(id);
  },

  getByPhone(phoneNumber) {
    return db.prepare('SELECT * FROM customers WHERE phone_number = ?;').get(phoneNumber);
  },

  updateStep(id, step, tempData = null) {
    if (tempData !== null) {
      const updateStmt = db.prepare(`
        UPDATE customers 
        SET current_step = ?, temp_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
      `);
      updateStmt.run(step, JSON.stringify(tempData), id);
    } else {
      const updateStmt = db.prepare(`
        UPDATE customers 
        SET current_step = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
      `);
      updateStmt.run(step, id);
    }
  },

  updateConsent(id, status) {
    const updateStmt = db.prepare(`
      UPDATE customers 
      SET kvkk_consent_granted = ?, kvkk_consent_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `);
    updateStmt.run(status ? 1 : -1, id);
  },

  updateDetails(id, { fullName, neighborhood, fullAddress }) {
    const updateStmt = db.prepare(`
      UPDATE customers 
      SET full_name = COALESCE(?, full_name),
          neighborhood = COALESCE(?, neighborhood),
          full_address = COALESCE(?, full_address),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `);
    updateStmt.run(fullName || null, neighborhood || null, fullAddress || null, id);
  },

  getAll() {
    return db.prepare('SELECT * FROM customers ORDER BY updated_at DESC;').all();
  }
};

export const MessageRepo = {
  add(customerId, sender, messageText, rawPayload = null) {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const insertStmt = db.prepare(`
      INSERT INTO chat_messages (id, customer_id, sender, message_text, raw_payload)
      VALUES (?, ?, ?, ?, ?);
    `);
    insertStmt.run(id, customerId, sender, messageText, rawPayload ? JSON.stringify(rawPayload) : null);
    return id;
  },

  getHistory(customerId, limit = 50) {
    return db.prepare(`
      SELECT * FROM chat_messages 
      WHERE customer_id = ? 
      ORDER BY created_at ASC 
      LIMIT ?;
    `).all(customerId, limit);
  }
};

export const TechnicianRepo = {
  getAll() {
    return db.prepare('SELECT * FROM technicians;').all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM technicians WHERE id = ?;').get(id);
  },

  updateStatus(id, status, currentTask = null) {
    const updateStmt = db.prepare(`
      UPDATE technicians 
      SET status = ?, current_task = COALESCE(?, current_task)
      WHERE id = ?;
    `);
    updateStmt.run(status, currentTask, id);
  }
};

export const AppointmentRepo = {
  create({ customerId, technicianId, serviceType, startTime, endTime, paymentAmount, posPaymentLink }) {
    const id = 'apt_' + Date.now();
    const insertStmt = db.prepare(`
      INSERT INTO appointments (
        id, customer_id, technician_id, service_type, start_time, end_time,
        payment_amount, pos_payment_link, status, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'unpaid');
    `);
    insertStmt.run(
      id, customerId, technicianId, serviceType, startTime, endTime,
      paymentAmount, posPaymentLink
    );
    return id;
  },

  getById(id) {
    return db.prepare('SELECT * FROM appointments WHERE id = ?;').get(id);
  },

  updatePayment(id, { posTransactionId, fullAddress, customerNotes }) {
    const updateStmt = db.prepare(`
      UPDATE appointments 
      SET payment_status = 'paid', 
          status = 'confirmed',
          pos_transaction_id = ?,
          customer_notes = ?
      WHERE id = ?;
    `);
    updateStmt.run(posTransactionId, customerNotes || null, id);
  },

  getAll() {
    return db.prepare(`
      SELECT a.*, c.full_name as customer_name, c.phone_number, t.name as technician_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN technicians t ON a.technician_id = t.id
      ORDER BY a.created_at DESC;
    `).all();
  }
};

export const KVKKRepo = {
  getAll() {
    return db.prepare('SELECT * FROM kvkk_rules ORDER BY created_at ASC;').all();
  },

  updateStatus(id, status) {
    const updateStmt = db.prepare(`
      UPDATE kvkk_rules 
      SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = ?;
    `);
    updateStmt.run(status, status, id);
  }
};

export const SettingsRepo = {
  get(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?;').get(key);
    return row ? row.value : defaultValue;
  },

  set(key, value) {
    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;
    `);
    stmt.run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  },

  getAll() {
    const rows = db.prepare('SELECT key, value FROM system_settings;').all();
    const map = {};
    for (const r of rows) {
      try {
        map[r.key] = JSON.parse(r.value);
      } catch (e) {
        map[r.key] = r.value;
      }
    }
    return map;
  }
};

export const DB = db;
