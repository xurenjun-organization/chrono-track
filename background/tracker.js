/**
 * Chrono Track — バックグラウンドトラッキングロジック
 *
 * カウント条件:
 *   - アクティブタブである
 *   - Firefoxウィンドウがフォーカスされている
 * 最低記録時間: 5秒未満は破棄
 */

const MIN_RECORD_MS = 5000;

let currentSession = null;
// currentSession = {
//   url: string,
//   title: string,
//   startMs: number,
//   date: string,   // "YYYY-MM-DD"
// }

// ── ユーティリティ ────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isTrackable(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

// ── セッション管理 ────────────────────────────────────────

// startSession は必ず await して呼ぶこと
async function startSession(url, title) {
  await flushSession();
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

// ── イベントハンドラ ─────────────────────────────────────

// タブ切り替え: activeInfo.tabId で直接タブを取得する（windows.getAll は遅延がある）
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    await startSession(tab.url, tab.title);
  } catch {
    await flushSession();
  }
});

// ページ読み込み完了（ナビゲーション・リロード）＆タイトル更新
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // アクティブタブでなければ無視
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || activeTab.id !== tabId) return;

  if (changeInfo.status === "complete") {
    await startSession(tab.url, tab.title);
    return;
  }

  // タイトルだけ変わった場合（status: complete の後にJSでタイトルが書き換わるケース）
  if (changeInfo.title && currentSession) {
    currentSession.title = changeInfo.title;
  }
});

// ウィンドウフォーカス変更: tabs.query で直接アクティブタブを取得する
browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    // フォーカスを失った
    await flushSession();
  } else {
    // フォーカスを得た: windowId を指定して確実にそのウィンドウのタブを取得
    const [tab] = await browser.tabs.query({ active: true, windowId });
    if (tab) {
      await startSession(tab.url, tab.title);
    }
  }
});

// タブを閉じた: フラッシュするだけ（次のアクティブタブは onActivated が処理する）
browser.tabs.onRemoved.addListener(async () => {
  await flushSession();
});

// ── 日付変更チェック（深夜0時をまたぐ対応）────────────────

setInterval(async () => {
  if (currentSession && currentSession.date !== today()) {
    const { url, title } = currentSession;
    await flushSession();
    await startSession(url, title);
  }
}, 1000);

// ── 初期化 ───────────────────────────────────────────────

async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await startSession(tab.url, tab.title);
  }
}

init();
