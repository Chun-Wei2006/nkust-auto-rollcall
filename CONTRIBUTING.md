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
