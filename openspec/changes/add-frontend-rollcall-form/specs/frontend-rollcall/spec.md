## ADDED Requirements

### Requirement: 點名表單
系統 SHALL 提供一個表單，讓使用者輸入帳號和密碼。

#### Scenario: 顯示表單
- **WHEN** 使用者開啟前端頁面
- **THEN** 顯示帳號輸入欄位、密碼輸入欄位、rollcall_goto 欄位和送出按鈕

#### Scenario: 送出表單
- **WHEN** 使用者填寫完表單並點擊送出
- **THEN** 系統呼叫 Backend `/rollcall/` API 並顯示載入狀態

#### Scenario: 點名成功
- **WHEN** API 回傳成功
- **THEN** 顯示「點名成功」訊息

#### Scenario: 點名失敗
- **WHEN** API 回傳失敗
- **THEN** 顯示錯誤訊息

### Requirement: QR Code 掃描
系統 SHALL 提供 QR Code 掃描功能，讓使用者透過鏡頭掃描取得 rollcall_goto 參數。

#### Scenario: 開啟掃描器
- **WHEN** 使用者點擊「掃描 QR Code」按鈕
- **THEN** 系統開啟鏡頭並顯示掃描畫面

#### Scenario: 掃描成功
- **WHEN** 掃描到包含 `goto=` 參數的 URL
- **THEN** 系統提取參數值並自動填入 rollcall_goto 欄位

#### Scenario: 關閉掃描器
- **WHEN** 使用者點擊關閉或掃描完成
- **THEN** 系統關閉鏡頭
