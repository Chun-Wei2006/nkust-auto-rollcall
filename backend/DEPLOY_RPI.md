# 樹莓派 Docker 部署指南

## 前置需求

- Raspberry Pi 4（建議 4GB RAM）
- Raspberry Pi OS 64-bit
- Docker 已安裝

## 步驟 1：安裝 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登入讓權限生效
```

## 步驟 2：取得程式碼

```bash
git clone https://github.com/你的帳號/nkust-auto-rollcall.git
cd nkust-auto-rollcall/backend
```

## 步驟 3：建立 Cloudflare Tunnel

1. 前往 [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. 選擇 **Networks** → **Tunnels** → **Create a tunnel**
3. 選擇 **Cloudflared** → 輸入名稱（如 `nkust-rollcall`）
4. 複製 **Tunnel Token**（一長串 `eyJ...` 開頭的字串）
5. 設定 **Public Hostname**：
   - Subdomain: `rollcall`（或你想要的子網域）
   - Domain: 選擇你的網域
   - Service: `http://api:8000`

## 步驟 4：建立環境變數檔

```bash
echo "TUNNEL_TOKEN=你的Token" > .env
```

## 步驟 5：啟動服務

```bash
docker compose up -d
```

## 步驟 6：更新前端環境變數

在 Vercel 專案設定中新增：
```
NEXT_PUBLIC_API_URL=https://rollcall.你的網域.com
```

重新部署前端即可。

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

### 記憶體不足
增加 swap：
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
docker compose logs cloudflared
```
