# CLAUDE.md — 分罐記帳（Bottle-keeping）

給 Claude Code 的專案說明。每次開始工作前先讀完這份檔案。

## 合作方式（最重要）

- **先討論，再實作。** 我提出想法、問題或 bug 時，先說明你的理解、可能的做法與取捨，和我確認後才動手改程式。只有在我明確說「直接做」或「開始做」時，才開始修改檔案。
- **一律用繁體中文回覆。** 說明要白話、具體，有取捨時講清楚各選項的差異，並給出你的建議。
- 需要我決定的事情，一次聚焦在最關鍵的一兩個問題。
- 修改完成後，告訴我：改了哪些檔案、怎麼測試的、有什麼需要我在手機上確認的地方，以及 commit 訊息。
- **不要自己執行 `git commit` 或 `git push`**，只提供 commit 訊息，由我自己 commit。
- commit 訊息**不要加上 `Co-Authored-By`** 這類署名行。
- 不確定的事（例如手機上的實際觸控手感、畫面效果）要直接說明無法驗證，請我實機確認。

## 專案概要

分罐記帳：把每個月的收入分進不同的罐子，每一筆花費都從對應的罐子扣，隨時知道每個罐子還剩多少錢。手機用的 PWA，部署在 GitHub Pages，資料同步使用 Firebase（Authentication + Firestore）。

- 純前端，**沒有框架、沒有建置流程**。檔案直接被瀏覽器載入。
- 使用者主要在 iPhone / Android 的「加入主畫面」模式使用，所有改動都要考慮手機上的操作。

## 文件（修改相關程式前請先讀該文件）

| 文件 | 內容 | 什麼時候要讀 |
|---|---|---|
| [docs/architecture.md](docs/architecture.md) | 檔案結構與職責、script 載入順序、資料結構（`S`、localStorage、Firestore）、舊資料轉換、同步、回報問題 | 新增或搬移檔案、改資料欄位、改同步或回報功能前 |
| [docs/calculation-rules.md](docs/calculation-rules.md) | 每月分配、結轉、月底結算、超支墊付、共用罐、個人支出、評等 | 改 `js/calc.js` 或任何金額、合計、評等相關的程式前 |
| [docs/deployment.md](docs/deployment.md) | GitHub Pages、Firebase 設定、安全規則、開發者 UID、本機測試 | 改 `firestore.rules`、`firebase-config.js`、`DEV_UID` 前 |
| [docs/development.md](docs/development.md) | 分支、commit、PR、改版步驟、測試清單、待辦 | 每次改版與測試時 |

每份資料只寫在一個地方：細節以 docs/ 為準，這份檔案只放合作規則與最容易出錯的重點。修改程式後，相關文件要一起更新。

## 技術上容易出錯的地方

- **JS 是多個一般 `<script>`（不是 ES module），共用同一個全域範圍。** 載入順序寫在 `index.html`：
  - 檔案頂層直接執行的程式碼，只能使用「前面已載入的檔案」定義的東西。
  - 不要在兩個檔案用 `const` / `let` 宣告同名變數（SyntaxError，整個檔案不會執行）。
  - 任何一個檔案載入失敗，App 會停在「載入中」。
- **事件處理集中在 `js/main.js`**：元素用 `data-action="xxx"` 標記，由 `main.js` 分派。不要寫 inline `onclick`。
- 畫面更新呼叫 `render()`；雲端同步觸發的重繪用 `safeRender()`，避免打斷使用者正在輸入的欄位。
- **iPhone Safari 的已知坑**：
  - 輸入框字體小於 16px 會在聚焦時自動放大畫面（全域已設 `input,select,textarea{font-size:16px}`，不要覆蓋成更小）。
  - 不要用 `<button>` 包住沒有文字內容的區塊（例如罐子），Safari 會把它的寬度算成 0。罐子使用 `<div role="button" tabindex="0">`。
  - `user-scalable=no` 對雙指縮放無效，已另外攔截 gesture 事件。
- 支援深色模式：顏色一律使用 CSS 變數（`--bg`、`--surface`、`--ink`、`--muted`、`--line`、`--neg`…）。
- 動態效果設定（標準 / 減少 / 關閉）設在 `:root[data-motion]`，新增動畫時要確保「減少」「關閉」時會停用。
- **罐子餘額不儲存**，每次從紀錄即時計算；共用罐的撥款與超支份額由每位成員自己的裝置寫入，各裝置算出的結果必須一致。
- **開發者帳號的 uid 寫在兩處**（`js/config.js` 的 `DEV_UID` 與 `firestore.rules` 的 `isDev()`），必須一致。

## 改版時一定要做的事

詳細步驟見 [docs/development.md](docs/development.md)。

1. 依規則開分支（`docs`、`chore` 不跳版本號）。
2. `js/config.js` 的 `APP_VERSION` 加一，並在 `js/changelog.js` 的 `CHANGELOG` 最上方新增一筆（`v` 等於 `APP_VERSION`，`items` 用給使用者看的口吻）。
3. 新增或刪除 `css/`、`js/` 的檔案時，同步更新 `index.html` 的載入清單（注意順序）與 `sw.js` 的 `CORE`。
4. 修改 `firestore.rules` 時，在說明與 commit 內文明確提醒我要貼到 Firebase 主控台。
5. 把 `README.md` 最底下的「最新版本」整段換成這次的版本，和 `CHANGELOG` 第一筆一致（只放最新一版）；並更新受影響的 docs 文件。
6. 跑完 [測試清單](docs/development.md#測試清單)，並提供 commit 訊息（格式見 development.md）。

## 安全與資料

- **不要 commit** App 匯出的備份 JSON、CSV（已列在 `.gitignore`）。這個儲存庫就是網站根目錄，push 上去的檔案任何人都能讀取。
- `firebase-config.js` 的 `apiKey` 是公開資訊，不需要也不應該移除；資料安全由 Firestore 安全規則保護。
- 不要在程式碼、文件或 commit 中寫入任何個人資訊（Email、真實姓名、記帳內容）。
