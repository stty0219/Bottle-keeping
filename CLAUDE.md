# CLAUDE.md — 分罐記帳（Bottle-keeping）

給 Claude Code 的專案說明。每次開始工作前先讀完這份檔案。

## 合作方式（最重要）

- **先討論，再實作。** 我提出想法、問題或 bug 時，先說明你的理解、可能的做法與取捨，和我確認後才動手改程式。只有在我明確說「直接做」或「開始做」時，才開始修改檔案。
- **一律用繁體中文回覆。** 說明要白話、具體，有取捨時講清楚各選項的差異，並給出你的建議。
- 需要我決定的事情，一次聚焦在最關鍵的一兩個問題。
- 修改完成後，告訴我：改了哪些檔案、怎麼測試的、有什麼需要我在手機上確認的地方，以及 commit 訊息。
- 不確定的事（例如手機上的實際觸控手感、畫面效果）要直接說明無法驗證，請我實機確認。

## 專案概要

以「信封預算法」為核心的手機記帳 PWA：收入依每月計畫分進各個罐子，支出從對應的罐子扣款。部署在 GitHub Pages，資料同步使用 Firebase（Authentication + Firestore）。

- 純前端，**沒有框架、沒有建置流程**。檔案直接被瀏覽器載入。
- 使用者主要在 iPhone / Android 的「加入主畫面」模式使用，所有改動都要考慮手機上的操作。

## 技術限制與注意事項

- **JS 是多個一般 `<script>`（不是 ES module），共用同一個全域範圍。** 載入順序寫在 `index.html`，順序很重要：
  - 檔案頂層直接執行的程式碼，只能使用「前面已載入的檔案」定義的東西。
  - 函式宣告不會跨檔案提升（hoisting）。在函式內部互相呼叫沒問題，因為呼叫時所有檔案都已載入。
  - 不要在兩個檔案用 `const` / `let` 宣告同名變數（會造成 SyntaxError，整個檔案不會執行）。
  - 任何一個檔案載入失敗，App 會卡在「載入中」。
- **事件處理集中在 `js/main.js`**：元素用 `data-action="xxx"` 標記，`main.js` 的 click / input / change 監聽器依 `data-action`、`data-edit` 分派。新增互動時沿用這個模式，不要寫 inline `onclick`。
- 畫面更新呼叫 `render()`；雲端同步觸發的重繪用 `safeRender()`，避免打斷使用者正在輸入的欄位。
- **iPhone Safari 的已知坑**：
  - 輸入框字體小於 16px 會在聚焦時自動放大畫面（全域已設 `input,select,textarea{font-size:16px}`，不要覆蓋成更小）。
  - 不要用 `<button>` 包住沒有文字內容的區塊（例如罐子），Safari 會把它的寬度算成 0。罐子使用 `<div role="button" tabindex="0">`。
  - `user-scalable=no` 對雙指縮放無效，已另外攔截 gesture 事件。
- 支援深色模式：顏色一律使用 CSS 變數（`--bg`、`--surface`、`--ink`、`--muted`、`--line`、`--neg`…）。
- 動態效果設定（標準 / 減少 / 關閉）會設在 `:root[data-motion]`，新增動畫時要確保「減少」「關閉」時會停用。

## 檔案結構

```
index.html             畫面骨架；CSS 與 JS 的載入順序在這裡
sw.js                  Service Worker：離線快取；自身檔案一律向伺服器驗證
firebase-config.js     Firebase 專案設定（公開資訊，必須 push）
firestore.rules        Firestore 安全規則（修改後要貼到 Firebase 主控台）
manifest.webmanifest   PWA 設定
css/
  base.css             配色變數、版面、共用元件、分頁列、提示訊息、動態效果
  notify.css           通知鈴鐺與通知面板
  home.css             總覽（罐子、各罐收支、拖拉排序、超支樣式）
  list.css             明細（紀錄列、月初結算、圓餅圖、搜尋、左滑刪除）
  sheet.css            底部表單（記帳、計算機鍵盤、分類面板、emoji 與顏色面板）
  settings.css         設定頁
  dev.css              開發者選項
  summary.css          月結算的共用版面與動畫
  themes.css           月結算的 7 種風格（.th-<id>）
js/
  config.js            APP_VERSION 與 RELEASE（改版只改這裡）
  state.js             共用工具、預設資料、全域狀態 S、本機儲存
  cloud.js             Firebase 同步：帳本、紀錄、寫入流程
  shared-jars.js       共用罐：成員、邀請、撥款紀錄（mirror）同步
  account.js           登入／登出
  setup.js             舊資料轉換、防縮放、動態效果設定
  notify.js            通知鈴鐺、新版本偵測（讀取線上的 js/config.js）
  init.js              啟動流程、匯出／還原備份、匯出 CSV
  calc.js              計算核心：計畫分配、撥款、結轉、月底結算、超支墊付
  views/home.js        總覽頁
  views/list.js        明細頁
  views/settings.js    設定頁
  summary.js           月結算畫面與結算風格設定（THEMES）
  dev.js               開發者選項（連點版本號 7 次開啟）
  sheet.js             底部表單開關、下拉收合、emoji 面板
  color.js             罐子顏色面板、依底色決定文字顏色
  entry.js             記一筆／編輯：計算機鍵盤、分類列、存檔
  ui.js                提示訊息（含復原）、左滑刪除
  reorder.js           罐子排序：總覽長按拖拉、設定頁 ≡ 把手
  main.js              事件分派，最後呼叫 init() 啟動
```

## 資料結構

