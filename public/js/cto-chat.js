/**
 * HizmetChatbot CTO Brain & Business Development Engine
 * AI Architecture Advisor & Lightweight Engineering Dispatcher
 */

const CTOBacklogTasks = [
  {
    id: 'TASK-101',
    title: 'Google Calendar v3 İki Usta Otomatik Slot Kilitleme',
    summary: 'Müşteri slot seçtiğinde 15 dakika süreli ön-blokaj koyan ve POS onayıyla kesinleştiren hafif servis hesabı adaptörü.',
    layer: 'Integration / Calendar',
    cost: '$0 (Google Cloud Free Tier Service Account)',
    status: 'deployed', // 'deployed' | 'in_development' | 'tested' | 'pending_approval'
    date: '27 Ekim 2026'
  },
  {
    id: 'TASK-102',
    title: 'Baileys WhatsApp Multi-Device Soket Adaptörü',
    summary: 'Ayrı bir headless tarayıcı (Puppeteer) gerektirmeden saf WebSocket üzerinden QR auth ile çalışan hafif WhatsApp kütüphanesi.',
    layer: 'Adapters / Channel / Baileys',
    cost: '$0 (Açık Kaynak Node.js)',
    status: 'deployed',
    date: '28 Ekim 2026'
  },
  {
    id: 'TASK-103',
    title: 'Dinamik Tek Kullanımlık Sanal POS Ödeme Linki & Adres Webhook',
    summary: 'Müşteriye özel tokenli ödeme sayfası; ödeme tamamlandığında açık adres ve notu JSON webhook ile veritabanına işler.',
    layer: 'Core / Payment Webhook',
    cost: 'Standart POS komisyonu (Yazılım lisansı $0)',
    status: 'in_development',
    date: '30 Ekim 2026'
  }
];

let ctoChatMessages = [
  {
    sender: 'cto',
    text: 'Selam! Ben sistemin Startup CTO\'suyum. Yeni bir fikir, müşteri deneyimi iyileştirmesi veya teknik geliştirme aklına geldiğinde buraya yazabilirsin. Fikrini Clean Code, modüler yapı ve sıfır maliyetli araçlar çerçevesinde analiz edip doğrudan yazılım görevine dönüştürürüm.',
    time: '10:00'
  }
];

function renderCTOChat() {
  const stream = document.getElementById('cto-chat-stream');
  if (!stream) return;

  stream.innerHTML = ctoChatMessages.map(m => {
    const isCTO = m.sender === 'cto';
    return `
      <div class="chat-bubble-row ${isCTO ? 'customer' : 'bot'}" style="max-width: 90%;">
        <span class="chat-bubble-meta">${isCTO ? '💡 Startup CTO (Yapay Zekâ)' : 'Yönetici'} • ${m.time}</span>
        <div class="chat-bubble" style="${isCTO ? 'background:#f0f4f9; border:1px solid #d3e3fd; color:#1a1c1e;' : 'background:#0b57d0; color:#fff;'}">
          ${m.text}
          ${m.rfcCardHtml || ''}
        </div>
      </div>
    `;
  }).join('');

  stream.scrollTop = stream.scrollHeight;
}

function renderBacklogList() {
  const container = document.getElementById('cto-backlog-container');
  if (!container) return;

  container.innerHTML = CTOBacklogTasks.map(t => {
    const badgeClass = t.status === 'deployed' ? 'badge-success' : t.status === 'tested' ? 'badge-primary' : 'badge-warning';
    const statusText = t.status === 'deployed' ? 'Canlıda Yayında' : t.status === 'tested' ? 'Test Edildi' : 'Geliştirmede';

    return `
      <div style="background:var(--md-sys-color-surface-container-low); border:1px solid var(--md-sys-color-border-subtle); border-radius:var(--md-shape-md); padding:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-weight:700; font-size:12px; color:var(--md-sys-color-primary);">${t.id}</span>
          <span class="badge ${badgeClass}" style="font-size:10px;">${statusText}</span>
        </div>
        <div style="font-size:13px; font-weight:600; margin-bottom:4px;">${t.title}</div>
        <div style="font-size:12px; color:var(--md-sys-color-outline); margin-bottom:6px;">${t.summary}</div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--md-sys-color-on-surface-variant); border-top:1px dashed #e2e8f0; padding-top:6px;">
          <span>Katman: ${t.layer}</span>
          <span>${t.cost}</span>
        </div>
      </div>
    `;
  }).join('');
}

