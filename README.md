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
- **Playwright** - 瀏覽器自動化
- **Uvicorn** - ASGI 伺服器

### 部署平台
- **Vercel** - 前端託管
- **Render** - 後端託管

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
- Python 3.8+
- npm 或 yarn

### 後端設定

```bash
# 進入後端目錄
cd backend

# 安裝 Python 套件
pip install -r requirements.txt

# 安裝 Playwright 瀏覽器
playwright install chromium

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
  "message": "點名成功",
  "elapsed_time": 12.34
}
```

**失敗回應：**

```json
{
  "detail": "登入失敗"
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

```bash
cd frontend
vercel --prod
```

### 後端（Render）

1. 連接 GitHub 專案到 Render
2. 設定 Root Directory 為 `backend`
3. Build Command: `pip install -r requirements.txt && playwright install chromium && playwright install-deps`
4. Start Command: `uvicorn src.api:app --host 0.0.0.0 --port $PORT`

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
