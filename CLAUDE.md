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
  report.css           回報問題：表單、我的回報、回報管理、鈴鐺的回報通知
  summary.css          月結算的共用版面與動畫
  themes.css           月結算的 7 種風格（.th-<id>）
js/
  config.js            APP_VERSION（新版本偵測會讀取線上的這個檔案）、DEV_UID（開發者帳號）、程式錯誤紀錄（最早載入，記錄 error / unhandledrejection 最近 10 筆到 localStorage `fenguan-errlog`）
  changelog.js         CHANGELOG：所有版本的更新紀錄（由新到舊；鈴鐺顯示第一筆，開發者選項列出全部）
  state.js             共用工具、預設資料、全域狀態 S、本機儲存
  cloud.js             Firebase 同步：帳本、紀錄、寫入流程
  shared-jars.js       共用罐：成員、邀請、撥款與超支墊付紀錄（mirror）同步
  account.js           登入／登出
  setup.js             舊資料轉換、防縮放、動態效果設定
  notify.js            通知鈴鐺（顯示 CHANGELOG 第一筆）、新版本偵測（讀取線上的 js/config.js）
  init.js              啟動流程、匯出／還原備份、匯出 CSV
  calc.js              計算核心：計畫分配、撥款、結轉、月底結算、超支墊付
  views/home.js        總覽頁
  views/list.js        明細頁
  views/settings.js    設定頁
  summary.js           月結算畫面與結算風格設定（THEMES）
  dev.js               開發者選項（連點版本號 7 次開啟）：評等條件、結算風格、更新紀錄、回報管理（只有開發者帳號）
  report.js            回報問題：監聽 reports、送出（圖片壓縮）、我的回報、回報管理頁面、鈴鐺的新回報／新進度
  sheet.js             底部表單開關、下拉收合、emoji 面板
  color.js             罐子顏色面板、依底色決定文字顏色
  entry.js             記一筆／編輯：計算機鍵盤、分類列、存檔
  ui.js                提示訊息（含復原）、左滑刪除
  reorder.js           拖拉排序：總覽長按罐子、設定頁罐子與分類（組內）的 ≡ 把手
  main.js              事件分派，最後呼叫 init() 啟動
```

## 資料結構

全域狀態 `S`（本機存在 localStorage，登入後與 Firestore 同步）：
- `buckets[]`：個人罐子 `{id, name, color, amt, carry, coverBy}`；`carry:false` 表示每月歸零；`coverBy` 是超支時墊付的個人罐子 id（`null` 不墊付，不能是自己）
- `categories[]`：分類 `{id, emoji, name, bucketId}`；`bucketId` 只能是個人罐子；陣列順序就是設定頁與分類面板中各組內的順序。v33 以前可以是共用罐 `sj:<jarId>`，v34 起由 `migrateSharedCats()`（共用罐清單由伺服器確認後執行）轉成該共用罐的共用分類，已不是成員則改扣第一個個人罐子
- `txns[]`：收入 `income`（`mode:'pct'` 代表依每月計畫分配、`'one'` 代表全部放入 `target`）、支出 `expense`、轉移 `transfer`
- `allocMode`：固定為 `'amount'`（比例模式已移除，舊資料由 `migrateAlloc()` 轉換）
- `excessTo`：收入超過計畫的錢放入的罐子；`sweepTo`：歸零罐子月底的剩餘或不足放入的罐子（兩者都一定結轉，找不到時退回最後一個會結轉的罐子）
- `remainderId`：v31 以前的指定罐子。v32 起只由 `migrateCover()` 讀取一次（帳本沒有 excessTo、sweepTo 時轉換），persist 時寫入 `sweepTo` 給舊版裝置用
- `jarPlan{}`：自己對各共用罐的撥款設定（`hist[]`：每筆 `{m, amt, src, coverBy}`，從某月起生效，用 `setJarPlan()` 修改）；`src` 是共用罐的**所屬罐子**（撥款來源），`coverBy` 是共用罐超支時自己的份額由哪個個人罐子墊付。v36 起 `setJarPlan(jid,'src',…)` 會同時改 `coverBy`，兩者一律相同；v35 以前的月份可能不同或為 `null`，維持原樣。新的共用罐用 `newJarPlan()` 建立
- `jarOwnerV36`、`jarOwnerNote`：v36 的所屬罐子轉換（`migrateJarOwner()`）已完成的旗標，以及轉換時改掉的墊付設定說明 `{at, items[]}`（通知面板顯示，各裝置清除後記在 localStorage `fenguan-mignote`）
- `shelfOrder[]`：總覽罐子順序（含 `sj:<jarId>`）
- `gradeRules`、`sumTheme`、`themeText`：月結算的評等條件、風格、各風格的稱號與評語

Firestore：
```
ledgers/{ledgerId}            個人帳本（只有本人能讀寫），欄位同上
ledgers/{ledgerId}/txns/{id}  個人紀錄
jars/{jarId}                  共用罐：owner, members[], memberInfo{}, name, color, categories[]（共用分類，順序即顯示順序，在設定頁「支出分類」管理）
jars/{jarId}/txns/{id}        共用罐紀錄：kind = expense | contrib | in | withdraw | cover；by = 記錄者；split = 記錄當下人數；src/srcId = 撥款、墊付的來源罐子
invites/{email}_{jarId}       共用邀請
reports/{reportId}            App 內回報：uid, name, email, type（bug | idea | other）, area, text, imageCount, appVersion,
                              device{ua, screen, viewport, standalone, lang}、diag[{m, src, t}]（勾選附上時才有）,
                              status（new | read | doing | done | wontfix）, issue, fixedIn, reply, createdAt, updatedAt, statusChangedAt
