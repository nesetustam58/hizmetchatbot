/**
 * Soyut Kanal Adaptörü Temel Sınıfı (BaseChannelAdapter)
 * Kanal Bağımsızlığı (Channel-Agnostic) İlkesi
 */

export class BaseChannelAdapter {
  constructor(channelName) {
    this.channelName = channelName;
    this.messageHandlers = [];
    this.isConnected = false;
  }

  /**
   * Gelen mesaj dinleyicisi ekler
   * @param {Function} handler - async ({ from, text, channel, raw }) => void
   */
  onMessage(handler) {
    if (typeof handler === 'function') {
      this.messageHandlers.push(handler);
    }
  }

  /**
   * Gelen mesajı kayıtlı tüm dinleyicilere iletir
   */
  async emitMessage({ from, text, channel, raw }) {
    for (const handler of this.messageHandlers) {
      try {
        await handler({ from, text, channel: channel || this.channelName, raw });
      } catch (err) {
        console.error(`[${this.channelName}] Mesaj işleme hatası:`, err);
      }
    }
  }

  /**
   * Dışarıya (Müşteriye) mesaj gönderir
   */
  async sendMessage(to, text, options = {}) {
    throw new Error(`sendMessage metodu ${this.channelName} adaptöründe uygulanmalıdır.`);
  }

  async start() {
    this.isConnected = true;
  }

  async stop() {
    this.isConnected = false;
  }
}
