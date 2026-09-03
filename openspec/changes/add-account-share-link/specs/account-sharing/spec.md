## ADDED Requirements

### Requirement: 分享連結格式
系統 SHALL 以 `https://<origin>/import#<payload>` 形式的分享連結作為帳號傳輸的唯一格式。payload MUST 放在 URL fragment，MUST NOT 出現在 path 或 query string。payload 為 base64url 編碼的 JSON envelope，envelope MUST 包含版本欄位 `v`。

#### Scenario: 產生明文分享連結
- **WHEN** 使用者選擇一個或多個帳號並在未填寫分享密碼的情況下分享
- **THEN** 系統產生 envelope `{ v: 1, enc: false, accounts: [...] }`，每個帳號包含學號、密碼與選填別名，並編碼為分享連結

#### Scenario: 產生加密分享連結
- **WHEN** 使用者填寫至少 6 個字元的分享密碼並分享
- **THEN** 系統以 PBKDF2-SHA256 由密碼推導金鑰、以 AES-GCM 加密帳號資料，產生 envelope `{ v: 1, enc: true, salt, iv, data }` 並編碼為分享連結

#### Scenario: 分享密碼過短
- **WHEN** 使用者填寫的分享密碼少於 6 個字元
- **THEN** 系統拒絕產生連結並提示最少字元數

#### Scenario: 帳密不經過伺服器
- **WHEN** 收件端開啟分享連結
- **THEN** 瀏覽器送往伺服器的請求 MUST 只包含 `/import` 路徑，不包含 fragment 內容

### Requirement: 選擇要分享的帳號
系統 SHALL 允許使用者分享單一帳號或自選的多個帳號，MUST NOT 強制一次分享全部帳號。

#### Scenario: 分享單一帳號
- **WHEN** 使用者點擊某個帳號列上的分享按鈕
- **THEN** 系統開啟分享面板，且分享內容只包含該帳號

#### Scenario: 分享多個帳號
- **WHEN** 使用者點擊「分享」進入多選模式並勾選多個帳號
- **THEN** 系統開啟分享面板，分享內容包含所有勾選的帳號

### Requirement: 分享動作與降級
系統 SHALL 在支援 Web Share API 的裝置上透過系統分享單分享連結，並在不支援時退回複製連結。系統 SHALL 另外提供以 QR Code 顯示同一連結的選項。

#### Scenario: 支援 Web Share API
- **WHEN** 使用者點擊「分享」且 `navigator.canShare({ url })` 為真
- **THEN** 系統呼叫 `navigator.share` 開啟系統分享單，由使用者選擇 AirDrop、Quick Share、通訊軟體等目標

#### Scenario: 不支援 Web Share API
- **WHEN** 使用者點擊「分享」且瀏覽器不支援 Web Share API
- **THEN** 系統將分享連結寫入剪貼簿並顯示「已複製」

#### Scenario: 顯示 QR Code
- **WHEN** 使用者點擊「顯示 QR」
- **THEN** 系統以 QR Code 顯示完整的分享連結字串

#### Scenario: 帳號數過多不適合 QR
- **WHEN** 要分享的帳號超過 10 個
- **THEN** 系統在 QR 選項旁提示改用連結分享

#### Scenario: 未加密警語
- **WHEN** 分享面板開啟且分享密碼為空
- **THEN** 系統顯示警語，說明未加密的連結等同直接送出帳號密碼

### Requirement: 匯入頁面
系統 SHALL 提供 `/import` 頁面解析分享連結，並在使用者確認後才寫入帳號。

#### Scenario: 清除網址列中的 payload
- **WHEN** `/import` 頁面讀取到 fragment
- **THEN** 系統立即以 `history.replaceState` 將網址改為不含 fragment 的 `/import`，payload 只保留在記憶體中

#### Scenario: 顯示匯入預覽
- **WHEN** payload 解析成功
- **THEN** 系統列出每個帳號的別名與學號，標示「新增」或「更新」，預設全部勾選並允許取消勾選

#### Scenario: 確認匯入
- **WHEN** 使用者點擊「匯入」
- **THEN** 系統將勾選的帳號寫入 localStorage，顯示新增與更新數量，並導回首頁

#### Scenario: 同學號更新
- **WHEN** 匯入的帳號學號已存在於本機
- **THEN** 系統以匯入資料更新該帳號的密碼與別名，保留原有 id

#### Scenario: 加密連結需要密碼
- **WHEN** envelope 的 `enc` 為 true
- **THEN** 系統在顯示預覽前要求輸入分享密碼

#### Scenario: 解密失敗
- **WHEN** 使用者輸入的分享密碼無法解密 payload
- **THEN** 系統顯示密碼錯誤並允許重新輸入，不寫入任何帳號

#### Scenario: 無效的分享連結
- **WHEN** fragment 缺失、無法解碼或 `v` 為不支援的版本
- **THEN** 系統顯示連結無效的錯誤與回首頁的按鈕，不寫入任何帳號

### Requirement: QR 掃描器辨識分享連結
系統 SHALL 在內建 QR 掃描器掃到本站分享連結時導向匯入流程，並移除舊的 `nkust-import:` 字串格式。

#### Scenario: 掃到分享連結
- **WHEN** 掃描結果為本站 `/import#...` 連結
- **THEN** 系統關閉掃描器並導向該 `/import` 路徑，交由匯入頁處理

#### Scenario: 掃到舊格式
- **WHEN** 掃描結果以 `nkust-import:` 開頭
- **THEN** 系統不再解析該格式，視為非點名 QR Code 忽略
