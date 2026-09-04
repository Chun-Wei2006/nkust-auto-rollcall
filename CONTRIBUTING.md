# Contributing Guide

## Branch Naming Convention

| 類型 | 格式 | 範例 |
|------|------|------|
| 新功能 | `feature/<描述>` | `feature/add-login-page` |
| 修復 Bug | `fix/<描述>` | `fix/qrcode-expired-check` |
| 緊急修復 | `hotfix/<描述>` | `hotfix/login-crash` |
| 重構 | `refactor/<描述>` | `refactor/simplify-auth` |
| 文件 | `docs/<描述>` | `docs/update-readme` |

## Git Flow

```
main (穩定版本，禁止直接 push)
  └── develop (開發分支)
        ├── feature/xxx
        ├── fix/xxx
        └── ...
```

### 開發流程

1. 從 `develop` 建立功能分支
2. 完成後發 PR 到 `develop`
3. Code review 通過後合併
4. 累積足夠功能後，從 `develop` 發 PR 到 `main`
5. 合併到 `main` 後打 tag

### 部署環境

| 分支 | 用途 | 前端 | 後端 |
|------|------|------|------|
| feature / fix 分支 | 開發中 | Vercel preview 網址 | `api-dev.chunweidev.com`（測試後端放行所有 preview） |
| `develop` | 測試環境 | `dev.autorollcall.chunweidev.com` | `api-dev.chunweidev.com` |
| `main` | 正式環境 | `autorollcall.chunweidev.com` | `api.chunweidev.com` |

推送到 `develop` / `main` 後，前端由 Vercel、後端由 GitHub Actions + Watchtower 自動部署，不需要手動操作。測試環境與正式環境的網域不同，瀏覽器儲存的帳號資料互不影響。

## Tag Convention (Semantic Versioning)

格式：`vMAJOR.MINOR.PATCH`

| 版本 | 說明 | 範例 |
|------|------|------|
| MAJOR | 不相容的 API 變更 | v2.0.0 |
| MINOR | 新增功能（向下相容） | v1.1.0 |
| PATCH | Bug 修復 | v1.0.1 |

## Commit Message Convention

格式：`<type>: <description>`

| Type | 說明 |
|------|------|
| feat | 新功能 |
| fix | 修復 bug |
| docs | 文件變更 |
| refactor | 重構 |
| ci | CI 相關變更 |
| chore | 其他維護性工作 |
