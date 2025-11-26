# Change: 新增自動點名 API 端點

## Why
現有的 `api.py` 只有基本的登入功能，使用舊的 `robot.py` 模組，且沒有接收 `rollcall_goto` 參數。前端需要一個完整的 API 端點來傳送帳號、密碼和 rollcall_goto，並執行自動點名流程。

## What Changes
- 新增 `/rollcall/` POST 端點，接收帳號、密碼和 rollcall_goto 參數
- 使用 Pydantic model 定義請求格式
- 整合 `AutoRollcall` 類別執行點名流程（使用 headless=True）
- 回傳結構化的執行結果（成功/失敗、訊息）
- 移除舊的 `/login/` 端點

## Impact
- Affected specs: rollcall-api (新增)
- Affected code: `api.py`
