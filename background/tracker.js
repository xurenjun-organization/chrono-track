/**
 * Chrono Track — バックグラウンドトラッキングロジック
 *
 * カウント条件:
 *   - アクティブタブである
 *   - Firefoxウィンドウがフォーカスされている
 * 最低記録時間: 5秒未満は破棄
 */

const MIN_RECORD_MS = 5000;
const TICK_INTERVAL_MS = 1000;

let currentSession = null;
// currentSession = {
//   url: string,
//   title: string,
//   startMs: number,
//   date: string,   // "YYYY-MM-DD"
// }

let tickInterval = null;

// ── ユーティリティ ────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isTrackable(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

// ── セッション管理 ────────────────────────────────────────

function startSession(url, title) {
  if (currentSession) {
    flushSession();
  }
  if (!isTrackable(url)) return;

  currentSession = {
    url,
    title: title || url,
    startMs: Date.now(),
    date: today(),
  };
}

async function flushSession() {
  if (!currentSession) return;

  const session = currentSession;
  currentSession = null;

  const elapsed = Date.now() - session.startMs;
  if (elapsed < MIN_RECORD_MS) return;

  await recordTime(session.date, session.url, session.title, elapsed);
}

async function recordTime(date, url, title, elapsedMs) {
  const data = await browser.storage.local.get(date);
  const dayData = data[date] || {};

  const existing = dayData[url] || { title, visits: 0, totalMs: 0 };
  dayData[url] = {
    title,
    visits: existing.visits + 1,
    totalMs: existing.totalMs + elapsedMs,
  };

  await browser.storage.local.set({ [date]: dayData });
}

// ── アクティブタブの取得 ───────────────────────────────────

async function getActiveTab() {
  const windows = await browser.windows.getAll({ populate: true });
  for (const win of windows) {
    if (win.focused) {
      const activeTab = win.tabs.find((t) => t.active);
      return activeTab || null;
    }
  }
  return null;
}

// ── イベントハンドラ ─────────────────────────────────────

async function onTabActivated() {
  const tab = await getActiveTab();
  if (tab) {
    startSession(tab.url, tab.title);
  } else {
    flushSession();
  }
}

async function onTabUpdated(tabId, changeInfo, tab) {
  if (changeInfo.status !== "complete") return;

  const activeTab = await getActiveTab();
  if (!activeTab || activeTab.id !== tabId) return;

  // 同じURLなら再スタートしない（リロード検知のみ訪問カウントを更新）
  if (currentSession && currentSession.url === tab.url) {
    // リロードとして扱い、いったんフラッシュして再スタート
    await flushSession();
    startSession(tab.url, tab.title);
    return;
  }

  startSession(tab.url, tab.title);
}

async function onWindowFocusChanged(windowId) {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    // フォーカスを失った
    await flushSession();
  } else {
    // フォーカスを得た
    const tab = await getActiveTab();
    if (tab) {
      startSession(tab.url, tab.title);
    }
  }
}

async function onTabRemoved(tabId) {
  if (!currentSession) return;
  const activeTab = await getActiveTab();
  // 閉じられたのがアクティブタブでなければ無視
  if (activeTab && activeTab.id !== tabId) return;
  await flushSession();
}

// ── 日付変更チェック（深夜0時をまたぐ対応）────────────────

function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(async () => {
    if (currentSession && currentSession.date !== today()) {
      // 日付が変わったらいったんフラッシュして新しいセッションを開始
      const { url, title } = currentSession;
      await flushSession();
      startSession(url, title);
    }
  }, TICK_INTERVAL_MS);
}

// ── 初期化 ───────────────────────────────────────────────

async function init() {
  browser.tabs.onActivated.addListener(onTabActivated);
  browser.tabs.onUpdated.addListener(onTabUpdated);
  browser.tabs.onRemoved.addListener(onTabRemoved);
  browser.windows.onFocusChanged.addListener(onWindowFocusChanged);

  startTick();

  // 起動時にアクティブタブを取得してセッション開始
  const tab = await getActiveTab();
  if (tab) {
    startSession(tab.url, tab.title);
  }
}

init();
