# 部署

分罐記帳部署在 GitHub Pages，帳號與資料同步使用 Firebase（Authentication + Firestore）。沒有建置流程，push 到 `main` 就是上線。

---

## 1. GitHub Pages

1. 所有檔案放在儲存庫的根目錄（`index.html` 在根目錄）。
2. Settings → Pages → Source 選「Deploy from a branch」，Branch 選 `main`、資料夾選 `/(root)`。
3. push 到 `main` 後，GitHub Pages 會自動更新。已安裝的 App 會在回到前景時偵測到新版本，通知鈴鐺提示重新載入（見 [architecture.md](architecture.md#離線與版本更新)）。

> **這個儲存庫就是網站根目錄**：push 上去的檔案，任何人都能用網址讀取。不要 push App 匯出的備份 JSON、CSV（已列在 `.gitignore`），也不要把任何個人資訊寫進程式碼、文件或 commit。

## 2. Firebase 專案

1. 在 Firebase 主控台建立專案，新增一個網頁應用程式，複製 `firebaseConfig`。
2. 把設定填進 `firebase-config.js`：
   ```js
   window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." };
   ```
   - 沒有設定（沒有 `apiKey`）時，App 仍可使用，但資料只存在這台裝置，共用罐與回報問題無法使用。
   - `firebase-config.js` 裡是公開的專案識別資訊，不是密碼，**必須 push**，也不應該移除；資料安全由 Firestore 安全規則保護。

## 3. Authentication

1. 登入方式：啟用「電子郵件/密碼」與「Google」。
2. 已授權網域：加入 `<username>.github.io`（本機測試用的 `localhost` 預設已在清單中）。
3. 接受共用邀請需要已驗證的 Email（Google 帳號預設已驗證；Email 註冊的帳號可以在 App 的「帳號與共用」寄送驗證信）。

## 4. Firestore 與安全規則

1. 建立 Firestore 資料庫。
2. 把 `firestore.rules` 的內容貼到 Firestore 的「規則」分頁，然後按「發布」。
3. **每次修改 `firestore.rules`，都要重新貼到主控台並發布。** push 到 GitHub 不會更新規則，`firestore.rules` 在儲存庫中只是版本紀錄。

### 安全規則

| 集合 | 讀取 | 寫入 |
|---|---|---|
| `ledgers/{id}` | 成員（只有本人） | 建立：自己是 `owner`，且是唯一成員；修改：不能改 `owner`、`members`；刪除：`owner` |
| `ledgers/{id}/txns` | 帳本成員 | 帳本成員 |
| `jars/{id}` | 成員 | 建立：自己是 `owner`，且是唯一成員；擁有者：可以改名稱、顏色、分類、移除成員，但不能轉移擁有者或把自己移出；成員：只能改共用分類，或退出（只能移除自己）；受邀者：有邀請且 Email 已驗證，才能把自己加入成員；刪除：`owner` |
| `jars/{id}/txns` | 成員 | 新增：`by` 必須是自己；修改：只有記錄者；刪除：記錄者，或擁有者（刪除整個罐子時） |
| `invites/{email}_{jarId}` | 邀請者，或 Email 已驗證的受邀者 | 建立：只有罐子的擁有者，文件 id 必須是 `Email_罐子ID`；刪除：邀請者或受邀者 |
| `reports/{id}` | 回報者本人或開發者 | 建立：用自己的身分、狀態為 `new`、`type` 合法、內容 ≤ 5000 字，且不能自己填 `issue`、`fixedIn`、`reply`；修改、刪除：只有開發者 |
| `reports/{id}/images/{0..2}` | 回報者本人或開發者 | 建立：回報者（和回報同一個 batch，用 `getAfter` 檢查）；刪除：只有開發者 |

各集合的欄位見 [architecture.md](architecture.md#firestore)。

## 5. 開發者帳號

開發者帳號的 Firebase uid 寫在**兩個地方，必須一致**：

| 位置 | 作用 |
|---|---|
| `js/config.js` 的 `DEV_UID` | 決定畫面上是否顯示「回報管理」 |
| `firestore.rules` 的 `isDev()` | 真正的權限：讀取所有回報、修改狀態與回覆、刪除回報 |

更換開發者帳號時，兩處一起改，並把 `firestore.rules` 重新發布到 Firebase 主控台。uid 可以在 Firebase 主控台 → Authentication → 使用者中查到。

## 6. 本機測試

在專案根目錄啟動任一個靜態伺服器，例如：

```sh
python -m http.server 8000      # macOS / Linux 可能要用 python3
```

然後打開 `http://localhost:8000`。

- 必須透過 `http://localhost` 開啟，直接開 `index.html`（`file://`）時 Service Worker 與 Firebase 登入無法運作。
- 本機連到的是正式的 Firebase 專案，登入後讀寫的就是真實資料。測試時建議使用另一個測試帳號。
- Service Worker 會快取檔案。如果改完看不到變化，重新整理一次；還是不行時，在開發者工具的 Application → Service Workers 勾選「Update on reload」。
- 測試項目見 [development.md](development.md#測試清單)。
