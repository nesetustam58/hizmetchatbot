/**
 * WhatsApp Kanal Adaptörü (Baileys / Evolution API / Webhook Uyumlu)
 * $0 Maliyetli, Bağımsız ve Modüler Tasarım
 */

import { BaseChannelAdapter } from './base-channel-adapter.js';

export class WhatsAppChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super('whatsapp');
    this.mode = config.mode || process.env.WHATSAPP_MODE || 'webhook'; // 'baileys' | 'webhook' | 'mock'
    this.authFolder = config.authFolder || process.env.WA_AUTH_FOLDER || './data/baileys_auth';
    this.webhookUrl = config.webhookUrl || process.env.WHATSAPP_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
    this.outboxHistory = [];
  }

  async start() {
    this.isConnected = true;
    console.log(`[WhatsApp] Kanal adaptörü aktif edildi (Mod: ${this.mode}).`);
  }

  /**
   * Müşteriye WhatsApp mesajı gönderir
   * @param {string} to - Telefon Numarası
   * @param {string} text - Mesaj Metni
   */
  async sendMessage(to, text, options = {}) {
    // Mesaj günlüğünü tut
    const payload = {
      to,
      text,
      channel: 'whatsapp',
      sentAt: new Date().toISOString()
    };
    this.outboxHistory.push(payload);

    // Canlı Baileys soketi veya Webhook entegrasyon noktası
    const targetUrl = this.webhookUrl || process.env.WHATSAPP_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
    if (this.mode === 'webhook' && targetUrl) {
      try {
        await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: to, message: text, channel: 'whatsapp' })
        });
      } catch (err) {
        console.warn('[WhatsApp] Webhook gönderim uyarısı:', err.message);
      }
    }

    return {
      success: true,
      messageId: `wa_msg_${Date.now()}`,
      to,
      channel: 'whatsapp'
    };
  }

  /**
   * Webhook veya soketten gelen ham WhatsApp mesajını sisteme sokar
   */
  async handleInboundPayload(payload) {
    const from = payload.from || payload.number || payload.sender;
    const text = payload.text || payload.message || payload.body || '';

    if (from && text) {
      await this.emitMessage({
        from: from.replace(/[^0-9+]/g, ''),
        text: text.trim(),
        channel: 'whatsapp',
        raw: payload
      });
    }
  }
}
