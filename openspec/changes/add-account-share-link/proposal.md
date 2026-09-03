# Change: 以分享連結取代整包 QR Code 的帳號分享流程

## Why
目前要把帳號給別人，只能一組一組手動輸入，或在「帳號管理」裡產生一張把**所有**帳號打包的 QR Code 讓對方用相機掃。實際情境多半是「把我一個帳號傳給幫我點名的同學」，而且常常是遠端透過 LINE 傳，不是面對面。現有流程無法選帳號、無法遠端傳送、入口又藏在收合區塊裡，等於沒人會用。

## What Changes
- 新增「分享連結」作為唯一的帳號傳輸格式：`https://<origin>/import#<payload>`，payload 放在 URL fragment，不會送到任何伺服器
- 每個帳號列新增分享按鈕，支援單一帳號分享與多選分享
- 分享時優先呼叫 Web Share API（`navigator.share`）叫出系統分享單，iOS/macOS 即可直接 AirDrop，Android 走 Quick Share；不支援時退回「複製連結」
- 保留 QR Code，但改成只是把分享連結畫成圖，與連結共用同一套編解碼
- 新增選填的分享密碼：有填則以 WebCrypto（PBKDF2 + AES-GCM）加密 payload，收件端需輸入密碼才能解開
- 新增 `/import` 頁面：解析 fragment、立即清除網址列中的 payload、顯示匯入預覽（新帳號 / 更新既有帳號）、勾選後才寫入 localStorage
- 匯入時同學號改為**更新密碼與別名**，不再直接跳過
- QR 掃描器掃到分享連結時導向 `/import` 流程
- **BREAKING**：移除舊的 `nkust-import:<base64>` QR 格式。該格式只在分享當下即時產生、不會被保存，因此不需要遷移

## Impact
- Affected specs: account-sharing（新增）
- Affected code:
  - `frontend/src/components/AccountManager.tsx`（分享 UI、移除舊 QR 產生邏輯）
  - `frontend/src/app/page.tsx`（移除 `handleImportAccounts`，掃描器改導向 `/import`）
  - `frontend/src/app/import/page.tsx`（新增）
  - `frontend/src/lib/share.ts`（新增：payload 編解碼、加解密）
  - `frontend/src/hooks/useAccounts.ts`（新增 upsert 批次匯入）
- 後端不變，維持「帳號資料不上傳伺服器」的承諾
