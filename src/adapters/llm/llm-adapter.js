/**
 * White-Label & Model-Agnostic LLM Beyin Katmanı (Clean SaaS Architecture)
 * Google AI Studio (gemini-3.8-flash), OpenRouter, Ollama ve Yerel Heuristik NLP
 * Gelişmiş Müşteri Persona Analizi (9 Persona), Kültürel NLP ve Empati Motoru
 * Sıfır Dış Bağımlılık (Node.js Dahili fetch API)
 */

import { 
  ChatbotSettingsRepo, 
  ChatbotKnowledgeRepo, 
  ModelRepo, 
  PersonaRepo, 
  LocalizationRepo, 
  SuggestionRepo 
} from '../../database/db.js';

export class LLMBrainAdapter {
  constructor(config = {}) {
    this.provider = config.provider || process.env.LLM_PROVIDER || 'google';
    const rawGemini = config.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.geminiApiKey = String(rawGemini).replace(/^["']|["']$/g, '').trim();
    this.geminiModel = config.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const rawOpenRouter = config.openRouterKey || process.env.OPENROUTER_API_KEY || '';
    this.openRouterKey = String(rawOpenRouter).replace(/^["']|["']$/g, '').trim();
    this.openRouterModel = config.openRouterModel || process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct';
    this.ollamaUrl = config.ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.ollamaModel = config.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  }

  /**
   * Aktif Model ve Sağlayıcı Parametrelerini ModelRepo'dan Dinamik Alır
   */
  getActiveModelConfig() {
    try {
      const activeModel = ModelRepo.getActive();
      if (activeModel) {
        return {
          id: activeModel.id,
          name: activeModel.name,
          provider: activeModel.provider,
          modelCode: activeModel.model_code,
          temperature: activeModel.temperature ?? 0.1,
          maxTokens: activeModel.max_tokens ?? 1024,
          systemPrompt: activeModel.system_prompt || ''
        };
      }
    } catch (e) {
      // devam et
    }

    return {
      id: 'tr-usta',
      name: 'Tr-usta',
      provider: this.provider || 'google',
      modelCode: this.geminiModel || 'gemini-3.8-flash',
      temperature: 0.1,
      maxTokens: 1024,
      systemPrompt: 'Sen Kadıköy ve Üsküdar bölgelerinde yetkili uzman Tr-usta kombi ve klima servisi asistanısın.'
    };
  }

  /**
   * Müşteri Konuşma Tarzına Göre Otomatik Persona Analizi (Heuristic & AI Destekli)
   * 9 Persona: muhafazakar, sekuler, genc, yasli, teknoloji_zayifi, konuya_hakim, ne_istedigini_bilmiyor, usta_basvurusu, zararli
   */
  detectCustomerPersona(userMessage = '', context = {}) {
    const text = (userMessage || '').toLowerCase().trim();

    // Context'te daha önce doğrulanmış bir persona varsa önceliklendir
    if (context.detectedPersona && context.personaConfidence > 0.85) {
      return { persona: context.detectedPersona, confidence: context.personaConfidence };
    }

    // 1. Zararlı / Kötü Niyetli Persona
    if (/\b(hack|prompt injection|ignore previous|jailbreak|salak bot|aptal bot|seni kim yaptı)\b/i.test(text)) {
      return { persona: 'zararli', confidence: 0.95 };
    }

    // 2. Usta / Teknisyen Başvurusu
    if (/\b(ustayım|iş arıyorum|teknisyenim|iş başvurusu|eleman arıyor|usta lazım mı|birlikte çalışalım|iş ilanı)\b/i.test(text)) {
      return { persona: 'usta_basvurusu', confidence: 0.92 };
    }

    // 3. Muhafazakâr & Geleneksel Persona
    if (/\b(selamün aleyküm|selamun aleykum|aleykum selam|s\.a|hayırlı işler|allah razı olsun|inşallah|maşallah|bereketli olsun|hayırlı cumalar|eyvallah)\b/i.test(text)) {
      return { persona: 'muhafazakar', confidence: 0.90 };
    }

    // 4. Yaşlı / Kıdemli Vatandaş Personası
    if (/\b(evladım|yavrum|oğlum|kızım|üşüdük|yaşlıyız|yaşlıyım|emekliyiz|emekliyim|torunum|telefonda konuşacak|yardım et evladım)\b/i.test(text)) {
      return { persona: 'yasli', confidence: 0.88 };
    }

    // 5. Teknoloji Zayıfı / Güvensizlik Hisseden Persona
    if (/\b(internetten anlamam|anlamam ben|para nereye|param boşa|güvenilir mi|dolandırıcı|kart girmem|telefon numarası|sanal pos|güvenli mi|kartımı vermem|anlamıyorum bu işlerden)\b/i.test(text)) {
      return { persona: 'teknoloji_zayifi', confidence: 0.89 };
    }

    // 6. Konuya Hâkim / Teknik Persona
    if (/\b(bar basıncı|genleşme tankı|eşanjör|plaka eşanjör|ntc|üç yollu|doldurma musluğu|prosestat|f01|f04|f22|e01|e02|e03|hermetik|yoğuşmalı|termostat)\b/i.test(text)) {
      return { persona: 'konuya_hakim', confidence: 0.93 };
    }

    // 7. Genç / Pratik Persona
    if (/\b(selam naber|kombi cortladı|hızlı usta|acil gelsin ya|fiyat ne|kaç para|hallederiz|hacı|aga|kanka|bro|reis)\b/i.test(text)) {
      return { persona: 'genc', confidence: 0.87 };
    }

    // 8. Ne İstediğini Bilmeyen / Kararsız Persona
    if (/\b(garip sesler|ötüyor|ısınmıyor işte|ne yapacağımı bilmiyorum|bilmiyorum|anlamadım|çalışmıyor ama neden|tuhaf ses)\b/i.test(text)) {
      return { persona: 'ne_istedigini_bilmiyor', confidence: 0.85 };
    }

    // 9. Modern / Seküler / Profesyonel Persona (Varsayılan Nezaket Standardı)
    if (/\b(iyi günler|merhabalar|randevu rica|müsait misiniz|teşekkür ederim|teşekkürler|bilgi alabilir miyim)\b/i.test(text)) {
      return { persona: 'sekuler', confidence: 0.88 };
    }

    return { persona: 'sekuler', confidence: 0.70 };
  }

  /**
   * White-Label, Persona Adaptasyonlu ve Kültürel NLP Destekli Dinamik Sistem Promptu
   */
  getDynamicSystemPrompt(context = {}, userMessage = '') {
    const modelCfg = this.getActiveModelConfig();
    const brandProfile = ChatbotSettingsRepo.getWhiteLabelProfile();
    const personaDetection = this.detectCustomerPersona(userMessage, context);
    const personaGuideline = PersonaRepo.getPromptGuideline(personaDetection.persona);
    const culturalRules = LocalizationRepo.getRulesForPrompt('tr');
    const knowledgeContext = ChatbotKnowledgeRepo.getContextPrompt(userMessage);

    let basePrompt = ChatbotSettingsRepo.getSystemPrompt();
    if (!basePrompt || !basePrompt.trim()) {
      basePrompt = `Sen ${brandProfile.serviceRegions} bölgelerinde hizmet veren profesyonel "${brandProfile.brandName}" ${brandProfile.industryVertical} yapay zekâ asistanısın.
DİKEY KİLİT (HVAC): YALNIZCA kombi bakımı, arıza tespiti/onarımı ve ilaçlı petek temizliği konularında hizmet verirsin. Konu dışı sohbetleri kibarca reddederek servis randevu akışına yönlendir.`;
    }

    return `${basePrompt}

${modelCfg.systemPrompt ? `[MODELE ÖZEL TALİMAT]:\n${modelCfg.systemPrompt}\n` : ''}

MARKA VE BÖLGE KİMLİĞİ (WHITE-LABEL):
- Marka Adı: ${brandProfile.brandName}
- Uzmanlık Dikeyi: ${brandProfile.industryVertical}
- Hizmet Bölgeleri: ${brandProfile.serviceRegions}

${personaGuideline}

${culturalRules}

${knowledgeContext}

TEMEL İLETİŞİM İLKESİ (İNSANSI GÜVEN VE EMPATİ):
- Müşteri bir yapay zekâ botuyla konuştuğunu bilmeli, ancak ASLA soğuk bir robotla, soyuluyormuş hissiyle veya güvensizlikle baş başa bırakılmamalıdır.
- Güler yüzlü, kurumsal, güven telkin eden, samimi esnaf ahlakı ve modern dünya standartlarında bir üslup kullan.
- Müşterinin yazım tarzına (${personaDetection.persona}) empatiyle ayak uydur.

Aşağıdaki JSON şemasına KESİNLİKLE uy ve YALNIZCA geçerli JSON nesnesi döndür:
{
  "intent": "service_request" | "booking_flow" | "faq_inquiry" | "off_topic" | "spam_or_abuse",
  "detectedPersona": "muhafazakar" | "sekuler" | "genc" | "yasli" | "teknoloji_zayifi" | "konuya_hakim" | "ne_istedigini_bilmiyor" | "usta_basvurusu" | "zararli",
  "personaConfidence": 0.0 - 1.0 arası sayı,
  "intentConfidence": 0.0 - 1.0 arası sayı,
  "offTopicDetected": boolean,
  "serviceCode": "kombi_bakim" | "ariza_tespit" | "petek_temizlik" | null,
  "brandModel": string veya null,
  "district": string veya null,
  "preferredSlotCode": "A" | "B" | "C" | null,
  "kvkkConsent": true | false | null,
  "urgency": "urgent" | "normal",
  "suggestedReply": string veya null (Müşterinin personasına ve kültürel diline tam uyumlu, insansı ve güven telkin eden Türkçe yanıt)
}`;
  }

  /**
   * Token Harcamadan Önce: Yerel Heuristik Kural & Güvenlik Kalkanı (Token Shield)
   */
  checkSecurityAndFilter(userMessage) {
    const rawText = (userMessage || '').trim();
    const lowerText = rawText.toLowerCase();

    if (!rawText) return { matched: false };

    // 1. Yasaklı ve Küfürlü Kelimeler Matrisi
    try {
      const bannedWords = ChatbotSettingsRepo.getBannedWords();
      for (const item of bannedWords) {
        if (!item.word) continue;
        const targetWord = item.word.toLowerCase().trim();
        const matchType = item.matchType || 'contains';

        let isMatch = false;
        if (matchType === 'exact') {
          const regex = new RegExp(`(^|[^a-zçğıöşü0-9])${targetWord}([^a-zçğıöşü0-9]|$)`, 'i');
          isMatch = regex.test(lowerText);
        } else {
          isMatch = lowerText.includes(targetWord);
        }

        if (isMatch) {
          ChatbotSettingsRepo.incrementShieldStats(250);
          return {
            matched: true,
            ruleType: 'banned_word',
            action: item.action || 'warn',
            item,
            reason: `Yasaklı kelime matrisi tetiklendi: "${item.word}"`
          };
        }
      }
    } catch (err) {
      console.warn('Yasaklı kelime denetiminde hata:', err.message);
    }

    // 2. Spam & Bot Meşgul Etme Tetikleyicileri
    try {
      const spamTriggers = ChatbotSettingsRepo.getSpamTriggers();
      for (const trigger of spamTriggers) {
        if (!trigger) continue;
        const triggerPattern = String(trigger).trim().toLowerCase();

        let isSpam = false;
        if (triggerPattern.startsWith('^') || triggerPattern.endsWith('$') || triggerPattern.includes('\\b')) {
          try {
            const rx = new RegExp(triggerPattern, 'i');
            isSpam = rx.test(lowerText);
          } catch (e) {
            isSpam = lowerText.includes(triggerPattern);
          }
        } else {
          isSpam = lowerText.includes(triggerPattern);
        }

        if (isSpam) {
          ChatbotSettingsRepo.incrementShieldStats(200);
          return {
            matched: true,
            ruleType: 'spam_trigger',
            action: 'off_topic_redirect',
            pattern: triggerPattern,
            reason: `Spam kalıbı eşleşti: "${triggerPattern}"`
          };
        }
      }
    } catch (err) {
      console.warn('Spam tetikleyici denetiminde hata:', err.message);
    }

    // 3. Tekrarlayan Karakter ve Klavye Spamı
    if (rawText.length >= 5 && /^(.)\1+$/.test(rawText)) {
      ChatbotSettingsRepo.incrementShieldStats(180);
      return {
        matched: true,
        ruleType: 'gibberish',
        action: 'off_topic_redirect',
        reason: 'Tekrarlayan tekdüze karakter dizisi tespit edildi.'
      };
    }

    if (/^[asdfghjklqwertyuiopzxcvbnm]{6,}$/i.test(rawText) && !/kombi|servis|ariza|petek|klima|tamir|bakim|fiyat|adres|mahalle/i.test(rawText)) {
      const consonantsOnly = rawText.replace(/[aeiouüöı]/gi, '');
      if (consonantsOnly.length / rawText.length > 0.85) {
        ChatbotSettingsRepo.incrementShieldStats(200);
        return {
          matched: true,
          ruleType: 'gibberish',
          action: 'off_topic_redirect',
          reason: 'Anlamsız klavye spam dizisi tespit edildi.'
        };
      }
    }

    return { matched: false };
  }

  /**
   * Müşteri Mesajını Persona, Kültür ve Niyet Analiziyle Çözümler
   */
  async classifyIntentAndExtract(userMessage, context = {}) {
    if (!this.geminiApiKey) {
      const rawGemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      this.geminiApiKey = String(rawGemini).replace(/^["']|["']$/g, '').trim();
    }

    const modelCfg = this.getActiveModelConfig();

    // 1. Google AI Studio (Gemini)
    if (modelCfg.provider === 'google' && this.geminiApiKey) {
      try {
        const result = await this._callGoogleGemini(userMessage, context, modelCfg);
        console.log(`\n🧠 [LLM BEYİN - ${modelCfg.name}] Çıktı:`);
        console.log(JSON.stringify(result, null, 2));
        return this._normalizeResult(result, userMessage, context);
      } catch (err) {
        console.warn(`⚠️ ${modelCfg.name} API hatası, yedek motora geçiliyor:`, err.message);
      }
    }

    // 2. OpenRouter (Model Bağımsız)
    if ((modelCfg.provider === 'openrouter' || !this.geminiApiKey) && this.openRouterKey) {
      try {
        const result = await this._callOpenRouter(userMessage, context, modelCfg);
        console.log(`\n🧠 [LLM BEYİN - OpenRouter (${modelCfg.modelCode})] Çıktı:`);
        console.log(JSON.stringify(result, null, 2));
        return this._normalizeResult(result, userMessage, context);
      } catch (err) {
        console.warn('⚠️ OpenRouter API hatası, yerel motora geçiliyor:', err.message);
      }
    }

    // 3. Ollama (Yerel $0 AI)
    if (modelCfg.provider === 'ollama') {
      try {
        const result = await this._callOllama(userMessage, context, modelCfg);
        console.log(`\n🧠 [LLM BEYİN - Ollama Yerel] Çıktı:`);
        console.log(JSON.stringify(result, null, 2));
        return this._normalizeResult(result, userMessage, context);
      } catch (err) {
        console.warn('⚠️ Ollama bağlantı hatası, yerel NLP motoruna geçiliyor:', err.message);
      }
    }

    // 4. Sıfır Maliyetli Yerel Heuristik NLP Kural Motoru (Ultra Hızlı Güvenli Fallback)
    const fallback = this._extractWithHeuristics(userMessage, context);
    console.log('\n⚙️ [LLM BEYİN - Heuristic Persona & Niyet Fallback] Çıktı:');
    console.log(JSON.stringify(fallback, null, 2));
    return fallback;
  }

  async extractEntities(userMessage, context = {}) {
    return this.classifyIntentAndExtract(userMessage, context);
  }

  /**
   * Google Gemini API Çağrısı
   */
  async _callGoogleGemini(userMessage, context, modelCfg) {
    const systemPrompt = this.getDynamicSystemPrompt(context, userMessage);
    const targetModel = modelCfg.modelCode || this.geminiModel;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${this.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nKullanıcı Mesajı:\n"${userMessage}"` }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: modelCfg.temperature ?? 0.1,
          maxOutputTokens: modelCfg.maxTokens ?? 1024
        }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error(`Google API HTTP ${response.status}: ${await response.text()}`);
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    let cleanJson = (content || '{}').trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    return JSON.parse(cleanJson);
  }

  /**
   * OpenRouter API Çağrısı
   */
  async _callOpenRouter(userMessage, context, modelCfg) {
    const systemPrompt = this.getDynamicSystemPrompt(context, userMessage);
    const targetModel = modelCfg.modelCode || this.openRouterModel;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hizmetchatbot.internal',
        'X-Title': 'HizmetChatbot'
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' },
        temperature: modelCfg.temperature ?? 0.1,
        max_tokens: modelCfg.maxTokens ?? 1024
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}: ${await response.text()}`);
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    let cleanJson = (content || '{}').trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    return JSON.parse(cleanJson);
  }

  /**
   * Ollama API Çağrısı
   */
  async _callOllama(userMessage, context, modelCfg) {
    const systemPrompt = this.getDynamicSystemPrompt(context, userMessage);
    const targetModel = modelCfg.modelCode || this.ollamaModel;

    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        options: {
          temperature: modelCfg.temperature ?? 0.1
        },
        format: 'json',
        stream: false
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data = await response.json();
    return JSON.parse(data.message.content);
  }

  /**
   * Çıktı Standardizasyonu & Persona Sağlama
   */
  _normalizeResult(parsed, originalMessage, context = {}) {
    const heuristicPersona = this.detectCustomerPersona(originalMessage, context);

    const result = {
      intent: parsed.intent || 'service_request',
      detectedPersona: parsed.detectedPersona || heuristicPersona.persona,
      personaConfidence: typeof parsed.personaConfidence === 'number' ? parsed.personaConfidence : heuristicPersona.confidence,
      intentConfidence: typeof parsed.intentConfidence === 'number' ? parsed.intentConfidence : 0.9,
      offTopicDetected: Boolean(parsed.offTopicDetected || parsed.intent === 'off_topic'),
      serviceCode: parsed.serviceCode || null,
      brandModel: parsed.brandModel || null,
      district: parsed.district || null,
      preferredSlotCode: parsed.preferredSlotCode ? String(parsed.preferredSlotCode).toUpperCase() : null,
      kvkkConsent: parsed.kvkkConsent !== undefined ? parsed.kvkkConsent : null,
      urgency: parsed.urgency === 'urgent' ? 'urgent' : 'normal',
      suggestedReply: parsed.suggestedReply || null
    };

    if (result.intent === 'off_topic') {
      result.offTopicDetected = true;
    }

    return result;
  }

  /**
   * Yerel Kural & Regex Tabanlı Akıllı NLP (Persona & Intent Fallback)
   */
  _extractWithHeuristics(message, context = {}) {
    const text = (message || '').toLowerCase();
    const personaDetection = this.detectCustomerPersona(message, context);

    const result = {
      intent: 'service_request',
      detectedPersona: personaDetection.persona,
      personaConfidence: personaDetection.confidence,
      intentConfidence: 0.85,
      offTopicDetected: false,
      serviceCode: null,
      brandModel: null,
      district: null,
      preferredSlotCode: null,
      kvkkConsent: null,
      urgency: 'normal',
      suggestedReply: null
    };

    // 1. KVKK Onay / Ret
    if (/^(1|evet|onay|kabul|onaylıyorum|tamamdır|ok)$/i.test(text.trim())) {
      result.kvkkConsent = true;
      result.intent = 'booking_flow';
    } else if (/\b(ret|iptal|dur|çık|vazgeç)\b/i.test(text)) {
      result.kvkkConsent = false;
      result.intent = 'booking_flow';
    }

    // 2. Slot Harfi
    const slotMatch = text.match(/\b([a-c])\b/i) || text.match(/^([a-c])$/i);
    if (slotMatch) {
      result.preferredSlotCode = slotMatch[1].toUpperCase();
      result.intent = 'booking_flow';
    }

    // 3. Hizmet Türü
    if (/\b(petek|radyatör|ilaçlı petek|petekler ısınmıyor|altı soğuk)\b/i.test(text)) {
      result.serviceCode = 'petek_temizlik';
      result.intent = 'service_request';
    } else if (/\b(arıza|hata|çalışmıyor|e0|sıcak su yok|su akıtıyor|ses yapıyor|durdu|bozuldu)\b/i.test(text)) {
      result.serviceCode = 'ariza_tespit';
      result.intent = 'service_request';
    } else if (/\b(bakım|kışlık|periyodik|filtre|kombi temizlik)\b/i.test(text) || text.trim() === '1') {
      result.serviceCode = 'kombi_bakim';
      result.intent = 'service_request';
    } else if (text.trim() === '2') {
      result.serviceCode = 'ariza_tespit';
      result.intent = 'service_request';
    } else if (text.trim() === '3') {
      result.serviceCode = 'petek_temizlik';
      result.intent = 'service_request';
    }

    // 4. Semt / Mahalle
    const kadikoyDistricts = ['moda', 'caferağa', 'fenerbahçe', 'bostancı', 'caddebostan', 'erenköy', 'suadiye', 'hasanpaşa', 'kozyatağı', 'göztepe', 'kadıköy'];
    const uskudarDistricts = ['acıbadem', 'koşuyolu', 'altunizade', 'kuzguncuk', 'beylerbeyi', 'üsküdar', 'çengelköy', 'bağlarbaşı'];

    for (const d of kadikoyDistricts) {
      if (text.includes(d)) {
        result.district = `Kadıköy (${d.charAt(0).toUpperCase() + d.slice(1)})`;
        result.intent = 'service_request';
        break;
      }
    }
    if (!result.district) {
      for (const d of uskudarDistricts) {
        if (text.includes(d)) {
          result.district = `Üsküdar (${d.charAt(0).toUpperCase() + d.slice(1)})`;
          result.intent = 'service_request';
          break;
        }
      }
    }

    // 5. Kombi Markası
    const brands = ['demirdöküm', 'demirdokum', 'eca', 'e.c.a', 'vaillant', 'baymak', 'bosch', 'buderus', 'ariston', 'alarko', 'viessmann', 'ferroli', 'protherm'];
    for (const b of brands) {
      if (text.includes(b)) {
        result.brandModel = b.includes('demird') ? 'DEMİRDÖKÜM' : b.toUpperCase();
        break;
      }
    }

    // 6. Aciliyet
    if (/\b(acil|hemen|donduk|su basıyor|patladı|soğuktan)\b/i.test(text)) {
      result.urgency = 'urgent';
    }

    // 7. Konu Dışı Tespiti
    const offTopicKeywords = [
      'hava durumu', 'şarkı', 'fıkra', 'fal', 'şiir', 'futbol', 'maç', 'parti', 'siyaset',
      'kod yaz', 'python', 'javascript', 'bana masal', 'sen kimsin', 'sevgilin var mı',
      'nasılsın', 'naber', 'günaydın nasılsın', 'yemek tarifi', 'kaç yaşındasın',
      'film öner', 'kitap öner', 'dolar kaç'
    ];
    for (const kw of offTopicKeywords) {
      if (text.includes(kw)) {
        result.intent = 'off_topic';
        result.offTopicDetected = true;
        break;
      }
    }

    return result;
  }
}

// Singleton Dışa Aktarımı
export const LLMEngine = new LLMBrainAdapter();
