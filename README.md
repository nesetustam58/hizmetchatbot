# 🛠️ HizmetChatbot — Otonom Kombi & Klima Bakım Servisi Sistemi

> **Hafif (Lightweight), Modüler, Kanal & Model Bağımsız, Sıfır Dış Lisans Maliyetli Saha Operasyon Chatbotu ve Yönetim Paneli**

---

## 📌 1. Proje Vizyonu ve Mimari İlkeler

`hizmetchatbot`, yerel bir bölgede (örneğin Kadıköy / Üsküdar hattı) **2 mobil usta** ile çalışan kombi ve klima bakım/onarım operasyonunu uçtan uca otomatikleştiren hibrit bir yapay zekâ ve mesajlaşma ekosistemidir.

### Temel Mimari Prensipler
1. **Lightweight & Low Footprint:** Minimum bellek ve CPU ayak izi. Sunucu maliyetini sıfıra yakın tutan Node.js / SQLite mimarisi (ihtiyaç halinde PostgreSQL'e tek bayrakla geçiş).
2. **Kanal Bağımsızlığı (Channel-Agnostic):** Sohbet çekirdeği; WhatsApp Web soketi (Baileys), self-hosted Evolution API, WPPConnect veya Telegram Bot API adaptörlerine bağımsız bir `MessageAdapter` arabirimi üzerinden bağlanır.
3. **Model Bağımsızlığı (LLM-Agnostic):** `LLMBrainAdapter` üzerinden tek satır yapılandırmayla OpenRouter (Qwen, Llama 3, DeepSeek, Mistral), yerel Ollama veya vLLM uç noktaları arasında geçiş yapılır. Model kilitlenmesi (vendor lock-in) yoktur.
4. **Hukuk & KVKK Katmanı:** Türkiye 6698 sayılı KVKK ve Ticari İletişim Yönetmeliği'ne tam uyumluluk. Spam önleyici mesaj frekans denetleyicisi, dinamik açık rıza kayıt sistemi ve insan onaylı kural motoru.
5. **Akıllı Randevu ve Çift Usta Senkronizasyonu:** Müşterinin seçtiği tarih/saat, 2 ustanın Google Calendar takvimleriyle gerçek zamanlı sorgulanır; çakışma önleyici algoritma (conflict resolver) boş slotu tahsis eder.
6. **Sıfır Lisans Maliyeti:** CDN bağımlılığı olmayan, inline SVG'lerle çalışan saf CSS/JS Material Design yönetim paneli; açık kaynaklı altyapı kütüphaneleri.

---

## 🏛️ 2. Sistem Mimarisi (ASCII Diyagramı)

```
=============================================================================================
                                   HİZMETCHATBOT MİMARİSİ
=============================================================================================

 [ MÜŞTERİ KANALLARI ]
  +------------------+          +------------------+
  |   WhatsApp User  |          |  Telegram User   |
  +--------+---------+          +--------+---------+
           |                             |
           v                             v
  +------------------------------------------------+
  |            KANAL ADAPTÖR KATMANI               |
  |  - Baileys (WA Multi-Device Socket)            |
  |  - Evolution API / WPPConnect Webhook          |
  |  - Telegraf / Telegram Bot API                 |
  +-----------------------+------------------------+
                          |
                          v (Unified Inbound Message Event)
  +------------------------------------------------+
  |            KVKK & GÜVENLİK FİLTRESİ            |
  |  - Açık Rıza Durum Kontrolü (Opt-in Check)     |
  |  - Rate Limiting & Anti-Spam Frequency Filter  |
  |  - Kara Liste / Opt-out ("RET", "İPTAL")       |
  +-----------------------+------------------------+
                          |
                          v
  +------------------------------------------------+
  |            DİYALOG & DURUM YÖNETİCİSİ          |
  |                 (State Machine)                |
  |  Adımlar: Karşılama -> Hizmet -> Semt ->       |
  |           Slot Seçimi -> POS Linki -> Onay     |
  +-----------+------------------------+-----------+
              |                        |
              v                        v
  +-----------------------+  +---------------------+
  |   MODEL-AGNOSTIC LLM  |  |   USTA TAKVİM MOTORU|
  |   (Akıllı Yanıt &     |  |   (Google Calendar  |
  |    Adres Ayrıştırma)  |  |    v3 Çift Usta     |
  |  - OpenRouter         |  |    Slot & Conflict  |
  |  - Ollama (Local)     |  |    Manager)         |
  |  - vLLM Endpoint      |  +----------+----------+
  +-----------+-----------+             |
              |                         |
              +------------+------------+
                           |
                           v
  +------------------------------------------------+
  |               VERİTABANI KATMANI               |
  |  - SQLite (WAL Mode, Sıfır Maliyetli / Hafif)  |
  |  - Alternatif: PostgreSQL Adapter              |
  |  - Müşteriler, Konuşma Logları, Randevular,     |
  |    Usta Durumları, KVKK İzin Kayıtları         |
  +-----------------------+------------------------+
                          |
                          v
  +------------------------------------------------+
  |        ADMIN DASHBOARD (Web & Socket API)      |
  |  - Google Material Design 3 (Pure HTML/CSS/JS) |
  |  - Canlı Sohbet İzleme & Usta Takip Haritası   |
  |  - Hukuk Departmanı KVKK Kural Onaylama        |
  |  - CTO Chat & İş Geliştirme AI RFC Paneli      |
  +------------------------------------------------+
=============================================================================================
```

---

## 🔄 3. Müşteri Uçtan Uca 10 Adımlık İşleyiş Akışı

```
[1. Müşteri]   ---> WhatsApp hattına ilk mesajı atar ("Merhaba kombi çalışmıyor").
[2. Sistem]    ---> KVKK açık rıza kontrolü yapar; onay metni + Hizmet Seçim Menüsü gönderir.
                     (1- Periyodik Bakım, 2- Arıza / Onarım, 3- Petek Temizliği)
[3. Müşteri]   ---> Hizmeti seçer ("1").
[4. Sistem]    ---> Bölge kontrolü için semt/mahalle veya canlı konum ister.
[5. Müşteri]   ---> Konumunu yazar ("Kadıköy Moda").
[6. Sistem]    ---> Google Calendar üzerinden 2 ustanın takvimini tarar; en erken boş 3 slotu sunar.
                     (A: Yarın 10:00 - Usta 1 | B: Yarın 14:30 - Usta 2 | C: Cumartesi 11:00)
[7. Müşteri]   ---> Slotu seçer ("A").
[8. Sistem]    ---> Takvimde ilgili slotu "Ön Rezervasyon (15 dk kilitli)" olarak işaretler.
                     Sanal POS tek kullanımlık dinamik ödeme linkini oluşturur ve iletir.
[9. Müşteri]   ---> Linke tıklar; ödeme sayfasında açık adresini ve notunu yazarak kartla öder.
[10. Sistem]   ---> Webhook ödeme onayını alır:
                     a) Google Calendar'da slotu "KESİNLEŞTİ" durumuna çeker.
                     b) Müşteriye WhatsApp'tan randevu özetini ve fişini gönderir.
                     c) Randevu günü sabahı ve 1 saat kala müşteriye hatırlatma iletir.
                     d) Usta yola çıktığında WhatsApp üzerinden usta canlı konum takip linki paylaşır.
```

---

## 🧩 4. Modüler Katmanlar ve Entegrasyonlar

### A. Kanal Adaptörü (`ChannelAdapter`)
- Soyut sınıf: `sendMessage(to, text, options)`, `onMessage(handler)`
- **WhatsApp Baileys:** Harici sunucu gerektirmeyen, doğrudan Node.js içinde çalışan QR kodlu soket istemcisi.
- **Evolution API / WPPConnect:** Docker üzerinde çalışan mikroservis opsiyonu.
- **Telegram Bot API:** `@BotFather` tokenı ile anında yedek veya test kanalı olarak aktifleşebilir.

### B. LLM Beyin Katmanı (`LLMBrainAdapter`)
- JSON-Schema temelli istem yapılandırması (Structured Output).
- Fonksiyon çağırma (Function Calling / Tool Use) desteği:
  - `check_calendar_slots(date, region)`
  - `book_appointment_slot(technician_id, timeslot, customer_data)`
  - `generate_payment_link(amount, service_code, customer_phone)`
  - `detect_kvkk_consent(message_text)`

### C. 2 Usta Google Calendar Senkronizasyonu
- Servis Hesabı (Google Cloud Service Account `credentials.json`) üzerinden OAuth gerektirmeyen arka plan senkronizasyonu.
- **Usta 1 Takvimi:** `calendar_id_1@group.calendar.google.com` (Mehmet Usta - Anadolu Yakası Kuzey)
- **Usta 2 Takvimi:** `calendar_id_2@group.calendar.google.com` (Ali Usta - Anadolu Yakası Güney)
- **Çakışma Önleyici (Conflict Resolver):** İki usta da meşgulse alternatif saat aralıkları hesaplanır; randevular arasında 30 dakika yol emniyet payı otomatik bırakılır.

### D. Hukuk & KVKK Yönetim Motoru
- **Açık Rıza Takibi:** Müşteri ilk mesajında 6698 s. Kanun m.5/1 uyarınca açık rıza vermeden ticari pazarlama yapılamaz.
- **Opt-out Mekanizması:** "RED", "IPTAL", "CIK" mesajları regex ile algılanıp numarayı derhal `do_not_disturb` listesine alır.
- **Toplu Mesaj Kalkanı:** Chatbot motoru yöneticinin doğrudan toplu bildirim atmasını engeller; her kampanya şablonu hukuk panelinde onaylanmak zorundadır.

---

## 🗄️ 5. Veritabanı Şeması (SQLite / PostgreSQL Agnostic)

```sql
-- 1. Müşteriler & KVKK Durumları
CREATE TABLE customers (
    id TEXT PRIMARY KEY,               -- UUID veya E.164 Telefon No (+905551234567)
    phone_number TEXT UNIQUE NOT NULL,
    full_name TEXT,
    channel TEXT DEFAULT 'whatsapp',    -- 'whatsapp' | 'telegram'
    neighborhood TEXT,                 -- İlçe / Semt
    full_address TEXT,
    kvkk_consent_granted INTEGER DEFAULT 0, -- 1: Onaylandı, 0: Bekliyor, -1: Red
    kvkk_consent_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Usta Tanımları
CREATE TABLE technicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    google_calendar_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',      -- 'active' | 'busy' | 'off_duty'
    assigned_region TEXT,              -- 'Kadikoy-Uskudar' | 'Maltepe-Kadikoy'
    current_lat REAL,
    current_lng REAL
);

-- 3. Randevular & Servis Siparişleri
CREATE TABLE appointments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    technician_id TEXT REFERENCES technicians(id),
    service_type TEXT NOT NULL,        -- 'kombi_bakim' | 'ariza' | 'petek_temizlik'
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending_payment', -- 'pending_payment'|'confirmed'|'in_progress'|'completed'|'cancelled'
    google_event_id TEXT,
    payment_status TEXT DEFAULT 'unpaid',  -- 'unpaid' | 'paid' | 'refunded'
    payment_amount REAL NOT NULL,
    pos_payment_link TEXT,
    pos_transaction_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sohbet Mesaj Günlükleri & AI Belleği
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    sender TEXT NOT NULL,              -- 'customer' | 'bot' | 'human_agent'
    message_text TEXT NOT NULL,
    raw_payload TEXT,                  -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Hukuk & KVKK Kural Setleri (Admin Onaylı)
CREATE TABLE kvkk_rules (
    id TEXT PRIMARY KEY,
    rule_key TEXT UNIQUE NOT NULL,     -- 'spam_throttle_interval', 'opt_out_keywords'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    rule_value TEXT NOT NULL,          -- JSON veya Regex metni
    status TEXT DEFAULT 'pending_review', -- 'approved' | 'pending_review' | 'rejected'
    approved_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. CTO Chat & İş Geliştirme RFC Görevleri
CREATE TABLE rfc_tasks (
    id TEXT PRIMARY KEY,
    raw_idea TEXT NOT NULL,
    ai_summary TEXT NOT NULL,
    impact_level TEXT,                 -- 'low' | 'medium' | 'high'
    status TEXT DEFAULT 'draft',       -- 'draft' | 'approved' | 'in_dev' | 'deployed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📁 6. Klasör Yapısı (Clean Architecture)

```
hizmetchatbot/
├── README.md                      # Kapsamlı sistem ve mimari dokümantasyonu
├── package.json                   # Bağımlılıklar (Node.js LTS, sıfır maliyet kütüphaneler)
├── .env.example                   # Ortam değişkenleri şablonu
├── public/                        # Admin Dashboard (Statik, Sıfır CDN, Saf HTML/CSS/JS)
│   ├── index.html                 # Tek sayfa modern Google Material Design 3 Dashboard
│   ├── css/
│   │   ├── material-theme.css     # MD3 renk tokenları, tipografi ve elevation stilleri
│   │   └── dashboard.css          # Modül layoutları, kartlar, sohbet ve takvim gridleri
│   └── js/
│       ├── app.js                 # Sekme yönetimi, modal & state koordinatörü
│       ├── live-chat.js           # Canlı mesajlaşma akışı simülasyonu & yönetici müdahalesi
│       ├── kvkk-manager.js        # Hukuk departmanı onay kuralları ve durum tetikleyicileri
│       ├── cto-chat.js            # Fikir girme, AI RFC kartı üretimi ve ekip sevkiyatı
│       └── calendar-view.js       # 2 usta takvim slotları ve çakışma çözücü görselleştirici
├── src/                           # Backend Çekirdeği (İlerleyen Fazlar)
│   ├── config/                    # Yapılandırma & çevre değişkenleri
│   ├── adapters/                  # Bağımsız entegrasyon adaptörleri
│   │   ├── channel/               # WhatsApp (Baileys), Telegram adaptörleri
│   │   ├── llm/                   # OpenRouter, Ollama, vLLM adaptörleri
│   │   ├── calendar/              # Google Calendar v3 API çift usta senkronizasyonu
│   │   └── payment/               # Sanal POS webhook & ödeme linki oluşturucu
│   ├── core/                      # İş Mantığı & State Machine
│   │   ├── state-machine.js       # 10 adımlık sohbet akış yöneticisi
│   │   ├── kvkk-guard.js          # Spam filtresi ve açık rıza doğrulayıcı
│   │   └── slot-engine.js         # Usta rota ve çakışma çözümleme motoru
│   └── database/                  # SQLite/Postgres bağlantı havuzu ve migrationlar
```

---

## 🚀 7. Hızlı Başlangıç

### Gereksinimler
- Node.js 18+ LTS
- Modern Web Tarayıcısı (Chrome, Edge, Firefox, Safari)

### Dashboard Önizleme (Frontend)
```bash
# Proje kök dizininde herhangi bir hafif HTTP sunucusu ile ayağa kaldırılabilir:
npx serve public -l 3000
# veya Python ile:
python3 -m http.server 3000 --directory public
```
Tarayıcınızda `http://localhost:3000` adresine giderek Admin Dashboard'u hemen deneyimleyebilirsiniz.

---

## 🔒 8. Güvenlik, Gizlilik ve Lisans

- **Lisans:** MIT (Tamamen ücretsiz ve açık kaynak).
- **Veri Saklama:** Müşteri verileri şifrelenmiş diskte (SQLite AES / SQLCipher uyumlu) tutulur.
- **Log Temizliği:** KVKK gereği 12 aydan eski tamamlanmış sohbet logları otomatik arşivlenir/anonimleştirilir.
# Hizmet Chatbot Project
