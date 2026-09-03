# 自架部署指南（Proxmox VM / 樹莓派）

後端以 Docker 執行，透過 Cloudflare Tunnel 對外提供 `https://api.chunweidev.com`，主機不需要開任何 port forwarding，只要能連外即可。

## 前置需求

- 一台 x86 或 ARM64 的 Linux 主機（Proxmox VM 建議 1 vCPU / 1GB RAM / 8GB 磁碟；樹莓派 4 亦可）
- Docker 已安裝
- 網域已託管在 Cloudflare

Proxmox 建議直接開 VM（Debian 12 / Ubuntu 24.04）。若要用 LXC，必須是 unprivileged container 並在 Options 開啟 `nesting=1` 與 `keyctl=1`，否則 Docker 無法啟動。

## 步驟 1：安裝 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登入讓權限生效
```

## 步驟 2：取得程式碼

```bash
git clone https://github.com/Chun-Wei2006/nkust-auto-rollcall.git
cd nkust-auto-rollcall/backend
```

## 步驟 3：建立 Cloudflare Tunnel

1. 前往 [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. 選擇 **Networks** → **Tunnels** → **Create a tunnel**
3. 選擇 **Cloudflared** → 輸入名稱（如 `nkust-rollcall`）
4. 複製 **Tunnel Token**（一長串 `eyJ...` 開頭的字串）
5. 設定 **Public Hostname**：
   - Subdomain: `api`
   - Domain: `chunweidev.com`
   - Service: `http://api:8000`

Cloudflare 會自動建立對應的 DNS 記錄。

## 步驟 4：建立環境變數檔

```bash
cat > .env <<'ENV'
TUNNEL_TOKEN=你的Token
FRONTEND_URL=https://autorollcall.chunweidev.com
ENV
```

`FRONTEND_URL` 用於 CORS 白名單，必須與前端實際網址一致。

## 步驟 5：啟動服務

```bash
docker compose up -d
```

`docker-compose.yml` 已包含 `api` 與 `cloudflared` 兩個 service，`api` 不對外開 port，流量只走 Tunnel。

## 步驟 6：確認前端環境變數

Vercel 專案設定中的 `NEXT_PUBLIC_API_URL` 應為：

```
NEXT_PUBLIC_API_URL=https://api.chunweidev.com
```

修改後重新部署前端。

## 步驟 7：開機自動啟動

- Proxmox：VM → Options → **Start at boot** 設為 Yes
- 容器已設定 `restart: unless-stopped`，Docker 啟動後會自動帶起服務

---

## 常用指令

```bash
# 查看日誌
docker compose logs -f

# 重啟服務
docker compose restart

# 更新程式碼並重建
git pull
docker compose up -d --build

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

### 前端呼叫 API 出現 CORS 錯誤

確認 `.env` 的 `FRONTEND_URL` 與前端網址完全一致（含 `https://`、無結尾斜線），修改後 `docker compose up -d` 重新套用。

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
docker compose logs api
```
