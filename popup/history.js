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
          <input type="checkbox" class="day-checkbox" data-date="${dateKey}"
                 onclick="event.stopPropagation()" />
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

// ── エクスポート ─────────────────────────────────────────

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getSelectedDates() {
  return [...document.querySelectorAll(".day-checkbox:checked")]
    .map((cb) => cb.dataset.date);
}

function syncSelectAll() {
  const all = document.querySelectorAll(".day-checkbox");
  const checked = document.querySelectorAll(".day-checkbox:checked");
  const selectAll = document.getElementById("select-all");
  selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
  selectAll.checked = all.length > 0 && checked.length === all.length;
}

function exportSelectedCsv(allData) {
  const dates = getSelectedDates();
  if (dates.length === 0) return;

  const rows = [["日付", "URL", "タイトル", "滞在時間(秒)", "訪問回数"]];
  dates
    .slice()
    .sort()
    .reverse()
    .forEach((dateKey) => {
      const dayData = allData[dateKey] || {};
      Object.entries(dayData)
        .sort(([, a], [, b]) => b.totalMs - a.totalMs)
        .forEach(([url, { title, visits, totalMs }]) => {
          rows.push([dateKey, url, title || url, Math.floor(totalMs / 1000), visits]);
        });
    });

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  downloadFile("\uFEFF" + csv, "chrono-track-selected.csv", "text/csv;charset=utf-8");
}

function exportSelectedJson(allData) {
  const dates = getSelectedDates();
  if (dates.length === 0) return;

  const selected = Object.fromEntries(dates.map((d) => [d, allData[d] || {}]));
  downloadFile(JSON.stringify(selected, null, 2), "chrono-track-selected.json", "application/json");
}

// ── 初期化 ───────────────────────────────────────────────

async function init() {
  const allData = await browser.storage.local.get(null);
  renderHistory(allData);

  document.getElementById("select-all").addEventListener("change", (e) => {
    document.querySelectorAll(".day-checkbox").forEach((cb) => (cb.checked = e.target.checked));
  });

  document.getElementById("history-list").addEventListener("change", (e) => {
    if (e.target.classList.contains("day-checkbox")) syncSelectAll();
  });

  document.getElementById("export-csv-history").addEventListener("click", () => exportSelectedCsv(allData));
  document.getElementById("export-json-history").addEventListener("click", () => exportSelectedJson(allData));
}

init();
