## ADDED Requirements

### Requirement: Zuvio 帳號登入
系統 SHALL 提供 `POST /zuvio/login/` 端點，接收 Zuvio Email 與密碼，透過 Zuvio token API 登入並回傳 `user_id` 與 `access_token`。後端 MUST NOT 保存任何帳號或 token。

#### Scenario: 登入成功
- **WHEN** 使用者提供正確的 Zuvio Email 與密碼
- **THEN** 回應 `success: true`，並附上 `user_id`、`access_token` 與使用者名稱

#### Scenario: 帳密錯誤
- **WHEN** Zuvio 回應登入失敗
- **THEN** 回應 `success: false` 與 Zuvio 回傳的錯誤訊息，HTTP 狀態碼仍為 200

### Requirement: 課程列表
系統 SHALL 提供 `POST /zuvio/courses/` 端點，接收 `user_id` 與 `access_token`，回傳該學生目前修習的課程清單（`course_id`、`course_name`、`teacher_name`）。

#### Scenario: 取得課程
- **WHEN** 提供有效的 token
- **THEN** 回應 `success: true` 與課程陣列

#### Scenario: token 失效
- **WHEN** Zuvio 回應 token 無效
- **THEN** 回應 `success: false` 且 `token_expired: true`，讓前端重新登入

### Requirement: GPS 點名
系統 SHALL 提供 `POST /zuvio/rollcall/` 端點，接收 `user_id`、`access_token`、`lat`、`lng` 與 `course_ids`，對每門課查詢點名狀態，開放中的課程 MUST 以指定座標送出簽到，並回傳每門課的結果。

#### Scenario: 課程點名開放中
- **WHEN** 某課程的 `getRollcall` 回傳有效的 `rollcall_id`
- **THEN** 以 `device: WEB` 及指定的 `lat`、`lng` 呼叫 `makeRollcall`，該課程結果為 `success` 並附 Zuvio 訊息

#### Scenario: 課程尚未開放
- **WHEN** 某課程沒有進行中的點名
- **THEN** 該課程結果為 `not_open`，不呼叫 `makeRollcall`

#### Scenario: 簽到被拒絕
- **WHEN** `makeRollcall` 回傳 `status: false`
- **THEN** 該課程結果為 `failed`，`message` 為 Zuvio 回傳的 `msg` 原文

#### Scenario: 座標範圍檢查
- **WHEN** `lat` 不在 -90～90 或 `lng` 不在 -180～180
- **THEN** 回應 HTTP 422，不呼叫 Zuvio

### Requirement: Zuvio 帳號管理
前端 SHALL 提供獨立於高科大帳號的 Zuvio 帳號管理，儲存於 localStorage `zuvio_accounts`，每筆包含 Email、密碼、選填別名與選填的監控課程。

#### Scenario: 新增與編輯帳號
- **WHEN** 使用者新增或編輯 Zuvio 帳號
- **THEN** 資料只寫入瀏覽器 localStorage，不上傳伺服器

#### Scenario: 載入課程並選擇
- **WHEN** 使用者對某帳號按「載入課程」
- **THEN** 前端登入取得 token、取得課程清單並顯示下拉選單，選擇的課程存回該帳號的 `courseId`；選「全部課程」時監控全部課程。Zuvio 官方活動（teacher_name 含 Zuvio）不列入

### Requirement: GPS 座標設定
前端 SHALL 提供全域的 GPS 座標設定，儲存於 localStorage `zuvio_location`。輸入方式 MUST 支援直接貼上 Google 地圖的座標字串（如 `22.725299, 120.316478`），並提供「使用目前位置」按鈕以瀏覽器定位填入。

#### Scenario: 貼上 Google 地圖座標
- **WHEN** 使用者貼上 `22.725299, 120.316478` 這類「緯度, 經度」字串
- **THEN** 解析為緯度 22.725299、經度 120.316478 並顯示；格式無法解析時顯示錯誤且不儲存

#### Scenario: 在地圖上選點
- **WHEN** 使用者按「在地圖上選點」
- **THEN** 顯示可拖動的地圖（街道圖與衛星圖可切換，預設衛星圖）與中央準星，按「使用此位置」後以準星所在的座標填入並儲存

#### Scenario: 使用目前位置
- **WHEN** 使用者按「使用目前位置」且允許定位
- **THEN** 緯度與經度欄位填入 `navigator.geolocation` 的結果

#### Scenario: 未設定座標
- **WHEN** 座標為空
- **THEN** 「立即點名」與「自動監控」按鈕停用

### Requirement: 立即點名與自動監控
前端 SHALL 提供「立即點名」（對所有勾選帳號呼叫一次 `/zuvio/rollcall/`）與「自動監控」（頁面開啟期間每 30 秒呼叫一次）。token MUST 只保存在記憶體，token 失效時 MUST 自動重新登入一次後重試。

#### Scenario: 自動監控命中
- **WHEN** 自動監控期間某課程回傳 `success`
- **THEN** 顯示成功紀錄與時間，該課程在本次監控中不再重複簽到

#### Scenario: 監控時保持螢幕喚醒
- **WHEN** 自動監控開始且瀏覽器支援 Screen Wake Lock
- **THEN** 要求螢幕保持喚醒，停止監控時釋放

#### Scenario: 停止監控
- **WHEN** 使用者按「停止監控」或離開頁面
- **THEN** 清除輪詢計時器，不再發出請求
