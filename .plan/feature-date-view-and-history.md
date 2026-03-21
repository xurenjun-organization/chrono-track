# Plan: 日付単位ビュー・履歴ページ

## 目的

- ポップアップを「今日のデータのみ」表示に修正する
- 過去の日付のデータを確認できる履歴ページを新設する

---

## 現状の問題

- `popup.js` の `getTodayData()` は `today()` キーで storage を引いているので
  データ自体は日付単位で正しく分かれている
- ただし表示上の日付ラベルが初回起動時のまま更新されないバグがある
  （ポップアップを開くたびに `today()` を呼んでいるので実際は問題ないはずだが要確認）
- 「履歴を見る」手段が存在しない

---

## 変更対象ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `popup/popup.html` | 修正 | 履歴ページへのリンクボタンを追加 |
| `popup/popup.js` | 修正 | 今日の日付を毎回取得して表示する処理を確認・修正 |
| `popup/popup.css` | 修正 | 履歴リンクボタンのスタイルを追加 |
| `popup/history.html` | 新規 | 履歴ページのHTML |
| `popup/history.js` | 新規 | 履歴ページのロジック |

---

## 実装詳細

### 1. popup.html — 履歴リンクの追加

フッターのエクスポートボタンの左側に「履歴」リンクボタンを追加する。

```html
<!-- footer に追加 -->
<button class="btn btn-ghost" id="open-history">履歴</button>
```

### 2. popup.js — 履歴ページを開く処理

```js
document.getElementById("open-history").addEventListener("click", () => {
  browser.tabs.create({ url: browser.runtime.getURL("popup/history.html") });
});
```

### 3. history.html — 構成

```
ヘッダー: "⏱ Chrono Track — 履歴"
日付一覧（新しい順）:
  └─ 日付行（クリックで展開）: YYYY年M月D日 | 合計時間 | N ページ
      └─ 詳細一覧（展開時）: タイトル / URL / 滞在時間 / 訪問回数
```

### 4. history.js — ロジック

```
1. storage.local.get(null) で全データ取得
2. キーのうち `_` で始まるもの（_isPaused 等）を除外
3. 日付キーを新しい順にソート
4. 各日付ごとにアコーディオン形式でレンダリング
5. クリックで展開/折りたたみ
```

---

## Copilot への実装指示文（案）

```
以下の仕様に従って Firefox 拡張機能 Chrono Track に機能を追加してください。

## 追加する機能
1. popup/popup.html のフッターに「履歴」ボタンを追加
2. popup/popup.js に履歴ボタンのクリックで history.html を新しいタブで開く処理を追加
3. popup/history.html を新規作成（standalone ページ、popup.css を共用）
4. popup/history.js を新規作成

## history.js の仕様
- browser.storage.local.get(null) で全データ取得
- キーが "_" で始まるものは設定値なので除外する
- 残ったキーは "YYYY-MM-DD" 形式の日付。新しい順にソート
- 各日付をアコーディオン形式で表示（クリックで展開/折りたたみ）
- 展開時はその日のページ一覧を totalMs 降順で表示
- 各行: タイトル・URL・滞在時間（formatDuration 関数は popup.js と同じロジック）・訪問回数
- 日付行には合計時間・訪問ページ数をサマリーとして表示

## 参照ファイル
- 既存コード: popup/popup.js（formatDuration・formatDate・escapeHtml を参考に）
- スタイル: popup/popup.css を共用（history.html でも読み込む）
- データ構造: SPEC.md を参照

## 制約
- browser.* API を使用（chrome.* は不可）
- 新しいファイルは popup/ ディレクトリに配置
- manifest.json の変更は不要
```
