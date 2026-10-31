/**
 * HizmetChatbot — Otonom SaaS AI Chatbot Eğitici & Model Stüdyosu
 * Model Özelinde Dinamik Sekme Mimarisi:
 * - İlk Eğitilen Chatbot Modeli: "Tr-usta" (Google Gemini 3.8 Flash)
 * - Model Seçici Barı (Bot Model Switcher)
 * - Seçilen Modele Özel 5 Alt Sekme:
 *   1. ⚙️ [Seçili Model] Özelleştirme & Parametreler
 *   2. 🌍 Dil Desteği & Kültürel Yerelleştirme
 *   3. 📊 Eğitilme Durumu & Onay Kuyruğu (Auto-Training)
 *   4. 🎭 Müşteri Personası & Empati Motoru (9 Persona)
 *   5. 🛡️ Güvenlik Kalkanı, Kütüphane & 3 Saatlik Cooldown
 * 
 * Sıfır Dış Bağımlılık (Pure Vanilla JavaScript)
 */

(function () {
  // Global Trainer State
  const TrainerState = {
    currentSubTab: 'models',
    models: [],
    activeModelId: 'tr-usta',
    selectedModelId: 'tr-usta',
    localizationRules: [],
    suggestions: [],
    suggestionFilter: 'all',
    personas: [],
    knowledgeDocs: [],
    bannedWords: [],
    blockedUsers: [],
    trainingMetrics: {},
    shieldStats: {}
  };

  // ============================================================================
  // 1. SUB-TAB GEÇİŞLERİ VE BAŞLATICI
  // ============================================================================
  function initSubTabs() {
    const tabButtons = document.querySelectorAll('.trainer-tab-btn[data-subtab]');
    const tabPanes = document.querySelectorAll('.trainer-subtab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-subtab');
        if (!targetTab) return;

        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(`subtab-${targetTab}`);
        if (activePane) activePane.classList.add('active');

        TrainerState.currentSubTab = targetTab;
      });
    });
  }

  // ============================================================================
  // 2. MODEL SEÇİCİ & MODEL STUDIO (SEKME 1)
  // ============================================================================
  async function loadModels() {
    try {
      const res = await fetch('/api/chatbot-trainer/models');
      if (!res.ok) return;
      const data = await res.json();
      TrainerState.models = data.models || [];
      TrainerState.activeModelId = data.activeModelId || 'tr-usta';

      // Eğer seçili model yoksa aktif olanı, o da yoksa ilk modeli seç
      if (!TrainerState.selectedModelId) {
        TrainerState.selectedModelId = TrainerState.activeModelId || (TrainerState.models[0] ? TrainerState.models[0].id : 'tr-usta');
      }

      renderModelSwitcherPills();
      renderModelCards();
      renderSelectedModelEditor();
      updateSubTabModelLabel();
    } catch (err) {
      console.warn('Modeller yüklenemedi:', err.message);
    }
  }

  // Üst Bar Model Seçici Hap Butonları
  function renderModelSwitcherPills() {
    const container = document.getElementById('bot-models-pill-container');
    if (!container) return;

    if (TrainerState.models.length === 0) {
      container.innerHTML = '<span style="color:#94a3b8; font-size:12px;">Tanımlı model yok</span>';
      return;
    }

    container.innerHTML = TrainerState.models.map(m => {
      const isActive = m.id === TrainerState.activeModelId;
      const isSelected = m.id === TrainerState.selectedModelId;
      const isTrUsta = m.name.toLowerCase().includes('tr-usta') || m.id === 'tr-usta';

      const bg = isSelected ? '#15803d' : '#f1f5f9';
      const color = isSelected ? '#ffffff' : '#334155';
      const border = isSelected ? '1.5px solid #166534' : '1px solid #cbd5e1';

      return `
        <button type="button" class="btn btn-sm" style="background:${bg}; color:${color}; border:${border}; font-weight:700; font-size:12px; border-radius:9999px; padding:4px 14px; display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="window.selectModel('${m.id}')">
          <span>${isTrUsta ? '🇹🇷 ' : '🤖 '}${escapeHtml(m.name)}</span>
          ${isActive ? `<span class="badge ${isSelected ? 'badge-neutral' : 'badge-success'}" style="font-size:9.5px; padding:1px 5px;">Canlı</span>` : ''}
        </button>
      `;
    }).join('');
  }

  function updateSubTabModelLabel() {
    const model = TrainerState.models.find(m => m.id === TrainerState.selectedModelId) || { name: 'Tr-usta' };
    const labelEl = document.getElementById('subtab-model-name-label');
    const headerBadge = document.getElementById('active-model-badge');

    if (labelEl) {
      labelEl.textContent = model.name;
    }

    const activeModel = TrainerState.models.find(m => m.id === TrainerState.activeModelId);
    if (headerBadge && activeModel) {
      headerBadge.textContent = `${activeModel.name} (${activeModel.model_code})`;
    }
  }

  function renderModelCards() {
    const container = document.getElementById('model-cards-container');
    if (!container) return;

    container.innerHTML = TrainerState.models.map(m => {
      const isActive = m.id === TrainerState.activeModelId;
      const isSelected = m.id === TrainerState.selectedModelId;
      const isTrUsta = m.name.toLowerCase().includes('tr-usta') || m.id === 'tr-usta';

      return `
        <div class="panel-card model-item-card" style="padding:12px; cursor:pointer; border: 1.5px solid ${isSelected ? '#16a34a' : (isActive ? '#bbf7d0' : '#e2e8f0')}; background:${isSelected ? '#f0fdf4' : '#ffffff'}; transition:all 0.2s ease;" onclick="window.selectModel('${m.id}')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <strong style="font-size:13.5px; color:#0f172a;">${isTrUsta ? '🇹🇷 ' : '🤖 '}${escapeHtml(m.name)}</strong>
              <div style="font-size:11px; color:#64748b; font-family:monospace; margin-top:2px;">${escapeHtml(m.model_code)} (${m.provider.toUpperCase()})</div>
            </div>
            ${isActive ? '<span class="badge badge-success" style="font-size:10px;">CANLIDA AKTİF</span>' : ''}
          </div>
          <div style="display:flex; gap:12px; font-size:11px; color:#475569; margin-top:8px;">
            <span>Sıcaklık: <strong>${m.temperature}</strong></span>
            <span>Token: <strong>${m.max_tokens}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }

  window.selectModel = async function (id) {
    TrainerState.selectedModelId = id;
    renderModelSwitcherPills();
    renderModelCards();
    renderSelectedModelEditor();
    updateSubTabModelLabel();

    // Seçilen modele özel kütüphane, kültürel kurallar ve metrikleri yeniden yükle
    showToast(`"${getSelectedModelName()}" chatbot modelinin özel menüleri açıldı.`, 'info');
    await Promise.all([
      loadLocalizationRules(),
      loadTrainingStatus(),
      loadSuggestions(),
      loadPersonas(),
      loadKnowledgeDocs()
    ]);
  };

  function getSelectedModelName() {
    const m = TrainerState.models.find(x => x.id === TrainerState.selectedModelId);
    return m ? m.name : 'Tr-usta';
  }

  function renderSelectedModelEditor() {
    const model = TrainerState.models.find(m => m.id === TrainerState.selectedModelId);
    if (!model) return;

    const titleEl = document.getElementById('model-editor-title');
    const nameInput = document.getElementById('model-prop-name');
    const codeInput = document.getElementById('model-prop-code');
    const tempSlider = document.getElementById('model-prop-temp');
    const tempVal = document.getElementById('model-temp-val');
    const tokensInput = document.getElementById('model-prop-maxtokens');
    const promptInput = document.getElementById('model-prop-prompt');
    const activateBtn = document.getElementById('btn-activate-selected-model');

    if (titleEl) titleEl.textContent = `${model.name} — Özellikler & Parametreler`;
    if (nameInput) nameInput.value = model.name;
    if (codeInput) codeInput.value = model.model_code;
    if (tempSlider) tempSlider.value = model.temperature;
    if (tempVal) tempVal.textContent = model.temperature;
    if (tokensInput) tokensInput.value = model.max_tokens;
    if (promptInput) promptInput.value = model.system_prompt || '';

    if (activateBtn) {
      if (model.id === TrainerState.activeModelId) {
        activateBtn.disabled = true;
        activateBtn.textContent = '✓ Bu Model Zaten Canlıda Aktif';
      } else {
        activateBtn.disabled = false;
        activateBtn.textContent = `"${model.name}" Modelini Canlıya Al`;
      }
    }
  }

  async function saveSelectedModelParams() {
    const modelId = TrainerState.selectedModelId;
    if (!modelId) return;

    const name = document.getElementById('model-prop-name')?.value;
    const modelCode = document.getElementById('model-prop-code')?.value;
    const temperature = parseFloat(document.getElementById('model-prop-temp')?.value) || 0.1;
    const maxTokens = parseInt(document.getElementById('model-prop-maxtokens')?.value, 10) || 1024;
    const systemPrompt = document.getElementById('model-prop-prompt')?.value || '';

    try {
      const res = await fetch(`/api/chatbot-trainer/models/${modelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, modelCode, temperature, maxTokens, systemPrompt })
      });
      if (res.ok) {
        showToast(`"${name}" modeli parametreleri kaydedildi. ✅`, 'success');
        await loadModels();
      }
    } catch (e) {
      showToast('Güncelleme hatası', 'error');
    }
  }

  async function activateSelectedModel() {
    const modelId = TrainerState.selectedModelId;
    if (!modelId) return;

    try {
      const res = await fetch(`/api/chatbot-trainer/models/${modelId}/activate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`"${data.activeModel?.name || 'Model'}" başarıyla canlı sistem beynine atandı! 🚀`, 'success');
        await loadModels();
      }
    } catch (e) {
      showToast('Aktivasyon hatası', 'error');
    }
  }

  // ============================================================================
  // 3. ÇOK DİLLİ & KÜLTÜREL YERELLEŞTİRME (SEKME 2)
  // ============================================================================
  async function loadLocalizationRules(lang = 'tr') {
    const modelId = TrainerState.selectedModelId || 'tr-usta';
    try {
      const res = await fetch(`/api/chatbot-trainer/localization?lang=${lang}&modelId=${modelId}`);
      if (!res.ok) return;
      const data = await res.json();
      TrainerState.localizationRules = data.rules || [];
      renderLocalizationTable();
    } catch (err) {
      console.warn('Yerelleştirme kuralları yüklenemedi:', err.message);
    }
  }

  function renderLocalizationTable() {
    const tbody = document.getElementById('localization-rules-tbody');
    if (!tbody) return;

    const list = TrainerState.localizationRules || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:16px;">Bu model için tanımlı kültürel kural bulunamadı.</td></tr>';
      return;
    }

    const catBadge = {
      cultural_greeting: '<span class="badge badge-success" style="font-size:10px;">Selam / Temenni</span>',
      dialect: '<span class="badge badge-primary" style="font-size:10px;">Bölgesel Şive</span>',
      idiom: '<span class="badge badge-neutral" style="font-size:10px;">Lokal Deyim</span>',
      humor_empathy: '<span class="badge badge-warning" style="font-size:10px;">Mizah / Serzeniş</span>',
      slang_shield: '<span class="badge badge-neutral" style="font-size:10px; color:#ba1a1a;">Argo Kalkanı</span>'
    };

    tbody.innerHTML = list.map(r => {
      const isAct = r.status === 'active';
      return `
        <tr>
          <td><strong>${escapeHtml(r.phrase)}</strong></td>
          <td>${catBadge[r.category] || r.category}</td>
          <td><span style="font-size:11px; color:#64748b; text-transform:uppercase;">${escapeHtml(r.region)}</span></td>
          <td><span style="font-size:12px; color:#0f172a;">${escapeHtml(r.response_guideline)}</span></td>
          <td>
            <button class="btn btn-outlined btn-sm" style="font-size:10.5px; padding:2px 6px;" onclick="window.toggleLocalizationRule('${r.id}')">
              ${isAct ? '<span style="color:#16a34a;">● Aktif</span>' : '<span style="color:#94a3b8;">○ Pasif</span>'}
            </button>
          </td>
          <td style="text-align:right;">
            <button class="btn btn-outlined btn-sm" style="font-size:11px; padding:2px 6px; color:#ba1a1a;" onclick="window.deleteLocalizationRule('${r.id}')">Sil</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.toggleLocalizationRule = async function (id) {
    try {
      const res = await fetch(`/api/chatbot-trainer/localization/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        showToast('Kural durumu güncellendi.', 'info');
        await loadLocalizationRules();
      }
    } catch (e) {
      showToast('İşlem başarısız.', 'error');
    }
  };

  window.deleteLocalizationRule = async function (id) {
    if (!confirm('Bu kuralı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/chatbot-trainer/localization/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Kural silindi.', 'info');
        await loadLocalizationRules();
      }
    } catch (e) {
      showToast('Silinemedi.', 'error');
    }
  };

  async function addLocalizationRule() {
    const phrase = document.getElementById('new-loc-phrase')?.value.trim();
    const region = document.getElementById('new-loc-region')?.value.trim() || 'all';
    const category = document.getElementById('new-loc-category')?.value || 'dialect';
    const responseGuideline = document.getElementById('new-loc-response')?.value.trim();
    const modelId = TrainerState.selectedModelId || 'tr-usta';

    if (!phrase || !responseGuideline) {
      showToast('Lütfen söylem ve yanıt ilkesini doldurunuz.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/chatbot-trainer/localization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase, region, category, responseGuideline, languageCode: 'tr', modelId })
      });
      if (res.ok) {
        showToast(`"${phrase}" kültürel kuralı eklendi! ✅`, 'success');
        document.getElementById('new-loc-phrase').value = '';
        document.getElementById('new-loc-response').value = '';
        await loadLocalizationRules();
      }
    } catch (e) {
      showToast('Kural eklenemedi.', 'error');
    }
  }

  async function scanCulturalNLP() {
    const scanBtn = document.getElementById('btn-scan-cultural-nlp');
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.textContent = 'Taranıyor...';
    }

    try {
      showToast('Web, makale ve bölgesel diyaloglar taranıyor...', 'info');
      const res = await fetch('/api/chatbot-trainer/localization/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: `${getSelectedModelName()} Kültürel Taraması` })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Tarama tamamlandı: ${data.scanResult.newRulesAdded.length} yeni kültürel kural keşfedildi! ✅`, 'success');
        await loadLocalizationRules();
      }
    } catch (e) {
      showToast('Tarama hatası.', 'error');
    } finally {
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.textContent = '🌐 Web & Sosyal Medyadan Tara';
      }
    }
  }

  // ============================================================================
  // 4. EĞİTİLME DURUMU & ONAY KUYRUĞU (SEKME 3)
  // ============================================================================
  async function loadTrainingStatus() {
    const modelId = TrainerState.selectedModelId || 'tr-usta';
    try {
      const res = await fetch(`/api/chatbot-trainer/training-status?modelId=${modelId}`);
      if (!res.ok) return;
      const data = await res.json();
      TrainerState.trainingMetrics = data.metrics || {};
      renderTrainingMetrics();
    } catch (err) {
      console.warn('Eğitim durumu yüklenemedi:', err.message);
    }
  }

  function renderTrainingMetrics() {
    const m = TrainerState.trainingMetrics;
    const titleEl = document.getElementById('metric-readiness-title');
    const badgeEl = document.getElementById('metric-readiness-badge');
    const barEl = document.getElementById('metric-progress-bar');
    const wordsEl = document.getElementById('metric-total-words');
    const docsEl = document.getElementById('metric-total-docs');
    const locsEl = document.getElementById('metric-total-locs');
    const suggsEl = document.getElementById('metric-pending-suggs');

    const modelName = getSelectedModelName();
    const pct = m.trainingPercent || 94;
    if (titleEl) titleEl.textContent = `${modelName} Modeli Canlı Hizmete %${pct} Hazır`;
    if (badgeEl) badgeEl.textContent = m.readinessStatus || 'Hazır';
    if (barEl) barEl.style.width = `${pct}%`;

    if (wordsEl) wordsEl.textContent = `${(m.totalScannedWords || 0).toLocaleString('tr-TR')} Kelime`;
    if (docsEl) docsEl.textContent = `${m.totalKnowledgeDocs || 0} Belge`;
    if (locsEl) locsEl.textContent = `${m.totalLocalizationRules || 0} Kural`;
    if (suggsEl) suggsEl.textContent = `${m.pendingSuggestionsCount || 0} Bekleyen`;
  }

  async function loadSuggestions() {
    const modelId = TrainerState.selectedModelId || 'tr-usta';
    try {
      const status = TrainerState.suggestionFilter;
      const res = await fetch(`/api/chatbot-trainer/suggestions?status=${status}&modelId=${modelId}`);
      if (!res.ok) return;
      const data = await res.json();
      TrainerState.suggestions = data.suggestions || [];
      renderSuggestionsTable();
    } catch (err) {
      console.warn('Öneriler yüklenemedi:', err.message);
    }
  }

  function renderSuggestionsTable() {
    const tbody = document.getElementById('suggestions-tbody');
    if (!tbody) return;

    const list = TrainerState.suggestions || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#16a34a; padding:16px;">Bu model için onay bekleyen yeni öneri bulunmuyor. Sistem güncel! ✅</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(s => {
      const isPending = s.status === 'pending';
      const statusBadge = isPending 
        ? '<span class="badge badge-warning" style="font-size:10px;">Onay Bekliyor</span>'
        : (s.status === 'approved' ? '<span class="badge badge-success" style="font-size:10px;">Onaylandı</span>' : '<span class="badge badge-neutral" style="font-size:10px;">Reddedildi</span>');

      return `
        <tr>
          <td>
            <strong>${escapeHtml(s.title)}</strong>
            <div style="font-size:11px; color:#64748b;">Kaynak: ${escapeHtml(s.source_type)}</div>
          </td>
          <td><span class="badge badge-neutral" style="font-size:10px;">${escapeHtml(s.category.toUpperCase())}</span></td>
          <td style="max-width:320px; font-size:12px; color:#0f172a;">${escapeHtml(s.suggested_rule)}</td>
          <td><strong>%${Math.round((s.confidence || 0.8) * 100)}</strong></td>
          <td>${statusBadge}</td>
          <td style="text-align:right;">
            ${isPending ? `
              <div style="display:flex; justify-content:flex-end; gap:6px;">
                <button class="btn btn-primary btn-sm" style="font-size:11px; padding:3px 8px; background:#15803d;" onclick="window.approveSuggestion('${s.id}')">Onayla & Entegre Et</button>
                <button class="btn btn-outlined btn-sm" style="font-size:11px; padding:3px 6px; color:#ba1a1a;" onclick="window.rejectSuggestion('${s.id}')">Reddet</button>
              </div>
            ` : `<span style="font-size:11px; color:#94a3b8;">İşlendi</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  window.approveSuggestion = async function (id) {
    try {
      const res = await fetch(`/api/chatbot-trainer/suggestions/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        showToast('Öneri onaylandı ve modele entegre edildi! ✅', 'success');
        await Promise.all([loadSuggestions(), loadTrainingStatus(), loadLocalizationRules()]);
      }
    } catch (e) {
      showToast('Onaylama hatası', 'error');
    }
  };

  window.rejectSuggestion = async function (id) {
    try {
      const res = await fetch(`/api/chatbot-trainer/suggestions/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        showToast('Öneri reddedildi.', 'info');
        await loadSuggestions();
      }
    } catch (e) {
      showToast('Reddetme hatası', 'error');
    }
  };

  // ============================================================================
  // 5. MÜŞTERİ PERSONASI & EMPATİ MOTORU (SEKME 4)
  // ============================================================================
  async function loadPersonas() {
    const modelId = TrainerState.selectedModelId || 'tr-usta';
    try {
      const res = await fetch(`/api/chatbot-trainer/personas?modelId=${modelId}`);
      if (!res.ok) return;
      const data = await res.json();
      TrainerState.personas = data.personas || [];
      renderPersonasGrid();
    } catch (err) {
      console.warn('Personalar yüklenemedi:', err.message);
    }
  }

  function renderPersonasGrid() {
    const container = document.getElementById('personas-grid-container');
    if (!container) return;

    container.innerHTML = TrainerState.personas.map(p => {
      const isAct = p.is_active === 1;
      return `
        <div class="panel-card" style="padding:14px; border:1px solid #e2e8f0; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:13.5px; color:#1e293b;">${escapeHtml(p.title)}</strong>
            <span class="badge ${isAct ? 'badge-success' : 'badge-neutral'}" style="font-size:10px;">${escapeHtml(p.persona_key)}</span>
          </div>
          <p style="font-size:12px; color:#64748b; line-height:1.3;">${escapeHtml(p.description)}</p>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px; font-size:11.5px; color:#334155; margin-top:4px;">
            <strong>Ton Kılavuzu:</strong> ${escapeHtml(p.tone_guideline.substring(0, 110))}...
          </div>
          <div style="font-size:11px; color:#15803d; font-weight:600; margin-top:2px;">
            🛡️ Güven Telkini: "${escapeHtml(p.trust_building_message.substring(0, 90))}..."
          </div>
        </div>
      `;
    }).join('');
  }

  async function testPersonaDetection() {
    const input = document.getElementById('persona-test-input');
    const msg = (input?.value || '').trim();
    if (!msg) {
      showToast('Lütfen analiz edilecek bir müşteri mesajı yazınız.', 'warning');
      return;
    }

    const testBtn = document.getElementById('btn-test-persona');
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.textContent = 'Analiz Ediliyor...';
    }

    try {
      const res = await fetch('/api/chatbot-trainer/detect-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      if (data.success) {
        const box = document.getElementById('persona-test-result-box');
        const tag = document.getElementById('persona-res-tag');
        const conf = document.getElementById('persona-res-confidence');
        const guide = document.getElementById('persona-res-guideline');
        const trust = document.getElementById('persona-res-trust');

        if (box) box.style.display = 'block';
        if (tag) tag.textContent = data.detectedPersona.toUpperCase();
        if (conf) conf.textContent = `Güven Skoru: %${Math.round(data.confidence * 100)}`;
        if (guide) guide.textContent = data.personaPack?.tone_guideline || '-';
        if (trust) trust.textContent = data.personaPack?.trust_building_message || '-';

        showToast(`Persona tespit edildi: ${data.detectedPersona.toUpperCase()} ✅`, 'info');
      }
    } catch (e) {
      showToast('Persona analiz hatası', 'error');
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.textContent = 'Personayı & Tonu Analiz Et';
      }
    }
  }

  // ============================================================================
  // 6. GÜVENLİK KALKANI, RAG LITE & COOLDOWN (SEKME 5)
  // ============================================================================
  async function loadKnowledgeDocs() {
    const modelId = TrainerState.selectedModelId || 'tr-usta';
    try {
      const res = await fetch(`/api/chatbot-trainer/knowledge?modelId=${modelId}`);
      if (!res.ok) return;
      const data = await res.json();
      TrainerState.knowledgeDocs = data.documents || [];
      renderKnowledgeTable();
    } catch (e) {}
  }

  function renderKnowledgeTable() {
    const tbody = document.getElementById('trainer-knowledge-tbody');
    if (!tbody) return;
    const docs = TrainerState.knowledgeDocs || [];
    if (docs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:12px;">Kütüphanede belge yok.</td></tr>';
      return;
    }
    tbody.innerHTML = docs.map(d => `
      <tr>
        <td><strong>${escapeHtml(d.title)}</strong></td>
        <td><span style="font-size:11px; font-family:monospace;">${escapeHtml(d.source || '-')}</span></td>
        <td>~${d.token_estimate || 0}</td>
        <td><span class="badge ${d.is_active ? 'badge-success' : 'badge-neutral'}" style="font-size:10px;">${d.is_active ? 'Aktif' : 'Pasif'}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-outlined btn-sm" style="font-size:11px; padding:2px 6px; color:#ba1a1a;" onclick="window.deleteDoc('${d.id}')">Sil</button>
        </td>
      </tr>
    `).join('');
  }

  window.deleteDoc = async function (id) {
    if (!confirm('Belgeyi silmek istediğinize emin misiniz?')) return;
    await fetch(`/api/chatbot-trainer/knowledge/${id}`, { method: 'DELETE' });
    await loadKnowledgeDocs();
  };

  async function loadSettingsAndSecurity() {
    try {
      const res = await fetch('/api/chatbot-trainer/settings');
      if (!res.ok) return;
      const data = await res.json();
      TrainerState.bannedWords = data.settings?.bannedWords || [];
      renderBannedWords();
    } catch (e) {}
  }

  function renderBannedWords() {
    const tbody = document.getElementById('trainer-banned-words-tbody');
    if (!tbody) return;
    const list = TrainerState.bannedWords || [];
    tbody.innerHTML = list.map((w, idx) => `
      <tr>
        <td><strong>${escapeHtml(w.word)}</strong></td>
        <td><span style="font-size:10.5px; color:#64748b;">${w.matchType}</span></td>
        <td><span class="badge badge-warning" style="font-size:9.5px;">${w.action}</span></td>
        <td style="text-align:right;"><button class="btn btn-outlined btn-sm" style="font-size:10.5px; padding:1px 5px; color:#ba1a1a;" onclick="window.removeBannedWord(${idx})">Sil</button></td>
      </tr>
    `).join('');
  }

  window.removeBannedWord = function (idx) {
    TrainerState.bannedWords.splice(idx, 1);
    renderBannedWords();
  };

  window.addBannedWord = function () {
    const input = document.getElementById('new-banned-word');
    const match = document.getElementById('new-banned-match')?.value || 'contains';
    const action = document.getElementById('new-banned-action')?.value || 'warn';
    const word = (input?.value || '').trim();
    if (!word) return;

    TrainerState.bannedWords.unshift({ word, matchType: match, action, description: 'Panelden eklendi' });
    input.value = '';
    renderBannedWords();
    showToast(`"${word}" matrise eklendi.`, 'info');
  };

  async function loadBlockedUsers() {
    try {
      const res = await fetch('/api/chatbot-trainer/blocked-users');
      if (!res.ok) return;
      const data = await res.json();
      TrainerState.blockedUsers = data.blockedUsers || [];
      renderBlockedUsers();
    } catch (e) {}
  }

  function renderBlockedUsers() {
    const tbody = document.getElementById('trainer-blocked-users-tbody');
    const badge = document.getElementById('trainer-blocked-count-badge');
    if (!tbody) return;
    const list = TrainerState.blockedUsers || [];
    if (badge) badge.textContent = `${list.length} Cezalı`;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#16a34a; padding:12px;">Cezalı kullanıcı yok. Sistem güvende! ✅</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.phone)}</strong></td>
        <td>Spam: ${u.spamCount}</td>
        <td><span class="badge badge-warning" style="font-size:10px;">${u.remainingMinutes} dk kaldı</span></td>
        <td style="text-align:right;"><button class="btn btn-outlined btn-sm" style="font-size:10.5px; padding:2px 6px; color:#15803d;" onclick="window.unblockUser('${u.id}')">Affet</button></td>
      </tr>
    `).join('');
  }

  window.unblockUser = async function (id) {
    await fetch('/api/chatbot-trainer/unblock-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: id })
    });
    showToast('Kullanıcı engeli kaldırıldı.', 'success');
    await loadBlockedUsers();
  };

  async function fetchUrlContentDirectly() {
    const srcInput = document.getElementById('new-doc-source');
    const titleInput = document.getElementById('new-doc-title');
    const contentInput = document.getElementById('new-doc-content');
    const typeSelect = document.getElementById('new-doc-type');
    const btn = document.getElementById('btn-fetch-url-content');

    const url = (srcInput?.value || '').trim();
    if (!url.startsWith('http')) {
      showToast('Geçerli bir URL giriniz.', 'warning');
      return;
    }

    if (btn) btn.textContent = 'Çekiliyor...';
    try {
      const res = await fetch('/api/chatbot-trainer/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success) {
        if (titleInput && !titleInput.value) titleInput.value = data.title;
        if (contentInput) contentInput.value = data.content;
        if (typeSelect) typeSelect.value = 'url_text';
        showToast('Web sayfası metni başarıyla çekildi! ✅', 'success');
      }
    } catch (e) {
      showToast('URL çekilemedi.', 'error');
    } finally {
      if (btn) btn.textContent = '🌐 Web\'den İçeriği Çek';
    }
  }

  async function runIntentTest() {
    const input = document.getElementById('trainer-test-input');
    const msg = (input?.value || '').trim();
    if (!msg) return;

    try {
      const res = await fetch('/api/chatbot-trainer/test-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      const box = document.getElementById('trainer-test-result-box');
      if (box) box.style.display = 'block';

      document.getElementById('test-result-intent').textContent = data.intentResult?.intent || '-';
      document.getElementById('test-result-offtopic').textContent = data.intentResult?.offTopicDetected ? 'EVET (Konu Dışı)' : 'HAYIR (Servis İlgili)';
      document.getElementById('test-result-security').textContent = data.securityCheck?.matched ? `Tetiklendi (${data.securityCheck.ruleType})` : 'Temiz';
      document.getElementById('test-result-suggested-reply').textContent = data.intentResult?.suggestedReply || 'Normal diyalog akışı devam eder.';
      showToast('Niyet testi tamamlandı.', 'info');
    } catch (e) {}
  }

  async function saveAllTrainerStudio() {
    const saveBtn = document.getElementById('btn-save-all-trainer');
    if (saveBtn) saveBtn.textContent = 'Kaydediliyor...';

    try {
      await saveSelectedModelParams();
      await fetch('/api/chatbot-trainer/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannedWords: TrainerState.bannedWords })
      });
      showToast(`"${getSelectedModelName()}" ve tüm stüdyo ayarları veritabanına kaydedildi! ✅`, 'success');
    } catch (e) {
      showToast('Kaydetme hatası', 'error');
    } finally {
      if (saveBtn) saveBtn.innerHTML = `
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zM6 6h9v4H6z"/></svg>
        Tüm Değişiklikleri Anında Kaydet
      `;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initEventListeners() {
    initSubTabs();

    document.getElementById('btn-save-model-params')?.addEventListener('click', saveSelectedModelParams);
    document.getElementById('btn-activate-selected-model')?.addEventListener('click', activateSelectedModel);
    document.getElementById('model-prop-temp')?.addEventListener('input', (e) => {
      document.getElementById('model-temp-val').textContent = e.target.value;
    });

    document.getElementById('btn-add-loc-rule')?.addEventListener('click', addLocalizationRule);
    document.getElementById('btn-scan-cultural-nlp')?.addEventListener('click', scanCulturalNLP);
    document.getElementById('loc-filter-lang')?.addEventListener('change', (e) => loadLocalizationRules(e.target.value));

    document.getElementById('btn-filter-pending-sugg')?.addEventListener('click', () => {
      TrainerState.suggestionFilter = 'pending';
      loadSuggestions();
    });
    document.getElementById('btn-filter-all-sugg')?.addEventListener('click', () => {
      TrainerState.suggestionFilter = 'all';
      loadSuggestions();
    });

    document.getElementById('btn-test-persona')?.addEventListener('click', testPersonaDetection);
    document.getElementById('btn-run-intent-test')?.addEventListener('click', runIntentTest);
    document.getElementById('btn-add-banned-word')?.addEventListener('click', window.addBannedWord);
    document.getElementById('btn-fetch-url-content')?.addEventListener('click', fetchUrlContentDirectly);
    document.getElementById('btn-save-all-trainer')?.addEventListener('click', saveAllTrainerStudio);

    document.getElementById('btn-reload-trainer')?.addEventListener('click', async () => {
      showToast('Stüdyo verileri tazeleniyor...', 'info');
      await Promise.all([
        loadModels(),
        loadLocalizationRules(),
        loadTrainingStatus(),
        loadSuggestions(),
        loadPersonas(),
        loadKnowledgeDocs(),
        loadSettingsAndSecurity(),
        loadBlockedUsers()
      ]);
      showToast('Tüm stüdyo verileri güncellendi! ✅', 'success');
    });

    // Yeni Model Modalı
    const addModelModal = document.getElementById('modal-add-model');
    document.getElementById('btn-open-add-model-modal')?.addEventListener('click', () => {
      addModelModal?.classList.add('active');
    });
    document.getElementById('btn-close-model-modal')?.addEventListener('click', () => {
      addModelModal?.classList.remove('active');
    });
    document.getElementById('form-add-model')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-model-name')?.value.trim();
      const provider = document.getElementById('new-model-provider')?.value;
      const modelCode = document.getElementById('new-model-code')?.value.trim();
      const temperature = parseFloat(document.getElementById('new-model-temp')?.value) || 0.1;
      const maxTokens = parseInt(document.getElementById('new-model-tokens')?.value, 10) || 1024;
      const systemPrompt = document.getElementById('new-model-prompt')?.value.trim();

      try {
        const res = await fetch('/api/chatbot-trainer/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, provider, modelCode, temperature, maxTokens, systemPrompt })
        });
        if (res.ok) {
          showToast(`"${name}" chatbot modeli eklendi! 🤖`, 'success');
          addModelModal?.classList.remove('active');
          document.getElementById('form-add-model')?.reset();
          await loadModels();
        }
      } catch (err) {
        showToast('Model eklenemedi.', 'error');
      }
    });

    // Kütüphane Modalı
    const knowModal = document.getElementById('modal-add-knowledge');
    document.getElementById('btn-open-knowledge-modal')?.addEventListener('click', () => {
      knowModal?.classList.add('active');
    });
    document.getElementById('btn-close-knowledge-modal')?.addEventListener('click', () => {
      knowModal?.classList.remove('active');
    });
    document.getElementById('form-add-knowledge')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('new-doc-title')?.value.trim();
      const type = document.getElementById('new-doc-type')?.value;
      const source = document.getElementById('new-doc-source')?.value.trim();
      const content = document.getElementById('new-doc-content')?.value.trim();
      const isActive = document.getElementById('new-doc-active')?.checked ? 1 : 0;
      const modelId = TrainerState.selectedModelId || 'tr-usta';

      await fetch('/api/chatbot-trainer/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, source, content, isActive, modelId })
      });
      showToast('Belge modele eklendi.', 'success');
      knowModal?.classList.remove('active');
      await Promise.all([loadKnowledgeDocs(), loadTrainingStatus()]);
    });
  }

  // Başlat
  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadModels();
    loadLocalizationRules();
    loadTrainingStatus();
    loadSuggestions();
    loadPersonas();
    loadKnowledgeDocs();
    loadSettingsAndSecurity();
    loadBlockedUsers();
  });
})();
