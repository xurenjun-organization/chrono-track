/**
 * Chrono Track — バックグラウンドトラッキングロジック
 *
 * persistent: false のイベントページとして動作する。
 * スクリプトがアイドル時に解放されても正確に計測できるよう、
 * セッションの状態（開始時刻・URL）は storage.local に永続化する。
 *
 * カウント条件:
 *   - アクティブタブである
 *   - Firefoxウィンドウがフォーカスされている
 *   - 一時停止中でない
 * 最低記録時間: 5秒未満は破棄
 *
 * 既知の制約:
 *   スクリプトが解放されている間にフォーカス離脱が発生した場合、
 *   次のイベントまでその離脱を検知できない。
 *   そのためフォーカス外の時間が一部計上される可能性がある。
 */

const MIN_RECORD_MS = 5000;
const SESSION_KEY = "_currentSession";

// ── ユーティリティ ────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isTrackable(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

// ── セッション管理（storage ベース）────────────────────────

async function startSession(url, title) {
  await flushSession();
  if (!isTrackable(url)) return;

  await browser.storage.local.set({
    [SESSION_KEY]: {
      url,
      title: title || url,
      startMs: Date.now(),
      date: today(),
    },
  });
}

async function flushSession() {
  const result = await browser.storage.local.get(SESSION_KEY);
  const session = result[SESSION_KEY];
  if (!session) return;

  await browser.storage.local.remove(SESSION_KEY);

  const elapsed = Date.now() - session.startMs;
  if (elapsed < MIN_RECORD_MS) return;

  await recordTime(session.date, session.url, session.title, elapsed);
}

async function updateSessionTitle(title) {
  const result = await browser.storage.local.get(SESSION_KEY);
  const session = result[SESSION_KEY];
  if (!session) return;
  await browser.storage.local.set({ [SESSION_KEY]: { ...session, title } });
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

// ── 一時停止状態（storage から毎回読む）──────────────────────

async function getIsPaused() {
  const result = await browser.storage.local.get("_isPaused");
  return result._isPaused === true;
}

// ── イベントハンドラ ─────────────────────────────────────

browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (await getIsPaused()) {
      await flushSession();
      return;
    }
    await startSession(tab.url, tab.title);
  } catch {
    await flushSession();
  }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || activeTab.id !== tabId) return;

  if (changeInfo.status === "complete") {
    if (await getIsPaused()) return;
    await startSession(tab.url, tab.title);
    return;
  }

  if (changeInfo.title) {
    await updateSessionTitle(changeInfo.title);
  }
});

browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    await flushSession();
  } else {
    if (await getIsPaused()) return;
    const [tab] = await browser.tabs.query({ active: true, windowId });
    if (tab) await startSession(tab.url, tab.title);
  }
});

browser.tabs.onRemoved.addListener(async () => {
  await flushSession();
});

// ── メッセージハンドラ（ポップアップとの通信）────────────────

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === "GET_STATE") {
    return { isPaused: await getIsPaused() };
  }
  if (message.type === "SET_PAUSED") {
    if (message.value) {
      await flushSession();
    } else {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab) await startSession(tab.url, tab.title);
    }
    await browser.storage.local.set({ _isPaused: message.value });
    await browser.browserAction.setBadgeText({ text: message.value ? "⏸" : "" });
    return { isPaused: message.value };
  }
});

// ── 初期化 ───────────────────────────────────────────────

async function init() {
  // スクリプトが解放されていた間はフォーカス状態が不明なため、
  // 残っていたセッションは破棄して新規スタート
  await browser.storage.local.remove(SESSION_KEY);

  const paused = await getIsPaused();
  await browser.browserAction.setBadgeText({ text: paused ? "⏸" : "" });
  await browser.browserAction.setBadgeBackgroundColor({ color: "#888888" });

  if (!paused) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab) await startSession(tab.url, tab.title);
  }
}

init();
