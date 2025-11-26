## ADDED Requirements

### Requirement: Rollcall API Endpoint
系統 SHALL 提供 `/rollcall/` POST 端點，接收使用者帳號、密碼和 rollcall_goto 參數，執行自動點名流程。

#### Scenario: 點名成功
- **WHEN** 前端發送有效的帳號、密碼和 rollcall_goto
- **THEN** 系統執行自動點名流程並回傳 `{"success": true, "message": "點名成功"}`

#### Scenario: 登入失敗
- **WHEN** 前端發送無效的帳號或密碼
- **THEN** 系統回傳 `{"success": false, "message": "登入失敗"}` 和 HTTP 401 狀態碼

#### Scenario: 缺少必要參數
- **WHEN** 前端未提供必要的參數（username、password、rollcall_goto）
- **THEN** 系統回傳 HTTP 422 驗證錯誤

### Requirement: Request Model
API SHALL 使用 Pydantic model 定義請求格式：
- `username`: str（必填）
- `password`: str（必填）
- `rollcall_goto`: str（必填）

#### Scenario: 請求格式驗證
- **WHEN** 前端發送 JSON body 包含 username、password、rollcall_goto
- **THEN** 系統正確解析請求參數

### Requirement: Response Model
API SHALL 回傳結構化的 JSON 回應：
- `success`: bool
- `message`: str

#### Scenario: 成功回應格式
- **WHEN** 點名流程完成
- **THEN** 回傳 `{"success": true, "message": "點名成功"}`

#### Scenario: 失敗回應格式
- **WHEN** 點名流程失敗
- **THEN** 回傳 `{"success": false, "message": "<錯誤訊息>"}`
