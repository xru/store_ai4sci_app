# CF_NeedInfo_v1.md — DeployKit 所需 Cloudflare 信息清单

> 版本：v1 | 日期：2026-08-29
> 用途：列出 DeployKit 自动部署所需的所有 Cloudflare 信息，一次性配齐

---

## 1. 账号信息（必需）

| 项 | 说明 | 如何获取 | 示例 |
|---|---|---|---|
| **Account ID** | Cloudflare 账户唯一标识 | Dashboard 右下角 / 或 `npx wrangler whoami` | `a1b2c3d4e5f6...` |
| **API Token** | 有权限的 API 令牌（非 Global API Key） | Dashboard → My Profile → API Tokens → Create Token | `v1.0-xxxxx...` |

### API Token 需要的权限

创建 Token 时选择 **Custom Token**，勾选以下权限：

| 权限分类 | 权限项 | 级别 |
|---|---|---|
| Account | Workers Scripts | Edit |
| Account | Workers KV Storage | Edit |
| Account | D1 | Edit |
| Account | Workers R2 Storage | Edit |
| Account | Cloudflare Pages | Edit |
| Zone | DNS | Edit |
| Zone | Workers Routes | Edit |

> ⚠️ **不要用 Global API Key**，安全风险高。用限定权限的 API Token。
> Token 本身不需要发给我，写入 `.env` 或 wrangler 环境变量即可（见第 6 节）。

---

## 2. 域名信息（自定义域名绑定时必需）

| 项 | 说明 | 当前状态 | 示例 |
|---|---|---|---|
| **域名** | 要绑定的自定义域名 | `ai4sci.app`（已注册） | `yourdomain.com` |
| **是否已托管在 CF** | 域名 DNS 是否已指向 Cloudflare | ✅ 已确认 | Dashboard 能看到 zone |
| **Zone ID** | 域名在 Cloudflare 的 zone 标识 | 可选提供 | `f1e2d3c4...` |
| **子域名** | 如需绑定子域名写明 | 无则留空 | `app.yourdomain.com` |

### Zone ID 获取方式
```sh
npx wrangler whoami          # 显示 Account ID
# 或 Dashboard → 选择域名 → 右侧 Overview 页面右下角
```

---

## 3. Workers 配置（部署目标）

| 项 | 说明 | 默认值 | 备注 |
|---|---|---|---|
| **Worker 名称** | 部署的 Worker 名称 | `ai4sci-app-store` | wrangler.jsonc 中的 `name` |
| **部署区域** | Worker 部署的地理位置 | `auto`（全球边缘） | 一般不需要改 |
| **兼容日期** | Workers 运行时版本 | `2024-09-23` | wrangler.jsonc 中的 `compatibility_date` |

---

## 4. 数据存储绑定（按需）

### D1 数据库

| 项 | 说明 | 当前值 |
|---|---|---|
| **Database 名称** | D1 实例名 | `ai4sci-db` |
| **Database ID** | D1 唯一标识 | `1807decc-b242-4a02-95ce-70fd2eac8ac3` |

> 如果还没有 D1，DeployKit 会自动创建并返回 ID。

### R2 存储桶

| 项 | 说明 | 当前值 |
|---|---|---|
| **Bucket 名称** | R2 存储桶名 | `ai4sci-assets` |
| **用途** | 存储 App 截图/封面等静态资源 | — |

### KV 命名空间（如有缓存需求）

| 项 | 说明 | 当前状态 |
|---|---|---|
| **Namespace 名称** | KV 缓存命名空间 | 暂未使用，如需可创建 |

---

## 5. 第三方服务密钥（Secrets）

> ⚠️ **安全原则**：以下密钥不要直接发到聊天里。
> 通过 `npx wrangler secret put XXX` 写入 Cloudflare 加密存储，只回复"已配置"。

| Secret 名称 | 用途 | 配置方式 | 状态 |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth 登录 | `wrangler secret put` | ✅ 已配置 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 登录 | `wrangler secret put` | ✅ 已配置 |
| `SESSION_SECRET` | Session 加密 | `wrangler secret put` | ✅ 已配置 |

