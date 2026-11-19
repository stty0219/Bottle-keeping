# 技術架構

分罐記帳是一個純前端的 PWA：瀏覽器直接載入 `index.html` 與 `css/`、`js/` 的檔案，**沒有框架、沒有建置流程**。帳號與資料同步使用 Firebase，網站部署在 GitHub Pages。

| 項目 | 使用技術 |
|---|---|
| 畫面 | HTML + CSS + 原生 JavaScript（一般 `<script>`，不是 ES module） |
| 離線 | Service Worker（`sw.js`）、Firestore 離線持久化（`enablePersistence({synchronizeTabs:true})`） |
| 帳號 | Firebase Authentication（Google、Email／密碼）；Firebase SDK 10.12.2 compat 版，從 gstatic 載入 |
| 資料庫 | Cloud Firestore |
| 權限 | Firestore 安全規則（`firestore.rules`） |
| 部署 | GitHub Pages（儲存庫根目錄就是網站根目錄） |

相關文件：計算規則見 [calculation-rules.md](calculation-rules.md)；部署與 Firebase 設定見 [deployment.md](deployment.md)。

---

## 離線與版本更新

- **Service Worker（`sw.js`）**
  - 快取名稱是 `fenguan-<版本>`。版本來自 `index.html` 註冊時帶的 `sw.js?v=<APP_VERSION>`，所以 `sw.js` 本身不用改版本號。
  - 安裝時預先快取 `CORE` 清單中的檔案（App 啟動需要的所有檔案）。
  - 自己網域的檔案一律**網路優先**，並向伺服器驗證（`cache:'no-cache'`），避免 `index.html`、`css/`、`js/` 混用不同版本；離線時才使用快取。
  - 只快取自己網域、字型（Google Fonts）與 Firebase SDK（`www.gstatic.com`）。Firebase 的登入與資料連線一律直接走網路。
- **新版本偵測（`js/notify.js`）**：啟動 8 秒後，以及 App 回到前景時（最多每 15 分鐘一次），讀取線上的 `js/config.js` 比對 `APP_VERSION`；版本不同時，通知鈴鐺提示重新載入。

---

## 檔案結構與職責

```
index.html             畫面骨架；CSS 與 JS 的載入順序寫在這裡
sw.js                  Service Worker：離線快取（CORE 清單）
firebase-config.js     Firebase 專案設定（公開資訊，必須 push）
firestore.rules        Firestore 安全規則（修改後要貼到 Firebase 主控台）
manifest.webmanifest   PWA 設定
icon-192.png / icon-512.png / apple-touch-icon.png
css/
  base.css             配色變數（含深色模式）、版面、共用元件、分頁列、提示訊息、動態效果
  notify.css           通知鈴鐺與通知面板
  home.css             總覽：罐子、各罐收支、拖拉排序、超支樣式
  list.css             明細：紀錄列、月初結算、圓餅圖、搜尋、左滑刪除
  sheet.css            底部表單：記帳、計算機鍵盤、分類面板、emoji 與顏色面板
  settings.css         設定頁
  dev.css              開發者選項
  report.css           回報問題：表單、我的回報、回報管理、鈴鐺的回報通知
  summary.css          月結算的共用版面與動畫
  themes.css           月結算的 7 種風格（.th-<id>）
docs/                  專案文件
```

### js/

依載入順序排列：

