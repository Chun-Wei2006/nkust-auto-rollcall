# NKUST 自動點名系統

![CI](https://github.com/Chun-Wei2006/nkust-auto-rollcall/actions/workflows/ci.yml/badge.svg)

國立高雄科技大學自動點名工具。

## 線上體驗

| 服務 | 網址 |
|------|------|
| **前端網站** | https://frontend-alpha-rosy-16.vercel.app/ |
| **後端 API** | https://api.rollcall0.dpdns.org |


## 功能特色

- **自動點名**：自動登入平台並完成課堂點名
- **QR Code 掃描**：支援掃描教室 QR Code 快速取得點名參數
- **多帳號管理**：可儲存多組帳號，支援別名設定方便辨識
- **本地儲存**：帳號資料僅存於瀏覽器 localStorage，不上傳伺服器
- **Web 介面**：友善的網頁操作介面，支援深色模式
- **REST API**：提供 API 端點供外部程式呼叫

## 自動登入原理

後端使用純 HTTP 請求模擬瀏覽器的登入流程，不需要啟動真實瀏覽器：

### 登入流程

```
1. GET  點名頁面 (start.php?goto=...)
   └─ 伺服器 redirect 到登入頁 (login.php?goto=...)
   └─ 取得 HTML 表單，解析 form action 和隱藏欄位 (login_key, rollcallGoto 等)

2. 密碼加密（複製前端 JS 的加密邏輯）
   └─ md5_hex  = MD5(password)
   └─ des_key  = md5_hex[:4] + login_key[:4]    # 8 bytes DES key
   └─ encrypt_pwd = Base64( DES_ECB(des_key, password) )

3. POST 登入表單到 /login.php
   └─ 帶上 username, password, encrypt_pwd, login_key, rollcallGoto 等欄位
   └─ 伺服器回應 Refresh header（非 302 redirect）指向結果頁

4. Follow Refresh header，GET 結果頁面
   └─ 解析回應內容判斷點名結果：完成報到 / 點名時間已結束 / 請重新掃描
```

### 技術細節

- **密碼加密**：NKUST 教學平台前端使用 JS 進行 DES 加密後才提交密碼，後端用 `pycryptodome` 實作相同邏輯
- **Refresh Header**：伺服器登入後用 `Refresh: 0; URL="..."` 跳轉（不是標準 302），`requests` 不會自動 follow，需手動處理
- **User-Agent**：伺服器會擋非瀏覽器的請求，需帶瀏覽器 User-Agent header

## 專案架構

本專案採用 **Monorepo** 架構，分為前端與後端兩個部分：

```
nkust-auto-rollcall/
├── frontend/                 # Next.js 前端應用程式
│   ├── src/
│   │   ├── app/             # 頁面與佈局
│   │   └── components/      # React 元件
│   └── package.json
│
├── backend/                  # FastAPI 後端服務
│   ├── src/
│   │   ├── api.py           # REST API 端點
│   │   └── auto_rollcall.py # 自動點名核心邏輯
│   └── requirements.txt
│
└── openspec/                 # 規格驅動開發文件
```

## 技術棧

### 前端
- **Next.js 16** - React 框架
- **React 19** - UI 函式庫
- **TypeScript 5** - 型別安全
- **Tailwind CSS 4** - 樣式框架
- **@yudiel/react-qr-scanner** - QR Code 掃描

### 後端
- **FastAPI** - Python Web 框架
- **requests** - HTTP 客戶端（純 HTTP 請求，無需瀏覽器）
- **pycryptodome** - DES 密碼加密
- **Mangum** - AWS Lambda ASGI 適配器
- **Uvicorn** - ASGI 伺服器

### 部署平台
- **Vercel** - 前端託管
- **AWS Lambda + API Gateway** - 後端託管（ap-northeast-1）

## 使用方式

### 線上使用

1. 開啟 [前端網站](https://frontend-alpha-rosy-16.vercel.app/)
2. 輸入學號與密碼
3. 掃描教室 QR Code 或手動輸入點名參數
4. 點擊「開始點名」按鈕

### 取得點名參數

點名參數（`rollcall_goto`）可透過以下方式取得：

- **掃描 QR Code**：使用內建 QR Code 掃描器掃描教室的點名 QR Code
- **手動輸入**：從點名網址中複製 `goto` 參數值

## 本地開發

### 環境需求

- Node.js 18+
- Python 3.12+
- npm 或 yarn

### 後端設定

```bash
# 進入後端目錄
cd backend

# 建立虛擬環境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安裝 Python 套件
pip install -r requirements.txt

# 啟動 API 伺服器
uvicorn src.api:app --reload --host 0.0.0.0 --port 8000
```

### 前端設定

```bash
# 進入前端目錄
cd frontend

# 安裝相依套件
npm install

# 啟動開發伺服器
npm run dev
```

前端預設運行於 `http://localhost:3000`

### 環境變數

#### 前端（`frontend/.env.local`）

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 後端（選用）

```env
FRONTEND_URL=https://your-frontend-url.com
```

## API 文件

### GET `/`

健康檢查端點。

**回應：**

```json
{
  "status": "ok",
  "message": "NKUST Auto Rollcall API is running"
}
```

### POST `/rollcall/`

執行自動點名。

**請求格式：**

```json
{
  "username": "學號",
  "password": "密碼",
  "rollcall_goto": "點名參數"
}
```

**成功回應：**

```json
{
  "success": true,
  "message": "完成報到",
  "elapsed_time": 0.79
}
```

**失敗回應：**

```json
{
  "success": false,
  "message": "點名時間已結束",
  "elapsed_time": 0.74
}
```

## 開發指令

### 前端

```bash
npm run dev      # 開發模式
npm run build    # 建置生產版本
npm run start    # 啟動生產伺服器
npm run lint     # 程式碼檢查
```

### 後端

```bash
uvicorn src.api:app --reload   # 開發模式（熱重載）
uvicorn src.api:app            # 生產模式
```

## 部署

### 前端（Vercel）

推送到 `main` 分支時自動部署。

### 後端（AWS Lambda）

推送到 `main` 分支時，GitHub Actions 自動執行 `sam build` + `sam deploy`。

需要設定 GitHub Secrets：
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## 注意事項

- 本工具僅供學習與研究用途
- 請確保在上課時間內使用，以符合學校點名規定
- 帳號密碼僅在本地處理，不會儲存或傳送至第三方

## 貢獻指南

歡迎貢獻！請參閱 [CONTRIBUTING.md](CONTRIBUTING.md) 了解：

- 分支命名規範（`feature/*`、`fix/*`、`hotfix/*`）
- Git Flow 開發流程
- Commit message 格式
- 版本號規範（Semantic Versioning）

## 授權條款

MIT License
