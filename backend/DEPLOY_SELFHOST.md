# 自架部署指南（Proxmox VM / 樹莓派）

後端以 Docker 執行在自架主機上，透過 Cloudflare Tunnel 對外，主機不需要開任何 port forwarding，只要能連外即可。

## 部署流程總覽

```
push 到 develop ──▶ GitHub Actions build image ──▶ ghcr.io/…/nkust-auto-rollcall-api:dev  ──▶ Watchtower 更新 api-dev ──▶ api-dev.chunweidev.com
push 到 main    ──▶ GitHub Actions build image ──▶ ghcr.io/…/nkust-auto-rollcall-api:main ──▶ Watchtower 更新 api     ──▶ api.chunweidev.com
```

- `.github/workflows/deploy-backend.yml` 在 `backend/` 有變動時 build image 推到 GHCR
- VM 上的 Watchtower 每 60 秒檢查 GHCR，有新 image 就自動拉下來重啟對應容器
- VM 不需要 GitHub 憑證、不需要開入口；GHCR package 必須設為 **Public**

| 環境 | 分支 | 後端 | 前端 |
|------|------|------|------|
| Production | `main` | `api.chunweidev.com` | `autorollcall.chunweidev.com` |
| 測試 | `develop` | `api-dev.chunweidev.com` | `dev.autorollcall.chunweidev.com` 與各 feature 分支的 Vercel preview |

兩個環境的前端網域不同，瀏覽器 localStorage 也是分開的，測試不會動到使用者在正式站儲存的帳號。

## 前置需求

- 一台 x86 的 Linux 主機（Proxmox VM 建議 2 vCPU / 1GB RAM / 8GB 磁碟）
- Docker 已安裝
- 網域已託管在 Cloudflare

Proxmox 建議直接開 VM（Debian 12 / Ubuntu 24.04）。若要用 LXC，必須是 unprivileged container 並在 Options 開啟 `nesting=1` 與 `keyctl=1`，否則 Docker 無法啟動。

GHCR 上的 image 只有 `linux/amd64`。樹莓派等 ARM 主機請用 `docker-compose.build.yml` 從原始碼 build（見下方）。

## 步驟 1：安裝 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登入讓權限生效
```

## 步驟 2：取得 compose 設定

只需要 `backend/` 目錄裡的 compose 檔，clone 整個 repo 最省事：

```bash
git clone https://github.com/Chun-Wei2006/nkust-auto-rollcall.git
cd nkust-auto-rollcall/backend
```

之後不需要再 `git pull`，程式更新由 Watchtower 自動完成；只有 compose 檔本身改了才需要 pull 並 `docker compose up -d`。

## 步驟 3：建立 Cloudflare Tunnel

1. 前往 [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. 選擇 **Networks** → **Tunnels** → **Create a tunnel**
3. 選擇 **Cloudflared** → 輸入名稱（如 `nkust-rollcall`）
4. 複製 **Tunnel Token**（一長串 `eyJ...` 開頭的字串）
5. 設定兩筆 **Public Hostname**：

| Subdomain | Domain | Service |
|-----------|--------|---------|
| `api` | `chunweidev.com` | `http://api:8000` |
| `api-dev` | `chunweidev.com` | `http://api-dev:8000` |

Cloudflare 會自動建立對應的 DNS 記錄。

## 步驟 4：建立環境變數檔

```bash
cat > .env <<'ENV'
TUNNEL_TOKEN=你的Token
FRONTEND_URL=https://autorollcall.chunweidev.com
FRONTEND_URL_DEV=https://dev.autorollcall.chunweidev.com
FRONTEND_URL_REGEX_DEV=https://frontend-.*\.vercel\.app
ENV
```

- `FRONTEND_URL` 是 production 的 CORS 白名單，可用逗號分隔多個
- `FRONTEND_URL_REGEX_DEV` 讓所有 feature 分支的 Vercel preview 都能打測試後端；production 不要設 regex

## 步驟 5：啟動服務

```bash
docker compose up -d
```

會拉起 `api`、`api-dev`、`cloudflared`、`watchtower` 四個容器，`api` 與 `api-dev` 不對外開 port，流量只走 Tunnel。

第一次啟動前，確認 GHCR package 是 Public：GitHub → 個人頁 **Packages** → `nkust-auto-rollcall-api` → **Package settings** → **Change visibility** → Public。否則 VM 會拉不到 image。

### ARM 主機（樹莓派）

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

這樣 `api` 與 `api-dev` 會從本機原始碼 build，Watchtower 對本機 build 的 image 不會動作，更新要自己 `git pull` 再重跑上面的指令。

## 步驟 6：前端設定（Vercel）

| 項目 | 設定 |
|------|------|
| Domains | `autorollcall.chunweidev.com` → Production（`main`） |
| Domains | `dev.autorollcall.chunweidev.com` → 指定分支 `develop` |
| Environment Variables | `NEXT_PUBLIC_API_URL`：Production = `https://api.chunweidev.com`，Preview = `https://api-dev.chunweidev.com` |

Cloudflare DNS 的 `dev.autorollcall` CNAME 要設「僅 DNS」（灰雲）。二層子網域不在 Cloudflare 免費的 Universal SSL 範圍內，走灰雲讓 Vercel 自己簽憑證即可。

## 步驟 7：開機自動啟動

- Proxmox：VM → Options → **Start at boot** 設為 Yes
- 容器已設定 `restart: unless-stopped`，Docker 啟動後會自動帶起服務

---

## 常用指令

```bash
# 查看日誌
docker compose logs -f api
docker compose logs -f api-dev
docker compose logs -f watchtower   # 看有沒有抓到新 image

# 手動立刻更新（不想等 Watchtower 的 60 秒）
docker compose pull && docker compose up -d

# 重啟服務
docker compose restart

# 停止服務
docker compose down
```

## 故障排除

### 網址回 Cloudflare 530 / error 1033

代表 Tunnel 沒有連上，檢查 cloudflared 容器：

```bash
docker compose logs cloudflared
```

常見原因是 `TUNNEL_TOKEN` 貼錯或 Tunnel 在 Dashboard 被刪除。

### push 之後沒有更新

1. GitHub → Actions → **Deploy Backend** 是否成功
2. `docker compose logs watchtower` 是否有 `Found new image`
3. GHCR package 是否為 Public：`docker pull ghcr.io/chun-wei2006/nkust-auto-rollcall-api:dev` 在 VM 上手動試一次

### 前端呼叫 API 出現 CORS 錯誤

確認 `.env` 的 `FRONTEND_URL` / `FRONTEND_URL_DEV` 與前端網址完全一致（含 `https://`、無結尾斜線），修改後 `docker compose up -d` 重新套用。

### 樹莓派記憶體不足

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 查看容器狀態

```bash
docker compose ps
```