全域狀態 `S`（本機存在 localStorage，登入後與 Firestore 同步）：
- `buckets[]`：個人罐子 `{id, name, color, amt, carry}`；`carry:false` 表示每月歸零
- `categories[]`：分類 `{id, emoji, name, bucketId}`；`bucketId` 可以是共用罐 `sj:<jarId>`
- `txns[]`：收入 `income`（`mode:'pct'` 代表依每月計畫分配、`'one'` 代表全部放入 `target`）、支出 `expense`、轉移 `transfer`
- `allocMode`：固定為 `'amount'`（比例模式已移除，舊資料由 `migrateAlloc()` 轉換）
- `remainderId`：指定罐子；`jarPlan{}`：自己對各共用罐的撥款設定（`hist[]`，每筆從某月起生效）
- `shelfOrder[]`：總覽罐子順序（含 `sj:<jarId>`）
- `gradeRules`、`sumTheme`、`themeText`：月結算的評等條件、風格、各風格的稱號與評語

Firestore：
```
ledgers/{ledgerId}            個人帳本（只有本人能讀寫），欄位同上
ledgers/{ledgerId}/txns/{id}  個人紀錄
jars/{jarId}                  共用罐：owner, members[], memberInfo{}, name, color, categories[]
jars/{jarId}/txns/{id}        共用罐紀錄：kind = expense | contrib | in | withdraw；by = 記錄者；split = 記錄當下人數
invites/{email}_{jarId}       共用邀請
```

罐子餘額不儲存，每次都從紀錄即時計算。

## 計算規則（修改 calc.js 前務必讀）

1. **計畫分配即時重算**：修改每月金額會重新計算所有月份。同月收入加總後分配；超過計畫的部分放入指定罐子；不足時依計畫金額等比例分配。「全部放入一罐」的收入不參與計畫。
2. **逐月推進**：結轉的罐子保留餘額；每月歸零的罐子**超支時當月就由指定罐子墊付**（罐子顯示 $0 並標示超支），月底剩下的錢結算進指定罐子。
3. **指定罐子一定結轉**，不能設為每月歸零。結轉罐子超支時維持負數，帶到下個月。
4. **共用罐撥款**：從設定的來源罐子單向撥出；修改只從當月起生效，過去月份維持原金額；撥款計算到「可切換的最遠月份」（`horizon()`：當月或已提前記帳的最遠月份）。
5. **撥款紀錄由每位成員自己的裝置寫入共用罐**（`contrib_{uid}_{月份}`）。不同版本的裝置同時在線，可能互相覆蓋（尚未加版本保護）。
6. **共用支出的個人份額** = 金額 ÷ 記錄當下人數（`split`）。總覽與明細的「支出」用份額；撥到共用罐的錢不算支出。
7. **月初結算、本月超支墊付等系統紀錄只供顯示**，不計入收支合計、每日支出與圓餅圖。
8. **評等**：結餘率 =（收入 − 支出）÷ 收入；被墊付的罐子仍算超支。門檻在開發者選項調整，所有風格共用。

## 改版流程

1. 每個版本開一個分支（例如 `v29`）。
2. `js/config.js`：
   - `APP_VERSION` 加一（`sw.js` 會自動使用同一個版本號，不用改）。
   - `RELEASE` 換成這次的更新內容，用**給使用者看的口吻**撰寫；`t` 為 `new`（新功能）/ `imp`（改善）/ `fix`（修正）。
3. **新增或刪除 `css/`、`js/` 的檔案時**，同步更新 `index.html` 的載入清單（注意順序）與 `sw.js` 的 `CORE`。
4. 修改 `firestore.rules` 時，在說明與 commit 內文明確提醒我要貼到 Firebase 主控台。
5. 更新 `README.md`：版本紀錄表加一行；檔案結構或規則有變時一併更新。
6. commit 訊息格式（中文）：
   - `feat: vXX，…`、`fix: vXX，…`、`refactor: vXX，…`
   - 不影響功能的維護：`chore: …`、文件：`docs: …`（不跳版本號）
   - 內容較多時，第一行摘要，空一行後用條列寫內文。

## 測試

- 本機啟動：在專案根目錄執行 `python3 -m http.server`，打開 `http://localhost:8000`。
- 每次修改後至少確認：
  - 主控台（Console）沒有錯誤，右上角不會卡在「載入中」
  - 總覽、明細、設定三個分頁都能正常顯示
  - 記一筆（支出、收入、轉移）、編輯與左滑刪除
  - 有改到的功能本身，以及月結算畫面（有改到計算時）
- 改到計算邏輯時，用具體數字驗算（例如：日常每月 24,000 花了 26,000 → 日常顯示 $0 並標示超支 $2,000，指定罐子當月少 $2,000，所有罐子合計等於實際剩下的錢）。
- 拆檔或搬移程式時，確認沒有新增的跨檔案頂層相依，也沒有重複宣告。

## 安全與資料

- **不要 commit** App 匯出的備份 JSON、CSV（已列在 `.gitignore`）。這個儲存庫就是網站根目錄，push 上去的檔案任何人都能讀取。
- `firebase-config.js` 的 `apiKey` 是公開資訊，不需要也不應該移除；資料安全由 Firestore 安全規則保護。
- 不要在程式碼、README 或 commit 中寫入任何個人資訊（Email、真實姓名、記帳內容）。

## 待辦

- [ ] 啟動錯誤提示：啟動失敗時顯示出錯的檔案，而不是卡在「載入中」
- [ ] 共用罐撥款紀錄加上版本保護：舊版裝置不覆蓋新版寫入的紀錄
- [ ] 測試腳本：把模擬瀏覽器的功能測試整理進專案，改版前自動執行