| 檔案 | 職責 |
|---|---|
| `config.js` | `APP_VERSION`（新版本偵測會讀取線上的這個檔案）、`DEV_UID`（開發者帳號）、程式錯誤紀錄（最早載入，記錄 `error`／`unhandledrejection` 最近 10 筆） |
| `changelog.js` | `CHANGELOG`：所有版本的更新紀錄（由新到舊）；`changelogOk()` 檢查第一筆是否等於 `APP_VERSION` |
| `state.js` | 共用工具（`uid`、`today`、`esc`、`money`）、預設資料 `defaults()`、全域狀態 `S`、明細頁的篩選狀態、本機儲存 |
| `cloud.js` | Firebase 初始化、登入狀態監聽、帳本與紀錄的同步、寫入流程（`persist`、`putTxn`、`removeTxn`、`replaceAll`）、`safeRender()` |
| `shared-jars.js` | 共用罐：監聽罐子與紀錄、邀請、成員管理、撥款與墊付紀錄的同步（mirror）、`migrateSharedCats()` |
| `account.js` | 登入、註冊、重設密碼、登出 |
| `setup.js` | 舊資料轉換 `migrate()`、`migrateAlloc()`；防止雙指縮放；動態效果設定 |
| `notify.js` | 通知鈴鐺（目前版本的更新內容、v36 轉換說明、回報通知）、新版本偵測 |
| `init.js` | 啟動流程 `init()`、匯出／還原備份、匯出 CSV |
| `calc.js` | 計算核心：計畫分配、共用罐撥款、結轉、月底結算、超支墊付、共用罐超支平分；`migrateCover()`、`migrateJarPlan()`、`migrateJarOwner()` |
| `views/home.js` | `render()`、總覽頁；以及明細與總覽共用的紀錄清單 `monthItems()`、`jarSpendItems()`、`sharedExpenseItems()` |
| `views/list.js` | 明細頁：紀錄列、月初結算、本月超支墊付、圓餅圖、搜尋 |
| `views/settings.js` | 設定頁（分區展開狀態、支出分類分組） |
| `summary.js` | 月結算畫面、評等、結算風格 `THEMES`、`migrateTheme()` |
| `dev.js` | 開發者選項（連點設定頁的版本號 7 次開啟）：評等條件、結算風格、更新紀錄、回報管理 |
| `report.js` | 回報問題：監聽 `reports`、送出（圖片壓縮）、我的回報、回報管理、鈴鐺的新回報／新進度 |
| `sheet.js` | 底部表單的開關、下拉收合、背景鎖定捲動、emoji 面板 |
| `color.js` | 罐子顏色面板（推薦色、我的顏色）、依底色決定文字顏色、`migrateColors()` |
| `entry.js` | 記一筆／編輯：計算機鍵盤、分類列與分類面板、存檔 |
| `ui.js` | 提示訊息（含復原）、左滑刪除 |
| `reorder.js` | 拖拉排序：總覽長按罐子、設定頁罐子與分類（組內）的 ≡ 把手 |
| `main.js` | 事件分派（click／input／change），最後呼叫 `init()` 啟動 |

---

## script 載入順序與注意事項

`index.html` 依序載入：

```
firebase-config.js → Firebase SDK（app、auth、firestore compat）
→ js/config.js → changelog.js → state.js → cloud.js → shared-jars.js → account.js
→ setup.js → notify.js → init.js → calc.js → views/home.js → views/list.js
→ views/settings.js → summary.js → dev.js → report.js → sheet.js → color.js
→ entry.js → ui.js → reorder.js → main.js
```

所有 JS 檔案共用同一個全域範圍，因此：

- **檔案頂層直接執行的程式碼，只能使用前面已載入的檔案定義的東西。** 例如 `changelog.js` 頂層會讀 `APP_VERSION`，所以 `config.js` 必須排在它前面；`setup.js` 頂層會呼叫 `applyMotion()`。
- **函式宣告不會跨檔案提升。** 在函式內部互相呼叫沒有問題（呼叫時所有檔案都已載入）。`init()` 在 `main.js` 的最後才呼叫，所以啟動流程可以用到任何檔案的函式。
- **不要在兩個檔案用 `const`／`let` 宣告同名的變數**，會造成 SyntaxError，整個檔案都不會執行。
- **任何一個檔案載入失敗，App 會停在右上角顯示「載入中」的狀態。** 載入失敗的檔名會記到錯誤紀錄。
- 新增或刪除 `css/`、`js/` 的檔案時，要同時更新 `index.html` 的載入清單（注意順序）與 `sw.js` 的 `CORE`。

### 事件與畫面更新

- 互動元素用 `data-action="xxx"` 標記，由 `main.js` 的 click／input／change 監聽器依 `data-action`、`data-edit` 分派。不要寫 inline `onclick`。
- 畫面更新呼叫 `render()`。雲端同步觸發的重繪使用 `safeRender()`：使用者正在編輯 `#view` 裡的輸入框時，先暫緩重繪，離開欄位後才更新。

---

## 資料結構

罐子餘額**不儲存**，每次都從紀錄即時計算。所以修改過去的紀錄後，之後月份的結轉與結算會自動跟著更新。

### 全域狀態 `S`

存在 localStorage 的 `fenguan-ledger-v1`；登入後與 Firestore 的 `ledgers/{ledgerId}` 同步。

