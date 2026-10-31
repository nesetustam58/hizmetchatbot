/**
 * HizmetChatbot KVKK & Legal Department Rules Engine
 * Turkey KVKK (6698) and Commercial Electronic Message (İYS) Compliance
 */

const KVKKRuleSets = [
  {
    id: 'rule-spam-frequency',
    title: 'Spam Koruması & Mesaj Frekans Sınırı',
    lawReference: '6563 s. Elektronik Ticaret Kanunu m.6 & Ticari İletişim Yönetmeliği',
    description: 'Bir müşteriye aynı gün içinde açık talebi olmaksızın 2\'den fazla hatırlatma veya bildirim mesajı gönderilemez. Gece 21:00 - 09:00 arası otomatik kampanya mesajı bloke edilir.',
    systemAction: 'LLM outbound dispatcher queue üzerinde rate-limit filtresi uygular.',
    status: 'approved', // 'approved' | 'pending_approval' | 'rejected'
    approvedAt: '28 Ekim 2026 14:10'
  },
  {
    id: 'rule-opt-in-first-contact',
    title: 'İlk Temas Açık Rıza & Aydınlatma Metni',
    lawReference: '6698 s. KVKK m.5/1 ve m.10 (Aydınlatma Yükümlülüğü)',
    description: 'WhatsApp hattına yazan her yeni müşteriye hizmet seçim menüsü sunulmadan önce veri işleme açık rıza metni sunulmalı ve müşteriden "ONAY / 1" teyidi alınmalıdır.',
    systemAction: 'Sohbet state machine\'inde State 0 -> State 1 geçiş kilidi oluşturur.',
    status: 'approved',
    approvedAt: '25 Ekim 2026 09:30'
  },
  {
    id: 'rule-auto-opt-out',
    title: 'Otomatik Opt-out / RET Anahtar Kelime Kalkanı',
    lawReference: '6563 s. Kanun m.8 (Alıcının Reddetme Hakkı) & İYS Yönetmeliği',
    description: 'Müşteri "RET", "İPTAL", "DUR", "ÇIK" veya "ARAMA" yazdığı anda sistem yapay zekâ yanıtlarını durdurur ve numarayı `dnd_customers` kara listesine kaydeder.',
    systemAction: 'Inbound Webhook üzerinde en yüksek öncelikli regex kesme noktası oluşturur.',
    status: 'approved',
    approvedAt: '29 Ekim 2026 11:20'
  },
  {
    id: 'rule-campaign-winter-service',
    title: 'Toplu Kış Kampanyası: Eski Müşterilere %15 İndirim Şablonu',
    lawReference: 'Ticari İletişim Yönetmeliği m.5 (Onay Alma Şartı)',
    description: 'Son 1 yılda hizmet almış 48 müşteriye "Kış gelmeden kombi bakımında %15 indirim" hatırlatması gönderilmesi önerildi. Yasal onay olmadan gönderim yapılamaz.',
    systemAction: 'Yönetici onay vermeden toplu gönderim motoru kilitli kalır.',
    status: 'pending_approval',
    approvedAt: null
  },
  {
    id: 'rule-location-data-retention',
    title: 'Canlı Konum Verisi Saklama & İmha Politikası',
    lawReference: 'KVKK m.7 (Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi)',
    description: 'Müşterinin WhatsApp üzerinden paylaştığı canlı konum verisi, ustanın servis formu tamamlanıp fatura kesildikten sonra en geç 24 saat içinde veritabanından kalıcı olarak silinir.',
    systemAction: 'Cron job her gece saat 03:00\'te GPS koordinatlarını null yapar.',
    status: 'approved',
    approvedAt: '30 Ekim 2026 16:45'
  },
  {
    id: 'rule-rate-limit-abuse',
    title: 'Kötü Niyetli Sahte Randevu & Bot Kalkanı',
    lawReference: 'KVKK Veri Güvenliği Rehberi (Teknik ve İdari Tedbirler)',
    description: 'Aynı numaradan 10 dakika içinde 3 kez randevu slotu alınıp ödeme yapılmaması durumunda numara 2 saat süreyle otomatik soğuma (cool-down) moduna alınır.',
    systemAction: 'Google Calendar API\'nin gereksiz kilitlenmesini engeller.',
    status: 'pending_approval',
    approvedAt: null
  }
];

