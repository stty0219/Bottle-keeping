# 開發流程

---

## 分支命名

格式：`<類型>/<issue 編號>-<簡短描述>-v<版本號>`

例如：`feature/4-carry-month-share-v30`、`fix/24-shared-cover-own-spending-v39`

| 類型 | 用途 | 跳版本號 |
|---|---|---|
| `feature` | 新功能 | 是 |
| `fix` | 修正 | 是 |
| `refactor` | 重構 | 是 |
| `docs` | 文件 | 否 |
| `chore` | 不影響功能的維護 | 否 |

- 每個版本開一個分支。
- `docs`、`chore` 不跳版本號，所以分支名稱省略 `-vXX`；issue 編號有就加，例如 `docs/restructure-readme`。

## commit 訊息

用中文撰寫：

| 類型 | 格式 |
|---|---|
| 新功能 | `feat: vXX，…` |
| 修正 | `fix: vXX，…` |
| 重構 | `refactor: vXX，…` |
| 文件 | `docs: …`（不跳版本號） |
| 維護 | `chore: …`（不跳版本號） |

- 內容較多時，第一行寫摘要，空一行後用條列寫內文。
- 修改 `firestore.rules` 時，在 commit 內文註明「需要把規則貼到 Firebase 主控台並發布」。
- 不要在 commit 中寫入個人資訊（Email、真實姓名、記帳內容）。

## PR 流程

