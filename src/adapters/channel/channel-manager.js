/**
 * Kanal Yönetim Masası (Channel Manager & Router)
 * Kanal Bağımsızlığı: WhatsApp ve Telegram Mesajlarını Durum Makinesine Bağlar
 */

import { WhatsAppChannelAdapter } from './whatsapp-adapter.js';
import { TelegramChannelAdapter } from './telegram-adapter.js';
import { processCustomerMessage } from '../../core/state-machine.js';

export class ChannelManager {
  constructor() {
    this.adapters = new Map();
    
    // Varsayılan kanalları kaydet
    const wa = new WhatsAppChannelAdapter();
    const tg = new TelegramChannelAdapter();

    this.registerAdapter('whatsapp', wa);
    this.registerAdapter('telegram', tg);
  }

  /**
   * Yeni bir kanal adaptörü kaydeder ve mesaj dinleyicisini bağlar
   */
  registerAdapter(channelName, adapter) {
    this.adapters.set(channelName, adapter);

    // Gelen mesajı State Machine'e ilet ve cevabı aynı kanala gönder
    adapter.onMessage(async ({ from, text, channel }) => {
      try {
        const result = await processCustomerMessage(from, text, channel);
        if (result && result.replyText) {
          await adapter.sendMessage(from, result.replyText);
        }
      } catch (err) {
        console.error(`[ChannelManager] Mesaj döngüsü hatası:`, err);
      }
    });
  }

  getAdapter(channelName) {
    return this.adapters.get(channelName);
  }

  /**
   * Belirtilen kanaldan kullanıcıya mesaj gönderir
   */
  async sendMessage(channelName, to, text, options = {}) {
    const adapter = this.getAdapter(channelName);
    if (!adapter) {
      throw new Error(`Kanal bulunamadı: ${channelName}`);
    }
    return await adapter.sendMessage(to, text, options);
  }

  async startAll() {
    for (const [name, adapter] of this.adapters.entries()) {
      await adapter.start();
    }
  }
}

// Singleton Dışa Aktarımı
export const ChannelRouter = new ChannelManager();
