# Change: 新增 Zuvio GPS 點名

## Why
除了高科大 Moocs 的 QR Code 點名，不少課程改用 Zuvio 的 GPS 定位點名。學生要在點名開放的幾分鐘內打開 Zuvio、允許定位、按下簽到，人不在教室就點不到。現有的自動點名工具（如 Demohu/zuvio-rollcall-bot）靠 Selenium 開瀏覽器輪詢，無法跑在只有 1 GB 記憶體的自架 VM 上，也沒有網頁介面。

## What Changes
- 新增 Zuvio 帳號類型：Email + 密碼，與現有的高科大學號帳號**分開儲存**（localStorage `zuvio_accounts`），不共用、不互相匯入
- 後端新增 `backend/src/zuvio.py`：以純 HTTP 呼叫 Zuvio 的 token API（`app_v2/login`、`course/listStudentCurrentCourses`、`app_v2/getRollcall`、`app_v2/makeRollcall`），不用瀏覽器
- 後端新增三個端點：`POST /zuvio/login/`、`POST /zuvio/courses/`、`POST /zuvio/rollcall/`。後端維持無狀態，token 由前端在記憶體中持有並於後續請求帶回
- 前端首頁新增「高科大 QR 點名 / Zuvio GPS 點名」模式切換，Zuvio 面板提供：帳號管理、GPS 座標設定（手動輸入或取用瀏覽器定位）、課程載入與勾選、立即點名、自動監控（頁面開著時定期輪詢，點名開放即自動簽到）
- 不做：Telegram / Discord 通知、桌面 GUI、伺服器端背景排程（後端不保存任何帳號或 token）

## Impact
- Affected specs: zuvio-rollcall（新增）
- Affected code:
  - `backend/src/zuvio.py`（新增）
  - `backend/src/api.py`（新增三個端點與 pydantic model）
  - `frontend/src/hooks/useZuvioAccounts.ts`（新增）
  - `frontend/src/components/ZuvioPanel.tsx`（新增）
  - `frontend/src/app/page.tsx`（模式切換）
  - README（功能說明與 API 文件）
- 現有 `/rollcall/` 端點與高科大帳號流程不變