1. 先開 issue，描述問題或想法。
2. 從 `main` 開分支（命名見上方），完成修改，通過 `npm test`（見[測試](#測試)）與[測試清單](#測試清單)。
3. 開 PR 合併到 `main`，標題與 commit 訊息第一行相同。內文會自動帶入 [PR 範本](../.github/pull_request_template.md)，依範本的檢查清單逐項確認。
4. GitHub Actions 會自動執行 `npm test`（`.github/workflows/test.yml`，檢查名稱為 `test`），失敗時先修正再合併。
5. 合併後 GitHub Pages 自動上線。如果有修改 `firestore.rules`，確認已在 Firebase 主控台發布。

## 改版步驟

1. **版本號**：`js/config.js` 的 `APP_VERSION` 加一。`sw.js` 會自動使用同一個版本號，不用改。
2. **更新紀錄**：在 `js/changelog.js` 的 `CHANGELOG` **最上方**新增一筆 `{v, date, items}`：
   - `v` 必須等於 `APP_VERSION`。不一致時，Console 會出現警告，開發者選項「更新紀錄」的最上方也會顯示提醒。
   - `items` 每一項為 `{t, s}`：`t` 是 `new`（新功能）、`imp`（改善）或 `fix`（修正）；`s` 用**給使用者看的口吻**撰寫。
   - 通知鈴鐺會顯示第一筆，開發者選項的「更新紀錄」列出所有版本。
3. **README 的「最新版本」**：把 `README.md` 最底下「最新版本」的內容整段換成這次的版本，和 `CHANGELOG` 第一筆一致：
   - 格式為 `**vXX**（YYYY-MM-DD）`，下面每個 item 一行 `- 新功能：…`／`- 改善：…`／`- 修正：…`，依新功能、改善、修正排序。
   - 只放最新的一個版本，不累積；更早的版本只記在 `CHANGELOG`。
4. **新增或刪除 `css/`、`js/` 的檔案時**：同步更新 `index.html` 的載入清單（注意順序，見 [architecture.md](architecture.md#script-載入順序與注意事項)）與 `sw.js` 的 `CORE`。
5. **修改 `firestore.rules` 時**：貼到 Firebase 主控台並發布（見 [deployment.md](deployment.md#4-firestore-與安全規則)）。
6. **更新文件**：
   - 檔案結構、資料結構有變時，更新 `docs/architecture.md`。
   - 計算規則有變時，更新 `docs/calculation-rules.md`。
   - 主要功能有變時，更新 `README.md`。
   - 完整的版本紀錄只寫在 `CHANGELOG`；README 只放最新的一個版本（第 3 步）。

## 測試

計算核心（`js/calc.js` 與相關的金額、合計、評等）與啟動流程有自動測試，使用 Node.js 內建的 `node:test`。需要 Node.js 22 以上。

### 在本機執行

```sh
npm install      # 第一次執行前安裝 jsdom（只有啟動測試需要；node_modules/ 不會被 commit）
npm test         # 執行所有測試
```

PR 與 push 到 `main` 時，GitHub Actions 也會自動執行（`.github/workflows/test.yml`，檢查名稱為 `test`）。

### 檔案結構

```
test/
  helpers/
    load-core.js        用 node:vm 依 index.html 的順序載入計算需要的檔案，提供最小的瀏覽器替身；固定「今天」為 2026-11-15
    ledger.js           建立測試帳本的小工具（罐子、紀錄、共用罐）
    invariant.js        不變量：所有個人罐子的合計 = 收入 − 支出 − 撥給共用罐的錢
  core/
    allocation.test.js      計畫分配
    monthly.test.js         花費型：月底歸零、留到下個月
    cover.test.js           超支墊付（不連鎖）、共用罐的撥款與墊付屬於所屬罐子（#24）
    savings.test.js         儲蓄型：本月淨存、轉移（v40）、沒有每月分配的罐子（#30）、目標金額
    shared-jars.test.js     共用罐：撥款從當月起生效、撥款到可切換的最遠月份、超支平分（v33）
    spending-grade.test.js  個人支出（#19）、評等
    migrate.test.js         舊資料轉換
    invariant.test.js       不變量（固定種子的隨機帳本）
  boot.test.js          用 jsdom 載入完整的 index.html，確認啟動沒有錯誤、三個分頁都能顯示
```

- 計算核心的測試**不需要修改 App 的程式**：App 的檔案是一般 script，`load-core.js` 在隔離的 context 中依序載入，再用 `run()`、`call()`、`stats()` 讀取結果。
- 啟動測試把 Firebase SDK、Google Fonts 等外部資源換成空內容，App 會以「僅存於此裝置」模式啟動，不需要網路，也不會連到正式的 Firebase。
- 測試帳本的資料一律虛構，不要放入真實的記帳內容（這個儲存庫是公開的網站根目錄）。

### 新增或修改計算規則時

- **必須一併新增或更新測試**，和 [calculation-rules.md](calculation-rules.md) 的修改放在同一個 PR。
- 每條測試都用具體數字，最好直接用 issue 討論或 calculation-rules.md 驗算範例中的數字，方便之後對照。
- 新情境也要檢查不變量（`assertInvariant()`）。
- 新增 `js/` 檔案時，如果計算會用到它，依 `index.html` 的順序加進 `load-core.js` 的 `FILES`。

## 測試清單

本機啟動方式見 [deployment.md](deployment.md#6-本機測試)。

每次修改後，至少確認：

- [ ] `npm test` 通過
- [ ] 主控台（Console）沒有錯誤，右上角沒有停在「載入中」
- [ ] 總覽、明細、設定三個分頁都能正常顯示
- [ ] 記一筆（支出、收入、轉移）、編輯與左滑刪除
- [ ] 修改到的功能本身
- [ ] 月結算畫面（有改到計算時）

視修改內容另外確認：

- **改到計算邏輯**：先執行 `npm test`，並為新規則新增測試（見[測試](#測試)）；用具體數字驗算，確認所有罐子的合計等於實際剩下的錢（範例見 [calculation-rules.md](calculation-rules.md#驗算範例)）。
- **拆檔或搬移程式**：確認沒有新增跨檔案的頂層相依，也沒有重複宣告。
- **改到共用罐或同步**：用兩個帳號、兩台裝置測試，而且**所有裝置都要更新到同一個版本**；不同版本的裝置同時開著時，可能互相覆蓋共用罐的撥款紀錄。
- **改到畫面或互動**：在手機上實機確認（iPhone Safari 的「加入主畫面」模式）、深色模式，以及動態效果設為「減少」「關閉」時的表現。

## 待辦

- [ ] 啟動錯誤提示：啟動失敗時顯示出錯的檔案，而不是停在「載入中」
- [ ] 共用罐撥款紀錄加上版本保護：舊版裝置不覆蓋新版寫入的紀錄
- [x] 測試腳本：計算核心與啟動測試，PR 時自動執行（#42）