| 欄位 | 說明 |
|---|---|
| `buckets[]` | 個人罐子 `{id, name, color, amt, carry, coverBy}`。`amt` 是每月金額；`carry:false` 表示每月歸零；`coverBy` 是超支時墊付的個人罐子 id（`null` 表示不墊付，不能是自己）。舊資料可能留有 `pct`（比例），已不使用 |
| `categories[]` | 個人分類 `{id, emoji, name, bucketId}`。`bucketId` 只能是個人罐子；陣列順序就是設定頁與分類面板中各組內的順序 |
| `txns[]` | 個人紀錄，見下方「紀錄」 |
| `allocMode` | 固定為 `'amount'`（比例模式已在 v26 移除，舊資料由 `migrateAlloc()` 轉換） |
| `excessTo` | 收入超過計畫的錢放入的罐子 |
| `sweepTo` | 歸零罐子月底的剩餘或不足放入的罐子 |
| `remainderId` | v31 以前的「指定罐子」。v32 起只由 `migrateCover()` 讀取（帳本沒有 `excessTo`、`sweepTo` 時轉換）；寫回雲端時填入 `sweepTo` 的值，給舊版裝置使用 |
| `jarPlan{}` | 自己對各共用罐的撥款設定，key 是共用罐 id：`{from, until, name, hist[]}`。`from` 是開始撥款的月份；`until` 是不再是成員後停止的月份（不含）；`name` 是共用罐名稱的備份；`hist[]` 每筆 `{m, amt, src, coverBy}`，從 `m` 月起生效 |
| `jarOwnerV36` | v36 共用罐所屬罐子轉換（`migrateJarOwner()`）已完成的旗標 |
| `jarOwnerNote` | 轉換時改掉的墊付設定說明 `{at, items[]}`，顯示在通知面板 |
| `shelfOrder[]` | 總覽的罐子順序（含共用罐 `sj:<jarId>`） |
| `myColors[]` | 我的顏色（色碼，最多 16 個；個人罐子與共用罐的顏色面板共用） |
| `gradeRules` | 評等條件 `{sRate, aRate, bMaxOver}`；`null` 時使用預設值 |
| `sumTheme` | 月結算風格 id |
| `themeText{}` | 各風格自訂的稱號與評語 `{<風格id>: {titles, comments}}` |
| `gradeComments` | v22 的評語，已由 `migrateTheme()` 轉入 `themeText.classic`；寫回雲端時一律填 `null` |
| `ledgerId`、`ledgerOwner`、`ledgerName` | 只存在本機，記錄這台裝置連到哪個雲端帳本；匯出備份時不包含 |

`jarPlan.hist` 的欄位：

- `src` 是共用罐的**所屬罐子**（撥款來源）。
- `coverBy` 是共用罐超支時，自己的份額由哪個個人罐子墊付。
- v36 起，`setJarPlan(jid,'src',…)` 會同時改 `coverBy`，兩者一律相同；v35 以前的月份可能不同或為 `null`，維持原樣。
- 新的共用罐用 `newJarPlan()` 建立；修改一律透過 `setJarPlan()`（只從當月起生效）。

#### 紀錄（`txns[]` 與 `ledgers/{id}/txns`）

共同欄位：`{id, ts, type, amount, date, note}`；`date` 為 `YYYY-MM-DD`，`ts` 為建立時間。

| `type` | 其他欄位 |
|---|---|
| `income` | `mode`：`'pct'` 依每月計畫分配；`'one'` 全部放入 `target` |
| `expense` | `catId`、`bucketId` |
| `transfer` | `from`、`to`（v36 起不能選共用罐；舊紀錄可能是 `sj:<jarId>`） |

`id` 以 `sj:` 開頭的值代表共用罐（`isSJ()`、`sjId()`）。

### localStorage

