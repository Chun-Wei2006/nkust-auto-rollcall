## 1. 後端
- [x] 1.1 新增 `backend/src/zuvio.py`：`ZuvioClient` 封裝 `login` / `list_courses` / `get_rollcall` / `make_rollcall`，純 requests，回傳統一的 dict
- [x] 1.2 `api.py` 新增 `POST /zuvio/login/`、`POST /zuvio/courses/`、`POST /zuvio/rollcall/` 與對應 pydantic model，座標範圍驗證
- [x] 1.3 `getRollcall` 回應解析容錯：找不到 `rollcall_id` 視為未開放，並記錄原始回應
- [x] 1.4 token 失效偵測：Zuvio 回 `status: false` 且訊息含 token / 登入相關字樣時回 `token_expired: true`

## 2. 前端
- [x] 2.1 新增 `frontend/src/hooks/useZuvioAccounts.ts`（localStorage `zuvio_accounts`，含 `courseIds`）與 `zuvio_location` 存取
- [x] 2.2 新增 `frontend/src/components/ZuvioPanel.tsx`：帳號 CRUD、GPS 座標欄（可貼 Google 地圖「緯度, 經度」字串）與「使用目前位置」、載入課程與勾選
- [x] 2.3 `ZuvioPanel` 立即點名：對勾選帳號並行呼叫 `/zuvio/rollcall/`，顯示每帳號每課程結果
- [x] 2.4 `ZuvioPanel` 自動監控：30 秒輪詢、token 記憶體快取與失效重登、成功課程不重複簽到、停止與 unmount 清理
- [x] 2.5 `page.tsx` 新增「高科大 QR 點名 / Zuvio GPS 點名」模式切換，記住上次選擇

## 3. 驗證與文件
- [ ] 3.1 以真實 Zuvio 帳號驗證登入、課程列表，記錄 `getRollcall` 實際回應欄位並修正解析
- [ ] 3.2 在點名開放時段驗證 `makeRollcall` 成功與座標過遠被拒的訊息
- [x] 3.3 README 新增 Zuvio GPS 點名說明與三個端點的 API 文件
