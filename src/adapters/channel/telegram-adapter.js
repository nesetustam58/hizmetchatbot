/**
 * Telegram Bot API Kanal Adaptörü
 * Sıfır Dış Bağımlılık (Node.js Dahili fetch API)
 */

import { BaseChannelAdapter } from './base-channel-adapter.js';

export class TelegramChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super('telegram');
    this.botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.outboxHistory = [];
  }

  async start() {
    this.isConnected = true;
    console.log(`[Telegram] Kanal adaptörü aktif edildi.`);
  }

  /**
   * Telegram kullanıcısına mesaj gönderir
   */
  async sendMessage(chatId, text, options = {}) {
    this.outboxHistory.push({
      to: chatId,
      text,
      channel: 'telegram',
      sentAt: new Date().toISOString()
    });

    if (this.botToken) {
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
          })
        });
      } catch (err) {
        console.warn('[Telegram] API gönderim uyarısı:', err.message);
      }
    }

    return {
      success: true,
      messageId: `tg_msg_${Date.now()}`,
      to: chatId,
      channel: 'telegram'
    };
  }

  /**
   * Telegram Webhook veya Update yükünü işler
   */
  async handleInboundUpdate(update) {
    const message = update.message || update.edited_message;
    if (!message) return;

    const from = String(message.chat?.id || message.from?.id);
    const text = message.text || '';

    if (from && text) {
      await this.emitMessage({
        from: `tg_${from}`,
        text: text.trim(),
        channel: 'telegram',
        raw: update
      });
    }
  }
}