reports/{reportId}/images/{n} n = 0..2；data = 壓縮後的 JPEG（base64，長邊 1280，單張 ≤ 700KB）。和回報用同一個 batch 寫入
```

回報問題（v37，`js/report.js`）：
- **開發者帳號的 uid 寫在兩個地方，必須一致**：`js/config.js` 的 `DEV_UID`（決定畫面上是否顯示「回報管理」）與 `firestore.rules` 的 `isDev()`（真正的權限）。「回報管理」只看登入帳號是否為開發者，**不看**開發者模式（任何人都能開啟開發者模式）。
- 一般帳號只監聽 `where('uid','==',自己)`，開發者監聽整個 `reports`；排序在手機上做，不需要複合索引。登入時 `startReports()`、登出時 `stopReports()`（在 `onAuthStateChanged`，不在 `cloudStop()`，因為 `subscribe()` 會先呼叫 `cloudStop()`）。
- 開發者打開未讀的回報時自動改為已讀。回報者的「新進度」：狀態（未讀、已讀視為沒有進度）＋ issue ＋ 修正版本 ＋ 回覆組成的字串和 localStorage `fenguan-rptseen` 不同就算新進度；這台裝置第一次載入時，現有進度全部當作已看過。開發者本人的回報不顯示新進度。
- 回報不包含任何記帳資料或金額；一般畫面不顯示錯誤紀錄。

罐子餘額不儲存，每次都從紀錄即時計算。

## 計算規則（修改 calc.js 前務必讀）

1. **計畫分配即時重算**：修改每月金額會重新計算所有月份。同月收入加總後分配；超過計畫的部分放入 `excessTo`；不足時依計畫金額等比例分配。「全部放入一罐」的收入不參與計畫。
2. **逐月推進**（`stats()`），每個月依序：
   1. 餘額 = 上月結轉 + 本月進 − 本月出。
   2. **超支墊付，不連鎖**：依步驟 1 的餘額算出每個罐子自己的不足額（`short`）；有 `coverBy` 的罐子補到 $0（顯示 $0 並標示超支），墊付罐子扣同樣金額。墊付罐子因此變負數時維持負數，不再觸發它自己的 `coverBy`。沒有 `coverBy` 的罐子維持負數，結轉罐子帶到下個月。接著扣掉自己寫入共用罐的 `cover` 紀錄（見第 9 條），同樣不連鎖。
   3. 月底：每月歸零的罐子把剩餘或不足結算進 `sweepTo`，自己歸零。
   4. 收入超過計畫的部分在 `planAlloc` 放入 `excessTo`。
   - 輸出：`monthOut`（自己的支出＋轉出，**不含**撥給共用罐的錢）；`monthJar`（撥款）、`jarCover`（共用罐墊付）、`jarOut`（兩者合計）、`jarParts`（`[{id:'sj:<jarId>', contrib, cover, amount}]`）；被墊付者 `over`、`coveredBy`；墊付者 `covered`、`coverParts`（只有個人罐子之間的墊付）；每個罐子 `short`；`sweepTo` 另有 `sweep`、`sweepParts`、`sweepMonth`。
3. **`excessTo`、`sweepTo` 一定結轉**（`carries()`），選單只列出會結轉的罐子。
4. **共用罐撥款**：從所屬罐子單向撥出；修改（金額或所屬罐子）只從當月起生效，過去月份維持原設定；撥款計算到「可切換的最遠月份」（`horizon()`：當月或已提前記帳的最遠月份）。v36 起共用罐不能手動轉入、轉出（記帳表單的轉移與「全部放入一罐」只列個人罐子；編輯舊紀錄時保留原本的共用罐選項），舊的轉移紀錄照常計算與 mirror。
5. **撥款紀錄由每位成員自己的裝置寫入共用罐**（`contrib_{uid}_{月份}`）。不同版本的裝置同時在線，可能互相覆蓋（尚未加版本保護）。
6. **個人支出 = 個人支出 + 撥給共用罐的錢**（v36 起；`ownSpend()` + `sharedSpend()`）：
   - 撥款與墊付算所屬罐子的支出：明細中由 `jarSpendItems()` 產生支出列（標題為共用罐名稱，副標題「每月撥款」「超支墊付」），數字和 `stats()` 的 `jarParts` 一致；計入總覽「這個月支出」（個人 $A＋美樂蒂 $B）、這個月各罐的「花了（含美樂蒂）」、明細合計與每日支出、圓餅圖（「全部」中共用罐一片；所屬罐子的分類圖中共用罐是一個分類，key 為 `sj:<jarId>`）、月結算的支出、分類排行與評等。
   - 共用罐內的共用支出**不計入**個人支出，避免重複計算。篩選共用罐時顯示它的所有紀錄，個人份額 = 金額 ÷ 記錄當下人數（`split`），僅供參考。
   - **顯示和計算分開**（v38）：總覽「這個月的紀錄」與明細「全部」由 `monthItems(month,'all')` 列出個人紀錄＋共用罐內的支出（`sharedExpenseItems()`，全額，副標題「美樂蒂・你記錄」），**不列**撥款與墊付；合計仍是 `ownSpend()` + `sharedSpend()`，每日標題的「支出」只加總個人支出，共用罐的金額另以淡色（`.dsh`）標示。篩選個人罐子時列出撥款與墊付（`jarSpendItems()`），不列共用罐內的支出；點撥款或墊付列會切換到該共用罐的篩選（同月份）。
7. **月初結算、本月超支墊付等系統紀錄只供顯示**，不計入收支合計、每日支出與圓餅圖。
8. **評等**：結餘率 =（收入 − 支出）÷ 收入；自己超支的罐子（`short > 0`）都算超支，不論有沒有被墊付；只因替別人（含共用罐）墊付而變負數的罐子不算。門檻在開發者選項調整，所有風格共用。
9. **共用罐超支依人數平分**（`jarOver()`，每位成員的裝置算出的結果必須一致）：
   - B(m) = open(m)（上月底餘額，含之前月份的墊付）+ 本月進（不含本月 `cover`）− 本月出；本月新超支 = max(0, −B) − max(0, −open)，小於 0 視為 0。之前沒人墊付的缺口不會再平分。
   - 每人份額 = `Math.round(新超支 ÷ 目前成員人數)`；人數變動時過去月份會重算。
   - 有 `coverBy`（`jarCoverSrc()`，從當月起生效；v36 起等於所屬罐子）時，自己的裝置寫入 `cover_{uid}_{月份}`（`desiredMirrors()`）；份額為 0 或未設定時刪除。共用罐把 `cover` 算進帳（`jarIn()`）。
   - 個人帳本從共用罐讀「自己寫的 `cover` 紀錄」，從 `srcId` 扣款，算這個罐子的支出（第 6 條），計入 `jarCover`／`jarParts`，不在 `covered`／`coverParts`（明細的「本月超支墊付」只列個人罐子之間的墊付）。退出或刪除共用罐後讀不到這些紀錄，扣款會消失。
   - v36 資料轉換 `migrateJarOwner()`（帳本旗標 `jarOwnerV36`，只做一次）：從當月起 `coverBy = src`（在 hist 補一筆當月的設定），過去月份不變，所以過去的餘額不變；原本的墊付罐子不同或不墊付時，在 `jarOwnerNote` 記下說明。
   - 尚未墊付 = 份額 − 該成員本月的 `cover` 紀錄；讓共用罐維持負數，並標示成員名稱。

## 改版流程

1. 每個版本開一個分支，命名格式為 `<類型>/<issue 編號>-<簡短描述>-v<版本號>`，
   例如 `feature/4-carry-month-share-v30`、`fix/5-startup-error-v31`。
   類型使用 `feature`（新功能）、`fix`（修正）、`refactor`（重構）、`docs`（文件）、`chore`（維護）。
2. APP_VERSION 加一，並在 js/changelog.js 的 CHANGELOG 最上方新增一筆：
   - `APP_VERSION` 在 `js/config.js`（`sw.js` 會自動使用同一個版本號，不用改）。
   - 新增的一筆為 `{v, date, items}`，`v` 必須等於 `APP_VERSION`（不一致時 Console 會警告，開發者選項的更新紀錄最上方會顯示提醒）。
   - `items` 用**給使用者看的口吻**撰寫；`t` 為 `new`（新功能）/ `imp`（改善）/ `fix`（修正）。
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
- 改到計算邏輯時，用具體數字驗算（例如：日常每月 24,000 花了 26,000 → 日常（coverBy 儲蓄）顯示 $0 並標示超支 $2,000，儲蓄當月少 $2,000，所有罐子合計等於實際剩下的錢）。
- 拆檔或搬移程式時，確認沒有新增的跨檔案頂層相依，也沒有重複宣告。

## 安全與資料

- **不要 commit** App 匯出的備份 JSON、CSV（已列在 `.gitignore`）。這個儲存庫就是網站根目錄，push 上去的檔案任何人都能讀取。
- `firebase-config.js` 的 `apiKey` 是公開資訊，不需要也不應該移除；資料安全由 Firestore 安全規則保護。
- 不要在程式碼、README 或 commit 中寫入任何個人資訊（Email、真實姓名、記帳內容）。

## 待辦

- [ ] 啟動錯誤提示：啟動失敗時顯示出錯的檔案，而不是卡在「載入中」
- [ ] 共用罐撥款紀錄加上版本保護：舊版裝置不覆蓋新版寫入的紀錄
- [ ] 測試腳本：把模擬瀏覽器的功能測試整理進專案，改版前自動執行