function handleNewCTOIdea(rawIdea) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. User message
  ctoChatMessages.push({
    sender: 'user',
    text: rawIdea,
    time: timeStr
  });
  renderCTOChat();

  // Arka planda DB kaydı
  fetch('/api/cto/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea: rawIdea })
  }).catch(() => {});

  // 2. Simulated CTO Architecture Analysis
  setTimeout(() => {
    const taskId = `RFC-${Math.floor(100 + Math.random() * 900)}`;
    const rfcCardHtml = `
      <div class="rfc-spec-card">
        <div class="rfc-spec-header">
          <h4>📌 Görev Spesifikasyonu: ${taskId}</h4>
          <span class="badge badge-warning">Onay ve Sevkiyat Bekliyor</span>
        </div>
        <div class="rfc-section">
          <strong>Özetlenen İhtiyaç:</strong> ${rawIdea}
        </div>
        <div class="rfc-section">
          <strong>Etkilenen Mimari:</strong> <code>Core/State-Machine</code>, <code>Adapters/WhatsApp</code>, <code>Database/SQLite</code>
        </div>
        <div class="rfc-section">
          <strong>Araç & Maliyet Analizi:</strong> $0 Ek Maliyet. Node.js yerel cron motoru veya mevcut SQLite event kuyruğu ile hafif şekilde çözülebilir. Dış ücretli SaaS servisine gerek yoktur.
        </div>
        <div class="rfc-actions" id="actions-${taskId}">
          <button class="btn btn-primary btn-sm" onclick="dispatchTaskToDev('${taskId}', '${escape(rawIdea)}')">
            Yazılım Ekibine Gönder (Task Aç)
          </button>
          <button class="btn btn-tonal btn-sm" onclick="simulateTaskTest('${taskId}')">
            Test Ortamında Simüle Et
          </button>
        </div>
      </div>
    `;

    ctoChatMessages.push({
      sender: 'cto',
      text: 'Harika bir fikir! Fikrini inceledim ve hafif (lightweight) sistem prensiplerimize uygun bir mimari plan çıkardım:',
      rfcCardHtml: rfcCardHtml,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    renderCTOChat();
  }, 1000);
}

window.dispatchTaskToDev = function(taskId, encodedIdea) {
  const idea = unescape(encodedIdea);
  CTOBacklogTasks.unshift({
    id: taskId,
    title: idea.length > 50 ? idea.substring(0, 48) + '...' : idea,
    summary: `Yönetici chatinden otomatik üretilen hafif mimari görevi.`,
    layer: 'Core & Adapters',
    cost: '$0 Açık Kaynak',
    status: 'in_development',
    date: 'Şimdi'
  });

  renderBacklogList();
  showToast(`${taskId} numaralı görev yazılım kuyruğuna alındı ve geliştirme başladı!`, 'success');

  const actionBox = document.getElementById(`actions-${taskId}`);
  if (actionBox) {
    actionBox.innerHTML = `
      <span class="badge badge-primary">🚀 Geliştirme Takımına Sevk Edildi (#${taskId})</span>
      <button class="btn btn-success btn-sm" onclick="deployTask('${taskId}')">Canlıya Al (Deploy)</button>
    `;
  }
};

window.simulateTaskTest = function(taskId) {
  showToast(`${taskId} için birim testler ve sandbox simülasyonu çalıştırılıyor...`, 'info');
  setTimeout(() => {
    showToast(`Testler %100 Başarılı! Çakışma veya ek bellek maliyeti tespit edilmedi.`, 'success');
  }, 800);
};

window.deployTask = function(taskId) {
  const task = CTOBacklogTasks.find(t => t.id === taskId);
  if (task) {
    task.status = 'deployed';
    renderBacklogList();
  }
  showToast(`${taskId} başarıyla canlı ortama alındı!`, 'success');
  const actionBox = document.getElementById(`actions-${taskId}`);
  if (actionBox) {
    actionBox.innerHTML = `<span class="badge badge-success">✅ Canlı Ortamda Aktif</span>`;
  }
};

function initCTOInput() {
  const form = document.getElementById('cto-chat-form');
  const input = document.getElementById('cto-chat-input');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    handleNewCTOIdea(val);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderCTOChat();
  renderBacklogList();
  initCTOInput();
});
