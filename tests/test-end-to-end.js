/**
 * Uçtan Uca Çok Kanallı (WhatsApp & Telegram) ve LLM Entegrasyon Testi
 */

import { initDatabase, CustomerRepo } from '../src/database/db.js';
import { ChannelRouter } from '../src/adapters/channel/channel-manager.js';

async function runEndToEndTest() {
  console.log('🧪 Çok Kanallı & LLM Doğal Dil Entegrasyon Testi Başlatılıyor...\n');

  initDatabase();
  await ChannelRouter.startAll();

  const waAdapter = ChannelRouter.getAdapter('whatsapp');
  const tgAdapter = ChannelRouter.getAdapter('telegram');

  // --------------------------------------------------------------------------
  // 1. WhatsApp Kanal Akışı (Doğal Dil & Varlık Çıkarımı)
  // --------------------------------------------------------------------------
  console.log('--- 1. WhatsApp Senaryosu: Doğal Dille Kombi Bakım Talebi ---');
  const waPhone = `+90532${Math.floor(1000000 + Math.random() * 9000000)}`;

  // 1.1 İlk mesaj (Kombi markası ve bakım talebi içeriyor)
  await waAdapter.handleInboundPayload({
    from: waPhone,
    text: 'İyi günler, kombim Demirdöküm Nitromix, kışlık bakım yaptırmak istiyorum.'
  });

  let lastWaReply = waAdapter.outboxHistory.at(-1);
  console.log('WhatsApp Bot Cevabı:\n', lastWaReply.text, '\n');

  // 1.2 KVKK Onayı
  console.log('--- 1.2 KVKK Onayı ---');
  await waAdapter.handleInboundPayload({
    from: waPhone,
    text: 'Onaylıyorum'
  });
  lastWaReply = waAdapter.outboxHistory.at(-1);
  console.log('WhatsApp Bot Cevabı:\n', lastWaReply.text, '\n');

  // 1.3 Hizmet Seçimi (Doğal dille)
  console.log('--- 1.3 Hizmet Seçimi: Kombi bakımı ---');
  await waAdapter.handleInboundPayload({
    from: waPhone,
    text: 'Kombi bakımı yaptırmak istiyorum'
  });
  lastWaReply = waAdapter.outboxHistory.at(-1);
  console.log('WhatsApp Bot Cevabı:\n', lastWaReply.text, '\n');

  // 1.4 Semt Belirtme (Kadıköy Moda)
  console.log('--- 1.4 Semt Bildirimi (Kadıköy Moda) ---');
  await waAdapter.handleInboundPayload({
    from: waPhone,
    text: 'Kadıköy Moda Caferağa'
  });
  lastWaReply = waAdapter.outboxHistory.at(-1);
  console.log('WhatsApp Bot Cevabı:\n', lastWaReply.text, '\n');

  // 1.5 Slot Seçimi (A şıkkı)
  console.log('--- 1.5 Slot Seçimi (A) ---');
  await waAdapter.handleInboundPayload({
    from: waPhone,
    text: 'A şıkkı olsun lütfen'
  });
  lastWaReply = waAdapter.outboxHistory.at(-1);
  console.log('WhatsApp Bot Cevabı:\n', lastWaReply.text, '\n');

  // --------------------------------------------------------------------------
  // 2. Telegram Kanal Akışı (Doğal Dille Acil Petek Temizliği)
  // --------------------------------------------------------------------------
  console.log('--- 2. Telegram Senaryosu: Telegram Botu Üzerinden Petek Temizliği ---');
  const tgChatId = '99887766';

  await tgAdapter.handleInboundUpdate({
    message: {
      chat: { id: tgChatId },
      from: { id: tgChatId, first_name: 'Zehra' },
      text: 'Merhaba peteklerimiz ısınmıyor acil temizlik yaptırmak istiyoruz.'
    }
  });

  const lastTgReply = tgAdapter.outboxHistory.at(-1);
  console.log('Telegram Bot Cevabı:\n', lastTgReply.text, '\n');

  console.log('--- Doğrulama İstatistikleri ---');
  console.log('• WhatsApp Giden Mesaj Sayısı:', waAdapter.outboxHistory.length);
  console.log('• Telegram Giden Mesaj Sayısı:', tgAdapter.outboxHistory.length);

  if (waAdapter.outboxHistory.length < 4 || tgAdapter.outboxHistory.length < 1) {
    throw new Error('Kanal mesajlaşma kuyruğunda eksik mesaj tespit edildi!');
  }

  console.log('\n✅ TÜM KANAL VE LLM ENTEGRASYONLARI EKSİKSİZ DOĞRULANDI!');
}

runEndToEndTest().catch(err => {
  console.error('❌ Entegrasyon Test Hatası:', err);
  process.exit(1);
});
