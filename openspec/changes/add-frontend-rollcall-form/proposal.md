# Change: 新增前端點名表單與 QR Code 掃描功能

## Why
使用者需要一個友善的介面來輸入帳號密碼並執行自動點名。目前只有 API 端點，沒有前端介面。此外，rollcall_goto 參數通常來自 QR Code，讓使用者手動複製貼上不方便，應提供掃描 QR Code 功能。

## What Changes
- 新增 Next.js 前端頁面，包含帳號密碼輸入表單
- 新增 QR Code 掃描功能，開啟鏡頭掃描後自動提取 `goto=` 參數
- 表單送出後呼叫 Backend `/rollcall/` API
- 顯示點名結果（成功/失敗）

## Impact
- Affected specs: frontend-rollcall (新增)
- Affected code: `frontend/src/app/`
