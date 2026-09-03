## 1. 共用編解碼模組
- [x] 1.1 建立 `frontend/src/lib/share.ts`：envelope 型別、base64url 編解碼、`buildShareUrl()`、`parseShareUrl()`
- [x] 1.2 實作 `encryptPayload()` / `decryptPayload()`（WebCrypto PBKDF2-SHA256 600k + AES-256-GCM）
- [x] 1.3 `useAccounts` 新增 `upsertAccounts(items)`：同學號更新密碼與別名，回傳新增 / 更新數量

## 2. 匯入頁
- [x] 2.1 新增 `frontend/src/app/import/page.tsx`，掛載時讀取 `location.hash` 並立即 `history.replaceState` 清除
- [x] 2.2 無效或缺少 payload 時顯示錯誤與「回首頁」
- [x] 2.3 `enc: true` 時顯示密碼輸入，解密失敗顯示錯誤並允許重試
- [x] 2.4 顯示預覽清單（別名、學號、新增 / 更新標籤），預設全選，可取消勾選
- [x] 2.5 按「匯入」呼叫 `upsertAccounts`，顯示結果並導回首頁

## 3. 分享 UI
- [x] 3.1 `AccountManager` 每個帳號列新增分享按鈕（單一帳號）
- [x] 3.2 標題列「分享」改為進入多選模式，可勾選多個帳號後分享
- [x] 3.3 分享面板：選填密碼欄（最少 6 字元）、未加密警語、「分享」「複製連結」「顯示 QR」三個動作
- [x] 3.4 「分享」優先走 `navigator.share`，不支援時退回複製連結並顯示「已複製」
- [x] 3.5 QR Code 改為顯示分享連結，移除 `generateShareData()` 與 `nkust-import:` 格式
- [x] 3.6 帳號數 > 10 時在 QR 選項旁提示改用連結

## 4. 掃描器與首頁整合
- [x] 4.1 `page.tsx` 移除 `handleImportAccounts` 與 `importMessage`
- [x] 4.2 `handleScan` 偵測到本站 `/import#...` 連結時 `router.push` 到該路徑

## 5. 驗證與文件
- [ ] 5.1 手動測試：iOS Safari 分享單出現 AirDrop、Android Chrome 出現 Quick Share、桌機退回複製連結
- [ ] 5.2 手動測試：加密連結輸錯密碼顯示錯誤、輸對可匯入；同學號匯入後密碼被更新
- [ ] 5.3 確認 `/import` 開啟後網址列不含 fragment
- [x] 5.4 更新 README「多帳號管理」段落，說明分享連結與加密選項