> 如未来需要 Stripe 支付、邮件服务、其他 API，通过同样方式添加。

---

## 6. 环境变量配置方式

DeployKit 需要知道你的 secrets 配置方式，二选一：

**方式 A — wrangler secret（推荐，生产环境）**
```sh
npx wrangler secret put GOOGLE_CLIENT_ID
# 每条会提示输入值，加密存储在 Cloudflare
```

**方式 B — .env 文件（本地开发）**
```sh
# .dev.vars 文件（已 gitignore，不会被推送）
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
SESSION_SECRET=xxx
```

---

## 7. DeployKit 需要的最小信息（一次性回复模板）

把以下信息填好后发给 DeployKit（**标注 ⚠️ 的不要发值，写入 .env 后回复"已配置"**）：

```markdown
## Cloudflare 部署信息

### 账号
- Account ID: _______________________
- API Token: ⚠️ 已写入 .env（CLOUDFLARE_API_TOKEN）

### 域名
- 域名: ai4sci.app
- 已托管 Cloudflare: 是 / 否
- Zone ID: _______________________（可选，Dashboard 右下角）

### Workers
- Worker 名称: ai4sci-app-store
- 部署区域: auto（默认全球边缘）

### D1
- Database 名称: ai4sci-db
- Database ID: 1807decc-b242-4a02-95ce-70fd2eac8ac3

### R2
- Bucket 名称: ai4sci-assets

### Secrets
- GOOGLE_CLIENT_ID: ⚠️ 已配置
- GOOGLE_CLIENT_SECRET: ⚠️ 已配置
- SESSION_SECRET: ⚠️ 已配置

### HTTPS
- 自动配置: 是（Cloudflare 自动签发证书）

### 监控
- 部署状态通知方式: 终端输出 / Slack webhook / Email
```

---

## 8. 安全注意事项

| 规则 | 说明 |
|---|---|
| ❌ 不要发 API Token 到聊天 | 写入 `.env` 文件，回复"已配置" |
| ❌ 不要发 OAuth Secret 到聊天 | 用 `wrangler secret put` 写入 Cloudflare |
| ❌ 不要用 Global API Key | 用限定权限的 API Token |
| ✅ `.dev.vars` 已被 `.gitignore` 忽略 | 安全，不会推送 |
| ✅ API Token 可随时撤销 | Dashboard → API Tokens → Roll/Delete |
| ✅ Secrets 加密存储在 Cloudflare | 无法被读取明文 |

---

## 9. 自动部署能力矩阵

收到以上信息后，DeployKit 可以自动完成：

| 能力 | 自动化程度 | 说明 |
|---|---|---|
| 项目类型检测 | ✅ 全自动 | 扫描 package.json / 依赖判断 React/Vue/静态 |
| 部署配置生成 | ✅ 全自动 | 自动生成 wrangler.jsonc / pages 配置 |
| 推送到 Workers | ✅ 全自动 | `wrangler deploy` |
| 推送到 Pages | ✅ 全自动 | `wrangler pages deploy` |
| D1 建表 | ✅ 全自动 | 自动运行 migrations |
| 种子数据 | ✅ 半自动 | 需确认是否灌入示例数据 |
| 自定义域名绑定 | ✅ 全自动 | 通过 routes 配置 |
| HTTPS 证书 | ✅ 全自动 | Cloudflare 自动签发 |
| 部署状态监控 | ✅ 全自动 | 实时输出 + 可选 webhook 通知 |
| Secrets 设置 | ⚠️ 半自动 | 首次需要手动 `wrangler secret put` |

---

## 附录：快速检查当前状态

```sh
cd /Users/dev/Documents/Catai_Dev_M4/Catai_Products/App_Stores/store_ai4sci_app

# 检查 wrangler 登录状态
npx wrangler whoami

# 检查 D1 数据库
npx wrangler d1 list

# 检查 R2 存储桶
npx wrangler r2 bucket list

# 检查已部署的 Workers
npx wrangler deployments list
```