| key | 內容 |
|---|---|
| `fenguan-ledger-v1` | 全域狀態 `S` |
| `fenguan-errlog` | 最近 10 筆程式錯誤 `[{m, src, t}]`（回報問題時可以附上，畫面上不顯示） |
| `fenguan-motion` | 動態效果設定：`standard`／`reduce`／`off`（沒有設定時依系統的「減少動態效果」） |
| `fenguan-notice` | 通知鈴鐺：看過哪個版本的更新內容、何時看過、是否清除（更新內容顯示 24 小時） |
| `fenguan-mignote` | 這台裝置已清除的 v36 轉換說明（記 `jarOwnerNote.at`） |
| `fenguan-rptseen` | 回報者在這台裝置已看過的回報進度 `{reportId: sig}` |
| `fenguan-dev` | 開發者模式是否開啟 |
| `fenguan-setopen` | 設定頁展開的分區 |
| `fenguan-catopen` | 支出分類展開的分組 |
| `fenguan-memclosed` | 帳號與共用中收合的成員區塊 |
| `fenguan-sumsort` | 月結算分類排行的排序方式 |
| `fenguan-colors` | v28 的「最近使用」顏色，只在轉入「我的顏色」時讀取 |

### Firestore

```
ledgers/{ledgerId}                 個人帳本
ledgers/{ledgerId}/txns/{id}       個人紀錄
jars/{jarId}                       共用罐
jars/{jarId}/txns/{id}             共用罐紀錄
invites/{email}_{jarId}            共用邀請
reports/{reportId}                 App 內回報
reports/{reportId}/images/{n}      回報的圖片
```

**`ledgers/{ledgerId}`**：`name`、`owner`、`members[]`（只有本人）、`createdAt`、`updatedAt`，以及 `S` 中會同步的欄位（`buckets`、`categories`、`allocMode`、`excessTo`、`sweepTo`、`remainderId`、`jarPlan`、`shelfOrder`、`gradeRules`、`sumTheme`、`themeText`、`myColors`、`jarOwnerV36`、`jarOwnerNote`、`gradeComments`）。

**`jars/{jarId}`**：`owner`、`members[]`、`memberInfo{uid: {name, email}}`、`name`、`color`、`categories[]`（共用分類 `{id, emoji, name}`，陣列順序即顯示順序，在設定頁「支出分類」管理）、`createdAt`、`updatedAt`。

**`jars/{jarId}/txns/{id}`**：共同欄位 `kind`、`amount`、`date`、`note`、`by`（記錄者 uid）、`byName`。

| `kind` | 說明 | 寫入者與文件 id |
|---|---|---|
| `expense` | 共用支出；另有 `emoji`、`catName`、`catKey`、`split`（記錄當下的成員人數）、`ts` | 記錄者，任意 id |
| `contrib` | 每月撥款；`src`、`srcId` = 所屬罐子的名稱與 id | 各成員自己的裝置，`contrib_{uid}_{月份}` |
| `cover` | 共用罐超支時自己的份額；`src`、`srcId` = 墊付的罐子 | 各成員自己的裝置，`cover_{uid}_{月份}` |
| `in` | 舊的轉入，或「全部放入一罐」放進共用罐的收入 | 由個人紀錄 mirror，`m_{個人紀錄 id}` |
| `withdraw` | 舊的轉出 | 由個人紀錄 mirror，`m_{個人紀錄 id}` |

**`invites/{email}_{jarId}`**：`jid`、`owner`（邀請者 uid）、`email`（受邀者，小寫）、`jarName`、`fromName`、`createdAt`。

**`reports/{reportId}`**：

| 欄位 | 說明 |
|---|---|
| `uid`、`name`、`email` | 回報者 |
| `type` | `bug`（問題）／`idea`（建議）／`other`（其他） |
| `area` | 相關功能（選填）：總覽、明細、記帳、月結算、共用罐、設定、其他 |
| `text` | 內容（最多 5000 字） |
| `imageCount` | 圖片數量（最多 3 張） |
| `appVersion` | App 版本（一定附上） |
| `device`、`diag` | 勾選「一併附上」時才有：`{ua, screen, viewport, standalone, lang}`、最近 10 筆程式錯誤 `[{m, src, t}]` |
| `status` | `new` 未讀／`read` 已讀／`doing` 處理中／`done` 已解決／`wontfix` 不處理 |
| `issue`、`fixedIn`、`reply` | GitHub issue 編號、修正的版本、開發者的回覆（選填，只有開發者能寫） |
| `createdAt`、`updatedAt`、`statusChangedAt` | 時間 |

**`reports/{reportId}/images/{0..2}`**：`data` = 壓縮後的 JPEG（base64）。長邊先縮到 1280 像素，太大時依序改為 960、720，畫質 0.7～0.4，單張不超過 700KB。和回報在同一個 batch 寫入。回報不使用 Cloud Storage。

