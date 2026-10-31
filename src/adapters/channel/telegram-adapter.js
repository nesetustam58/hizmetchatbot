/**
 * Telegram Bot API Kanal Adaptörü
 * Sıfır Dış Bağımlılık (Node.js Dahili fetch API)
 */

import { BaseChannelAdapter } from './base-channel-adapter.js';

export class TelegramChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super('telegram');
    const raw = config.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.botToken = String(raw).replace(/^["']|["']$/g, '').trim();
    this.outboxHistory = [];
    this.pollingActive = false;
  }

  async start() {
    this.isConnected = true;
    if (!this.botToken) {
      const raw = process.env.TELEGRAM_BOT_TOKEN || '';
      this.botToken = String(raw).replace(/^["']|["']$/g, '').trim();
    }
    if (!this.botToken) {
      console.log(`[Telegram] Kanal adaptörü aktif edildi (Bot token tanımlı değil).`);
      return;
    }

    try {
      // Telegram bot bağlantısını doğrula
      let res = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      let data = await res.json();

      // Tolerans: 'O' harfi vs '0' rakamı karışıklığı kontrolü
      if (!data.ok && data.error_code === 401 && this.botToken.includes('OZhA')) {
        const candidate = this.botToken.replace(/OZhA/g, '0ZhA');
        const retryRes = await fetch(`https://api.telegram.org/bot${candidate}/getMe`);
        const retryData = await retryRes.json();
        if (retryData.ok) {
          this.botToken = candidate;
          data = retryData;
          console.log(`[Telegram] Bot token toleransı devrede ('O' -> '0' otomatik düzeltildi).`);
        }
      }

      if (data.ok) {
        console.log(`[Telegram] Kanal adaptörü aktif: @${data.result.username} (${data.result.first_name})`);
        // Webhook varsa kaldır ve canlı dinleme (long-polling) başlat
        await fetch(`https://api.telegram.org/bot${this.botToken}/deleteWebhook?drop_pending_updates=true`).catch(() => {});
        this._startPolling();
      } else {
        console.warn(`[Telegram] Bot bağlantı uyarısı:`, data.description || 'Yetkilendirme başarısız');
      }
    } catch (err) {
      console.warn(`[Telegram] API bağlantı uyarısı:`, err.message);
    }
  }

  /**
   * Telegram Bot API Long Polling Döngüsü
   */
  async _startPolling() {
    if (this.pollingActive) return;
    this.pollingActive = true;
    let offset = 0;
    console.log(`[Telegram] Canlı mesaj dinleyicisi (Long Polling) devrede.`);

    while (this.isConnected && this.botToken) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${offset}&timeout=20`, {
          signal: AbortSignal.timeout(25000)
        });
        if (!res.ok) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            await this.handleInboundUpdate(update);
          }
        }
      } catch (err) {
        if (err.name !== 'TimeoutError') {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    this.pollingActive = false;
  }

  async stop() {
    this.isConnected = false;
    this.pollingActive = false;
  }

  /**
   * Telegram kullanıcısına mesaj gönderir
   */
  async sendMessage(chatId, text, options = {}) {
    const targetChatId = String(chatId).replace(/^tg_/, '');
    this.outboxHistory.push({
      to: targetChatId,
      text,
      channel: 'telegram',
      sentAt: new Date().toISOString()
    });

    if (this.botToken) {
      try {
        let tokenToUse = this.botToken;
        let url = `https://api.telegram.org/bot${tokenToUse}/sendMessage`;
        let res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            text: text,
            parse_mode: 'Markdown'
          })
        });
        let data = await res.json();
        if (!data.ok) {
          // Markdown ayrıştırma hatası veya diğer format hatalarında düz metin olarak tekrar dene
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetChatId,
              text: text
            })
          });
        }
      } catch (err) {
        console.warn('[Telegram] API gönderim uyarısı:', err.message);
      }
    }

    return {
      success: true,
      messageId: `tg_msg_${Date.now()}`,
      to: targetChatId,
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
    const text = message.text || message.caption || '';

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
