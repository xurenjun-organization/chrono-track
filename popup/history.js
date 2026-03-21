// ── ユーティリティ ────────────────────────────────────────

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(dateStr) {
  const [y, mo, d] = dateStr.split("-");
  return `${y}年${parseInt(mo)}月${parseInt(d)}日`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── レンダリング ─────────────────────────────────────────

function renderDayDetail(dayData) {
  const entries = Object.entries(dayData).sort(([, a], [, b]) => b.totalMs - a.totalMs);

  return entries
    .map(([url, { title, visits, totalMs }]) => {
      const safeTitle = escapeHtml(title || url);
      const safeUrl = escapeHtml(url);
      return `
      <div class="page-item" title="${safeUrl}">
        <span class="page-title">${safeTitle}</span>
        <span class="page-time">${formatDuration(totalMs)}</span>
        <span class="page-url">${safeUrl}</span>
        <span class="page-visits">${visits}回</span>
      </div>`;
    })
    .join("");
}

function renderHistory(allData) {
  const container = document.getElementById("history-list");

  // "_" で始まるキー（設定値）を除外し、日付キーのみ抽出
  const dateKeys = Object.keys(allData)
    .filter((k) => !k.startsWith("_") && /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .reverse();

  if (dateKeys.length === 0) {
    container.innerHTML = '<p class="empty-history">データがありません</p>';
    return;
  }

  container.innerHTML = dateKeys
    .map((dateKey) => {
      const dayData = allData[dateKey];
      const entries = Object.values(dayData);
      const totalMs = entries.reduce((sum, e) => sum + e.totalMs, 0);
      const pageCount = entries.length;

      return `
      <div class="day-block">
        <div class="day-header">
          <span class="day-chevron">▶</span>
          <span class="day-date">${formatDate(dateKey)}</span>
          <div class="day-summary">
            <span>${formatDuration(totalMs)}</span>
            <span>${pageCount} ページ</span>
          </div>
        </div>
        <div class="day-detail page-list">
          ${renderDayDetail(dayData)}
        </div>
      </div>`;
    })
    .join("");

  // アコーディオンのクリックイベント
  container.querySelectorAll(".day-header").forEach((header) => {
    header.addEventListener("click", () => {
      header.closest(".day-block").classList.toggle("open");
    });
  });
}

// ── 初期化 ───────────────────────────────────────────────

async function init() {
  const allData = await browser.storage.local.get(null);
  renderHistory(allData);
}

init();
