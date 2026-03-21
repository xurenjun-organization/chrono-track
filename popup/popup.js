// ── ユーティリティ ────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

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

// ── データ取得 ───────────────────────────────────────────

async function getTodayData() {
  const date = today();
  const result = await browser.storage.local.get(date);
  return result[date] || {};
}

async function getAllData() {
  return browser.storage.local.get(null);
}

// ── レンダリング ─────────────────────────────────────────

function renderList(dayData) {
  const list = document.getElementById("page-list");
  const entries = Object.entries(dayData);

  if (entries.length === 0) {
    list.innerHTML = '<p class="empty-state">まだ記録がありません</p>';
    return;
  }

  // 滞在時間降順でソート
  entries.sort(([, a], [, b]) => b.totalMs - a.totalMs);

  list.innerHTML = entries
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

function renderSummary(dayData) {
  const entries = Object.values(dayData);
  const totalMs = entries.reduce((sum, e) => sum + e.totalMs, 0);
  const totalPages = entries.length;

  document.getElementById("total-time").textContent =
    totalMs > 0 ? formatDuration(totalMs) : "0s";
  document.getElementById("total-pages").textContent = `${totalPages}`;
  document.getElementById("today-date").textContent = formatDate(today());
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

async function exportCsv() {
  const dayData = await getTodayData();
  const rows = [["URL", "タイトル", "滞在時間(秒)", "訪問回数"]];

  Object.entries(dayData)
    .sort(([, a], [, b]) => b.totalMs - a.totalMs)
    .forEach(([url, { title, visits, totalMs }]) => {
      rows.push([url, title, Math.floor(totalMs / 1000), visits]);
    });

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  downloadFile("\uFEFF" + csv, `chrono-track-${today()}.csv`, "text/csv;charset=utf-8");
}

async function exportJson() {
  const allData = await getAllData();
  const json = JSON.stringify(allData, null, 2);
  downloadFile(json, `chrono-track-all.json`, "application/json");
}

// ── 初期化 ───────────────────────────────────────────────

async function init() {
  const dayData = await getTodayData();
  renderSummary(dayData);
  renderList(dayData);

  document.getElementById("export-csv").addEventListener("click", exportCsv);
  document.getElementById("export-json").addEventListener("click", exportJson);
}

init();
