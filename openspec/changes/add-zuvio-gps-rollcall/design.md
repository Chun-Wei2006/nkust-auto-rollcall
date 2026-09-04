## Context
Zuvio 學生端網頁（irs.zuvio.com.tw）除了 cookie 型的表單登入外，還有一套供 App 使用的 token API（`app_v2/*`）。多個開源實作（mlgzackfly/auto-zuvio、Tonylemty/SideProject、hpware/zuvio-rollback）都以 `user_id` + `accessToken` 直接呼叫，不需 cookie。這讓後端可以完全無狀態，符合本專案「帳號資料不上傳、不保存」的承諾。

參考來源 Demohu/zuvio-rollcall-bot 的核心流程是：登入 → 取得課程 → 輪詢每門課的點名頁 → 出現「簽到開放中」就按簽到，並以 CDP 覆寫瀏覽器定位。本次只保留這條核心，改成 API 呼叫。

## Goals / Non-Goals
- Goals:
  - 純 HTTP、無瀏覽器，可跑在現有 1 GB VM
  - 後端無狀態；token 只存在使用者瀏覽器的記憶體
  - 支援多個 Zuvio 帳號、每帳號可選要監控的課程
  - 頁面開著時自動輪詢並簽到
- Non-Goals:
  - 伺服器端排程或關掉頁面後仍持續監控
  - 任何推播通知
  - 與高科大帳號互通或共用分享連結

## Decisions
- **Zuvio 帳號與高科大帳號分開儲存**：欄位不同（Email vs 學號）、用途不同，硬塞進同一個 `Account` 型別會讓分享連結與匯入流程變複雜。分享連結暫不支援 Zuvio 帳號。
- **token 由前端持有**：`/zuvio/login/` 回傳 `user_id`、`access_token`，後續 `/zuvio/courses/`、`/zuvio/rollcall/` 帶 token 呼叫。避免每次輪詢都重新登入觸發 Zuvio 的異常登入偵測。token 只放在 React state，不寫入 localStorage；token 失效時前端自動重新登入一次。
- **GPS 座標為全域設定，不綁帳號**：教室位置是課程的屬性，不是帳號的屬性。先做單一座標（localStorage `zuvio_location`）。主要輸入方式是使用者在 Google 地圖上長按教室位置、複製出現的「22.725299, 120.316478」字串貼進來，前端解析成緯度與經度；另提供「使用目前位置」按鈕（`navigator.geolocation`）。每門課不同座標留作後續擴充。
- **輪詢在前端做**：`setInterval` 每 30 秒呼叫一次 `/zuvio/rollcall/`，後端一次處理該帳號所有勾選的課程。參考實作是 2 秒一門、10–20 秒一輪，我們一次請求就掃完所有課程，30 秒足以在點名開放期間內命中。
- **後端一次請求掃多門課**：`/zuvio/rollcall/` 接收 `course_ids[]`，對每門課呼叫 `getRollcall`，有開放的才 `makeRollcall`，回傳每門課的狀態（`success` / `not_open` / `failed`）。減少前端請求數，也讓「立即點名」與「自動監控」共用同一個端點。

## Risks / Trade-offs
- `app_v2/getRollcall` 的回應欄位未在公開實作中完整記錄 → 解析時同時接受 `rollcall_id` 出現在頂層或巢狀物件，找不到即視為未開放，並把原始回應記到 log 供調整
- Zuvio 可能對同一 token 的高頻請求限流 → 輪詢間隔 30 秒、失敗時不重試，交給下一輪
- GPS 座標與教室距離過遠會被 Zuvio 拒絕 → 顯示 Zuvio 回傳的 `msg` 原文，讓使用者自行調整座標
- 瀏覽器分頁進入背景後 `setInterval` 會被節流 → UI 上提示監控期間保持頁面在前景

## Migration Plan
純新增，無資料遷移。現有高科大帳號流程與 `/rollcall/` 端點不動。

## Open Questions
- Zuvio 點名是否對同一課程重複 `makeRollcall` 回錯誤，或直接回成功？影響輪詢時要不要記住已簽到的課程（先假設會回錯誤，前端以 `success` 狀態停止該課程的輪詢）
