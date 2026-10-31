/**
 * Model-Agnostic LLM Beyin Katmanı (Clean Architecture)
 * Desteklenen Sağlayıcılar: OpenRouter, Ollama (Local $0), vLLM ve Yerel Heuristik NLP
 * Sıfır Dış Bağımlılık (Node.js Dahili fetch API)
 */

export class LLMBrainAdapter {
  constructor(config = {}) {
    this.provider = config.provider || process.env.LLM_PROVIDER || 'rule_based';
    this.openRouterKey = config.openRouterKey || process.env.OPENROUTER_API_KEY;
    this.openRouterModel = config.openRouterModel || process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct';
    this.ollamaUrl = config.ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.ollamaModel = config.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  }

  /**
   * Müşteri mesajından hizmet türü, kombi markası, semt ve randevu tercihini çıkarır
   * @param {string} userMessage - Müşterinin doğal dille yazdığı mesaj
   * @param {object} context - Mevcut konuşma durumu
   * @returns {Promise<{ serviceCode?: string, brandModel?: string, district?: string, preferredSlotCode?: string, kvkkConsent?: boolean, urgency?: string }>}
   */
  async extractEntities(userMessage, context = {}) {
    // 1. Sağlayıcı OpenRouter veya Ollama ise API çağrısı yap
    if (this.provider === 'openrouter' && this.openRouterKey) {
      try {
        return await this._callOpenRouter(userMessage, context);
      } catch (err) {
        console.warn('⚠️ OpenRouter API hatası, yerel kural motoruna geçiliyor:', err.message);
      }
    } else if (this.provider === 'ollama') {
      try {
        return await this._callOllama(userMessage, context);
      } catch (err) {
        console.warn('⚠️ Ollama bağlantı hatası, yerel kural motoruna geçiliyor:', err.message);
      }
    }

    // 2. Yedek & Hızlı Sıfır Maliyetli Yerel NLP Motoru (Heuristic Fallback)
    return this._extractWithHeuristics(userMessage, context);
  }

  /**
   * OpenRouter JSON Yapılandırılmış Çıktı Çağrısı
   */
  async _callOpenRouter(userMessage, context) {
    const systemPrompt = `Sen bir kombi ve klima servisi yapay zekâ asistanısın. Müşteri mesajından şu alanları JSON formatında çıkar:
- serviceCode: "kombi_bakim" (kış bakımı, periyodik bakım), "ariza_tespit" (hata kodu, sıcak su akmıyor, su damlatıyor, arıza), "petek_temizlik" (petek ısınmıyor, petek temizleme) veya null
- brandModel: Metinde geçen kombi markası/modeli (örn: Demirdöküm Nitromix, ECA, Vaillant, Baymak, Bosch) veya null
- district: İstanbul Kadıköy veya Üsküdar semt/mahalle adı (örn: Moda, Acıbadem, Koşuyolu, Fenerbahçe, Kuzguncuk) veya null
- preferredSlotCode: A, B veya C harfi seçimi veya null
- kvkkConsent: Onaylama ifadesi varsa true, ret/iptal varsa false, aksi halde null
- urgency: "urgent" veya "normal"

Yalnızca geçerli JSON nesnesi döndür.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hizmetchatbot.internal',
        'X-Title': 'HizmetChatbot'
      },
      body: JSON.stringify({
        model: this.openRouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    return JSON.parse(content);
  }

  /**
   * Yerel Ollama ($0 Maliyetli Local AI) Çağrısı
   */
  async _callOllama(userMessage, context) {
    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.ollamaModel,
        messages: [
          { role: 'system', content: 'JSON formatında serviceCode, brandModel, district, preferredSlotCode, kvkkConsent ve urgency alanlarını çıkar.' },
          { role: 'user', content: userMessage }
        ],
        format: 'json',
        stream: false
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data = await response.json();
    return JSON.parse(data.message.content);
  }

  /**
   * Yerel Kural & Regex Tabanlı Akıllı NLP (Sıfır Dış Bağımlılık & 1ms Hız)
   */
  _extractWithHeuristics(message, context = {}) {
    const text = (message || '').toLowerCase();
    const result = {
      serviceCode: null,
      brandModel: null,
      district: null,
      preferredSlotCode: null,
      kvkkConsent: null,
      urgency: 'normal'
    };

    // 1. KVKK Onay / Ret Tespiti
    if (/^(1|evet|onay|kabul|onaylıyorum|tamamdır|ok)$/i.test(text.trim())) {
      result.kvkkConsent = true;
    } else if (/\b(ret|iptal|dur|çık|vazgeç)\b/i.test(text)) {
      result.kvkkConsent = false;
    }

    // 2. Slot Harfi Tespiti (A, B, C)
    const slotMatch = text.match(/\b([a-c])\b/i) || text.match(/^([a-c])$/i);
    if (slotMatch) {
      result.preferredSlotCode = slotMatch[1].toUpperCase();
    }

    // 3. Hizmet Türü Tespiti
    if (/\b(petek|radyatör|ilaçlı petek|petekler ısınmıyor|altı soğuk)\b/i.test(text)) {
      result.serviceCode = 'petek_temizlik';
    } else if (/\b(arıza|hata|çalışmıyor|e0|sıcak su yok|su akıtıyor|ses yapıyor|durdu|bozuldu)\b/i.test(text)) {
      result.serviceCode = 'ariza_tespit';
    } else if (/\b(bakım|kışlık|periyodik|filtre|kombi temizlik)\b/i.test(text) || text.trim() === '1') {
      result.serviceCode = 'kombi_bakim';
    } else if (text.trim() === '2') {
      result.serviceCode = 'ariza_tespit';
    } else if (text.trim() === '3') {
      result.serviceCode = 'petek_temizlik';
    }

    // 4. Semt / Mahalle Tespiti (Kadıköy & Üsküdar Bölgeleri)
    const kadikoyDistricts = ['moda', 'caferağa', 'fenerbahçe', 'bostancı', 'caddebostan', 'erenköy', 'suadiye', 'hasanpaşa', 'kozyatağı', 'göztepe', 'kadıköy'];
    const uskudarDistricts = ['acıbadem', 'koşuyolu', 'altunizade', 'kuzguncuk', 'beylerbeyi', 'üsküdar', 'çengelköy', 'bağlarbaşı'];

    for (const d of kadikoyDistricts) {
      if (text.includes(d)) {
        result.district = `Kadıköy (${d.charAt(0).toUpperCase() + d.slice(1)})`;
        break;
      }
    }
    if (!result.district) {
      for (const d of uskudarDistricts) {
        if (text.includes(d)) {
          result.district = `Üsküdar (${d.charAt(0).toUpperCase() + d.slice(1)})`;
          break;
        }
      }
    }

    // 5. Kombi Markası / Modeli Tespiti
    const brands = ['demirdöküm', 'demirdokum', 'eca', 'e.c.a', 'vaillant', 'baymak', 'bosch', 'buderus', 'ariston', 'alarko', 'viessmann', 'ferroli', 'protherm'];
    for (const b of brands) {
      if (text.includes(b)) {
        result.brandModel = b.toUpperCase();
        break;
      }
    }

    // 6. Aciliyet Tespiti
    if (/\b(acil|hemen|donduk|su basıyor|patladı|soğuktan)\b/i.test(text)) {
      result.urgency = 'urgent';
    }

    return result;
  }
}

// Singleton Dışa Aktarımı
export const LLMEngine = new LLMBrainAdapter();
