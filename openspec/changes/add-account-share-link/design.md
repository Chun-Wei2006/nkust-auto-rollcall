## Context
帳號資料（學號 + 明文密碼）只存在瀏覽器 localStorage，後端 stateless、沒有資料庫。分享功能必須在「不把帳密交給伺服器」的前提下，讓使用者能遠端（LINE、AirDrop）或面對面（QR）把帳號交給別人。

## Goals / Non-Goals
- Goals:
  - 一種格式打通連結、AirDrop、QR 三種入口
  - 可以只分享一個或部分帳號
  - 收件端匯入前看得到會發生什麼事（預覽、確認）
  - 提供選填的加密，降低連結留在聊天紀錄裡的風險
- Non-Goals:
  - 跨裝置同步、雲端備份
  - 伺服器端配對碼 / 暫存取件（見下方 Alternatives）
  - 改變帳號在 localStorage 的儲存方式

## Decisions

### Decision: payload 放在 URL fragment，路徑固定為 `/import`
瀏覽器不會把 `#` 之後的內容送出，Vercel access log 與後端都看不到帳密；LINE 等平台的連結預覽爬蟲也只抓得到 `/import`。不用 query string。

### Decision: 單一 JSON envelope，base64url 編碼
fragment 內容為 `base64url(JSON.stringify(envelope))`，envelope 結構：

```ts
// 明文
{ v: 1, enc: false, accounts: [{ u: string, p: string, l?: string }] }
// 加密
{ v: 1, enc: true, salt: string, iv: string, data: string } // 三者皆 base64url
```

`v` 用於日後改格式時能辨識舊連結。QR Code 內容就是完整的分享連結字串，掃描端與點連結端走同一個 decoder。目前不做壓縮；以 5 個帳號估算 fragment 約 400 字元，QR 與 LINE 都沒問題。若未來要放更多帳號再考慮 `CompressionStream`。

### Decision: 加密採 WebCrypto PBKDF2-SHA256（600,000 iterations）+ AES-256-GCM
- 隨機 16 bytes salt、12 bytes IV，每次分享重新產生
- 分享密碼最少 6 個字元，不限數字。連結外洩時攻擊者可離線暴力破解，太短的密碼沒有意義
- 介面文案要明講：加密只降低風險，不是保險箱；未加密的連結等同把密碼直接送出
- 不引入第三方加密套件，WebCrypto 在目標瀏覽器（iOS Safari、Android Chrome、桌機 Chromium）皆可用

### Decision: 分享動作的降級順序
1. `navigator.canShare?.({ url })` 為真 → `navigator.share({ title, url })`，系統分享單自帶 AirDrop / Quick Share / LINE
2. 否則 → `navigator.clipboard.writeText(url)` 並顯示「已複製」
3. 「顯示 QR」為獨立按鈕，不參與降級，給面對面情境用

### Decision: `/import` 頁在解析後立即清除 fragment
用 `history.replaceState` 把 URL 改回 `/import`，避免帳密留在網址列、瀏覽紀錄與分頁同步。payload 只留在 React state，離開頁面即消失。

### Decision: 同學號改為更新而非跳過
對方改密碼後重新分享是常見情境。預覽清單標示「新增」或「更新」，使用者仍可取消勾選。

### Alternatives considered
- **伺服器端配對碼（輸入 6 位數取件）**：需要後端加暫存狀態，等於開始替使用者保管帳密，就算加密仍多一個攻擊面，且與 README 的隱私承諾衝突。連結 + 密碼已覆蓋相同場景。
- **Web Share API 分享檔案（`.json`）**：iOS 上點開 JSON 檔不會導回本站，體驗比連結差，且多一種格式要維護。
- **沿用 `nkust-import:` 字串當 QR 內容**：無法直接用連結分享，等於要維護兩種格式。

## Risks / Trade-offs
- 未加密連結留在聊天紀錄 → 預設顯示加密密碼欄位並附警語；使用者自行決定
- 使用者忘記分享密碼 → 收件端顯示明確錯誤，重新請對方分享即可，沒有資料遺失
- PBKDF2 600k iterations 在低階手機約 0.5–1 秒 → 分享與匯入時顯示處理中狀態
- Fragment 過長導致 QR 密度過高難掃 → 帳號數 > 10 時提示改用連結分享

## Migration Plan
1. 新增 `share.ts` 與 `/import` 頁，先讓匯入端上線
2. 再切換 `AccountManager` 的分享 UI 到新格式，同時移除 `page.tsx` 中的 `handleImportAccounts`
3. 舊格式只在分享當下即時產生、不會被保存，無需相容或轉換
4. Rollback：整個 change 為純前端，revert commit 即可

## Open Questions
- 加密密碼欄位預設展開還是收合？目前傾向預設展開但留空可略過
