# Plan: エクスポート機能の再設計

## 目的

- ポップアップのCSV/JSONを今日のデータのみに統一する
- 履歴ページに日付選択式エクスポート（チェックボックス＋全選択）を追加する

---

## 変更対象ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `popup/popup.js` | 修正 | `exportJson` を今日のデータのみに変更 |
| `popup/history.html` | 修正 | チェックボックス・全選択ボタン・エクスポートボタンを追加 |
| `popup/history.js` | 修正 | チェックボックス選択ロジック・CSV/JSONエクスポート関数を追加 |

---

## 実装詳細

### 1. popup.js — exportJson を今日のみに変更

現状の `exportJson` は `getAllData()` で全データを取得している。
これを `getTodayData()` に変更し、ファイル名も `chrono-track-YYYY-MM-DD.json` にする。

```js
// 変更前
async function exportJson() {
  const allData = await getAllData();
  const json = JSON.stringify(allData, null, 2);
  downloadFile(json, `chrono-track-all.json`, "application/json");
}

// 変更後
async function exportJson() {
  const date = today();
  const dayData = await getTodayData();
  const json = JSON.stringify({ [date]: dayData }, null, 2);
  downloadFile(json, `chrono-track-${date}.json`, "application/json");
}
```

### 2. history.html — エクスポートUIの追加

ヘッダー部分にエクスポートコントロールを追加する。

```html
<header class="history-header">
  <h1 class="logo">⏱ Chrono Track — 履歴</h1>
  <div class="export-controls">
    <label class="select-all-label">
      <input type="checkbox" id="select-all" /> 全選択
    </label>
    <button class="btn btn-secondary" id="export-csv-history">CSV</button>
    <button class="btn btn-secondary" id="export-json-history">JSON</button>
  </div>
</header>
```

各 `.day-block` にもチェックボックスを追加する。
チェックボックスは `.day-header` の先頭に配置し、クリックイベントの伝播を止める。

```html
<div class="day-block">
  <div class="day-header">
    <input type="checkbox" class="day-checkbox" data-date="${dateKey}"
           onclick="event.stopPropagation()" />
    <span class="day-chevron">▶</span>
    ...
  </div>
  ...
</div>
```

### 3. history.js — エクスポートロジックの追加

#### 全選択/全解除

```js
document.getElementById("select-all").addEventListener("change", (e) => {
  document.querySelectorAll(".day-checkbox")
    .forEach((cb) => (cb.checked = e.target.checked));
});
```

#### 選択日付の取得

```js
function getSelectedDates() {
  return [...document.querySelectorAll(".day-checkbox:checked")]
    .map((cb) => cb.dataset.date);
}
```

#### CSV エクスポート（選択日付）

- ヘッダー行: `["日付", "URL", "タイトル", "滞在時間(秒)", "訪問回数"]`
- 選択した日付を新しい順にソートして出力
- ファイル名: `chrono-track-selected.csv`

#### JSON エクスポート（選択日付）

- 選択した日付のキーのみを含むオブジェクトで出力
- ファイル名: `chrono-track-selected.json`

#### 未選択時の処理

- 選択が0件の場合は何もしない（ボタンを disabled にするか alert を出す）

---

## Copilot への実装指示文

```
以下の仕様に従って Chrono Track のエクスポート機能を修正してください。

## 変更 1: popup/popup.js の exportJson を今日のデータのみに変更

現状の exportJson 関数:
  - getAllData() で全データ取得 → 全日付の JSON をエクスポート

変更後:
  - getTodayData() で今日のデータのみ取得
  - JSON構造: { "YYYY-MM-DD": { ...今日のデータ } }
  - ファイル名: chrono-track-YYYY-MM-DD.json（today() 関数を使う）

## 変更 2: popup/history.html にエクスポートUIを追加

- `.history-header` 内に `.export-controls` div を追加
  - 「全選択」チェックボックス（id="select-all"）
  - CSVボタン（id="export-csv-history", class="btn btn-secondary"）
  - JSONボタン（id="export-json-history", class="btn btn-secondary"）
- 各 `.day-block` の `.day-header` 先頭に以下を追加:
  - チェックボックス（class="day-checkbox", data-date属性に日付をセット）
  - onclick="event.stopPropagation()" でアコーディオンの開閉と干渉しないようにする

## 変更 3: popup/history.js にエクスポートロジックを追加

renderHistory 関数の後に以下を追加:

- 全選択チェックボックス: change イベントで全 .day-checkbox の checked を同期
- 個別チェックボックス: change イベントで全選択の状態（全チェック/部分チェック/未チェック）を更新
- getSelectedDates(): .day-checkbox:checked の data-date を配列で返す
- exportSelectedCsv():
  - 選択0件なら return（何もしない）
  - ヘッダー: ["日付", "URL", "タイトル", "滞在時間(秒)", "訪問回数"]
  - 選択日付を新しい順にソートし、各URLを1行で出力
  - BOM付きUTF-8、ファイル名: chrono-track-selected.csv
- exportSelectedJson():
  - 選択0件なら return（何もしない）
  - 選択した日付のキーのみを含むオブジェクトを JSON.stringify(data, null, 2) で出力
  - ファイル名: chrono-track-selected.json
- downloadFile(content, filename, mimeType) 関数を追加（popup.js と同じ実装）

## 制約
- browser.* API を使用（chrome.* は不可）
- allData は renderHistory の呼び出し元で保持し、エクスポート時に参照できるようにする
- manifest.json の変更は不要
- popup.css の変更は最小限（.export-controls のレイアウト調整のみ許可）

## 参照ファイル
- popup/popup.js（downloadFile・today・getTodayData・exportCsv の実装を参考に）
- popup/history.js（既存コードを修正する）
- popup/history.html（既存コードを修正する）
- SPEC.md（仕様確認用）
```
