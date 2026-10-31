/**
 * HizmetChatbot — Ana Sistem Başlatıcı (Main Entry Point)
 * Clean Architecture & Otonom Saha Operasyon Çekirdeği
 */

import fs from 'node:fs';

// Node.js dahili ortam değişkeni yükleyicisi (.env)
try {
  if (process.loadEnvFile && fs.existsSync('.env')) {
    process.loadEnvFile();
  }
} catch (e) {
  // .env yoksa veya önceden yüklendiyse devam et
}

import { initDatabase, TechnicianRepo, KVKKRepo } from './database/db.js';
import { ChannelRouter } from './adapters/channel/channel-manager.js';
import { CalendarEngine } from './adapters/calendar/calendar-adapter.js';
import { startServer } from './server.js';

async function bootstrap() {
  console.log(`
================================================================================
🛠️  HİZMETCHATBOT — OTONOM KOMBİ & KLİMA BAKIM SERVİSİ
Kadıköy & Üsküdar Bölgesi • 2 Usta • WhatsApp & Telegram • Google Calendar
================================================================================
  `);

  // 1. Veritabanı Başlat
  console.log('1. Veritabanı: Node.js dahili SQLite (WAL Modu) başlatılıyor...');
  initDatabase();
  const techs = TechnicianRepo.getAll();
  const rules = KVKKRepo.getAll();
  console.log(`   ✅ Veritabanı hazır: ${techs.length} Usta kayıtlı, ${rules.length} KVKK kuralı aktif.`);

  // 2. Google Calendar Entegrasyonu
  console.log('\n2. Takvim Motoru: Google Calendar v3 Çift Usta senkronizasyonu başlatılıyor...');
  const syncResult = await CalendarEngine.syncAll();
  console.log(`   ✅ Takvim senkronize: ${syncResult.technicians.length} Usta, 0 çakışma.`);

  // 3. Kanal Adaptörleri
  console.log('\n3. Mesajlaşma Kanalları: WhatsApp Baileys & Telegram adaptörleri ayağa kaldırılıyor...');
  await ChannelRouter.startAll();
  console.log('   ✅ Kanal adaptörleri dinlemede.');

  // 4. Admin Dashboard & REST API Sunucusu
  const port = process.env.PORT || 3000;
  console.log(`\n4. Admin Paneli & REST API: Port ${port} üzerinde açılıyor...`);
  await startServer(port);

  console.log(`
================================================================================
🚀 SİSTEM BAŞARIYLA CANLIYA ALINDI!
👉 Admin Dashboard:  http://localhost:${port}
👉 Canlı API Durum:  http://localhost:${port}/api/stats
👉 Takvim Slotları:  http://localhost:${port}/api/calendar/slots
================================================================================
  `);
}

bootstrap().catch(err => {
  console.error('Kritik Başlatma Hatası:', err);
  process.exit(1);
});