各集合的讀寫權限見 [deployment.md](deployment.md#安全規則)。

---

## 舊資料轉換

啟動時（`init()`）、還原備份時（`replaceAll()`）與收到雲端帳本時（`subscribe()`）會執行轉換，已轉換過的資料不會再變動。

| 函式 | 檔案 | 內容 |
|---|---|---|
| `migrate()` | `setup.js` | 很舊的收入紀錄（`alloc`）轉成 `mode`（只在啟動與還原時執行） |
| `migrateAlloc()` | `setup.js` | v26：比例分配轉成每月金額，`allocMode` 改為 `'amount'` |
| `migrateCover()` | `calc.js` | v32：`remainderId` 轉成 `excessTo`、`sweepTo` 與歸零罐子的 `coverBy`；清除無效的 `coverBy`、`excessTo`、`sweepTo` |
| `migrateJarPlan()` | `calc.js` | 舊的撥款設定（`amt`）轉成 `hist[]` |
| `migrateJarOwner()` | `calc.js` | v36：從當月起 `coverBy = src`，過去月份不變；改到的設定記在 `jarOwnerNote` |
| `migrateTheme()` | `summary.js` | v22 的 `gradeComments` 轉入 `themeText.classic`（還原備份時不執行） |
| `migrateColors()` | `color.js` | v28 本機的「最近使用」顏色轉入 `myColors` |
| `migrateSharedCats()` | `shared-jars.js` | v34：扣共用罐（`sj:<jarId>`）的個人分類，轉成該共用罐的共用分類；已不是成員時改扣第一個個人罐子。只在共用罐清單由伺服器確認後執行 |

---

## 雲端同步

- **登入後連線（`cloudConnect()`）**：找出自己的帳本，沒有就把這台裝置的資料上傳成新帳本。雲端已有帳本、而這台裝置也有紀錄時，會先詢問，同意後把本機資料下載成備份檔，再改用雲端帳本。
- **監聽（`subscribe()`）**：帳本文件與 `txns` 子集合各一個監聽器。收到帳本後執行舊資料轉換，有變動就寫回。
- **寫入**：設定類的變動用 `persist()`（延遲 600ms 合併寫入整份帳本設定）；紀錄用 `putTxn()`／`removeTxn()` 逐筆寫入。
- **共用罐（`startJars()`）**：監聽自己是成員的 `jars`，以及每個罐子的 `txns`。成員關係變動時，同步調整 `jarPlan`（新罐子建立撥款設定；不再是成員時設定 `until`）。
- **mirror（`desiredMirrors()`、`syncMirrors()`）**：每台裝置依自己的 `jarPlan` 與個人紀錄，算出應該存在於共用罐、由自己寫入的紀錄（`contrib`、`cover`、`m_` 開頭的 `in`／`withdraw`），和共用罐中實際的紀錄比對後新增、更新或刪除。資料有變動時延遲 1.2 秒執行。
  - 不同版本的裝置同時在線時，可能互相覆蓋撥款紀錄（尚未加版本保護）。

---

## 回報問題（`js/report.js`）

- **監聽**：一般帳號只監聽 `where('uid','==',自己)`，開發者監聽整個 `reports`。排序在手機上做，不需要複合索引。
  - 登入時 `startReports()`、登出時 `stopReports()`。這兩個寫在 `onAuthStateChanged`，不在 `cloudStop()`，因為 `subscribe()` 會先呼叫 `cloudStop()`。
- **回報管理**只看登入帳號是否為開發者（`isDev()`：uid 等於 `DEV_UID`），**不看**開發者模式（任何人都能開啟開發者模式）。真正的權限由 `firestore.rules` 的 `isDev()` 控制，兩處的 uid 必須一致（見 [deployment.md](deployment.md#5-開發者帳號)）。
- 開發者打開未讀的回報時，自動改為已讀。
- **回報者的新進度**：狀態（未讀與已讀都視為沒有進度）＋ issue ＋ 修正版本 ＋ 回覆組成的字串，和 `fenguan-rptseen` 中記的不同，就算有新進度。這台裝置第一次載入時，現有的進度全部當作已看過。開發者本人的回報不顯示新進度。
- 回報不包含任何記帳資料或金額；一般畫面不顯示錯誤紀錄。