function renderKVKKRules() {
  const tableBody = document.getElementById('kvkk-rules-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = KVKKRuleSets.map((rule, idx) => {
    const isApproved = rule.status === 'approved';
    const statusBadge = isApproved
      ? `<span class="badge badge-success"><span class="pulse-dot"></span> Onaylandı (Yürürlükte)</span>`
      : `<span class="badge badge-warning"><span class="pulse-dot live"></span> Yönetici Onayı Bekliyor</span>`;

    const actionButton = isApproved
      ? `<button class="btn btn-outlined btn-sm" onclick="toggleRuleApproval('${rule.id}')" title="Kuralı askıya al">Askıya Al</button>`
      : `<button class="btn btn-success btn-sm" onclick="toggleRuleApproval('${rule.id}')">Onayla & Yürürlüğe Koy</button>`;

    return `
      <tr>
        <td style="width: 280px;">
          <div class="rule-meta-title">${rule.title}</div>
          <div class="rule-meta-desc">${rule.lawReference}</div>
        </td>
        <td>
          <div style="font-size:13px; line-height:1.45; color:var(--md-sys-color-on-surface); margin-bottom:4px;">
            ${rule.description}
          </div>
          <div style="font-size:11.5px; color:var(--md-sys-color-primary); font-family:var(--md-sys-typescale-font-mono);">
            ⚙️ <strong>Sistem Etkisi:</strong> ${rule.systemAction}
          </div>
        </td>
        <td style="width: 200px;">
          ${statusBadge}
          <div style="font-size:11px; color:var(--md-sys-color-outline); margin-top:4px;">
            ${rule.approvedAt ? `Onay: ${rule.approvedAt}` : 'İnceleme bekliyor'}
          </div>
        </td>
        <td style="width: 140px; text-align: right;">
          ${actionButton}
        </td>
      </tr>
    `;
  }).join('');
}

window.toggleRuleApproval = async function(ruleId) {
  const rule = KVKKRuleSets.find(r => r.id === ruleId);
  if (!rule) return;

  if (rule.status === 'approved') {
    rule.status = 'pending_approval';
    rule.approvedAt = null;
    showToast(`"${rule.title}" kuralı askıya alındı. Bot filtresi güncellendi.`, 'warning');
  } else {
    rule.status = 'approved';
    const now = new Date();
    rule.approvedAt = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    showToast(`"${rule.title}" ONAYLANDI! Kural LLM prompt ve güvenlik katmanına entegre edildi.`, 'success');
  }

  renderKVKKRules();

  try {
    await fetch(`/api/kvkk/rules/${ruleId}/toggle`, { method: 'POST' });
  } catch (e) {
    // Offline fallback
  }
};

// Legal Audit Scanner simulation
function initLegalScanner() {
  const scanBtn = document.getElementById('btn-scan-legal-rules');
  if (!scanBtn) return;

  scanBtn.addEventListener('click', () => {
    scanBtn.disabled = true;
    scanBtn.textContent = 'Mevzuat Taranıyor...';
    showToast('AI Hukuk Danışmanı: 6698 s. KVKK ve İYS mevzuatı taranıyor...', 'info');

    setTimeout(() => {
      scanBtn.disabled = false;
      scanBtn.innerHTML = `
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
        Mevzuat Uyumluluk Taraması Yap
      `;
      showToast('Tarama tamamlandı! 4 kural aktif, 2 kural yönetici onayı bekliyor. Kritik ihlal riski: %0.', 'success');
    }, 1200);
  });
}

// Add New Rule Modal Logic
function initNewRuleModal() {
  const modal = document.getElementById('modal-add-kvkk-rule');
  const openBtn = document.getElementById('btn-open-add-rule-modal');
  const closeBtn = document.getElementById('btn-close-kvkk-modal');
  const form = document.getElementById('form-add-kvkk-rule');

  if (!modal || !openBtn) return;

  openBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('new-rule-title').value.trim();
      const lawRef = document.getElementById('new-rule-law').value.trim();
      const desc = document.getElementById('new-rule-desc').value.trim();
      const action = document.getElementById('new-rule-action').value.trim();

      if (!title || !desc) return;

      KVKKRuleSets.unshift({
        id: `rule-custom-${Date.now()}`,
        title: title,
        lawReference: lawRef || '6698 sayılı KVKK Uyum Prosedürü',
        description: desc,
        systemAction: action || 'Yapay zekâ yanıt filtresine koşul olarak eklendi.',
        status: 'pending_approval',
        approvedAt: null
      });

      renderKVKKRules();
      modal.classList.remove('active');
      form.reset();
      showToast(`Yeni kural seti eklendi: "${title}". Yönetici onayı bekliyor.`, 'info');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderKVKKRules();
  initLegalScanner();
  initNewRuleModal();
});
