# Deploy_CF_v1.md — Cloudflare 生产部署指南（ai4sci.app v1）

> 版本：v1 | 日期：2026-08-29 | 目标：把 ai4sci.app 部署到 Cloudflare Workers 生产环境
> 适用：macOS / Linux (zsh)。Windows 用等效命令。

---

## 0. 前置条件

在开始部署前，确认以下都已准备好：

| 项 | 要求 | 检查方法 |
|---|---|---|
| Node.js | ≥ 18（推荐 20+） | `node -v` |
| wrangler | 已登录 Cloudflare | `npx wrangler whoami` |
| GitHub 仓库 | `github.com/xru/store_ai4sci_app` 已推送最新代码 | `git log --oneline -1` |
| 域名 | `ai4sci.app` 已注册 | DNS 已托管或可转移 |
| Google OAuth | 已创建 OAuth 2.0 Client ID | Google Cloud Console → Credentials |
| Cloudflare 账号 | 已注册且 wrangler 已绑定 | `npx wrangler whoami` |

---

## 1. 添加域名到 Cloudflare（首次）

`ai4sci.app` 必须先托管在 Cloudflare 才能绑定自定义域名。

```sh
# 方式一：通过 wrangler 确认当前账号
npx wrangler whoami
```

如果域名还没加到 Cloudflare：

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击 **Add a Site** → 输入 `ai4sci.app`
3. 选择 **Free** 计划
4. Cloudflare 会给出两个 nameserver 地址（如 `xxx.ns.cloudflare.com`）
5. 去域名注册商（注册 ai4sci.app 的地方）把 nameserver 改成 Cloudflare 给的这两个
6. 等待 DNS 生效（通常几分钟到数小时，Cloudflare 会发邮件通知）

> ⚠️ DNS 未生效前，自定义域名绑定会报错：
> `Could not find zone for ai4sci.app`

---

## 2. 创建 D1 数据库（首次）

如果还没有远程 D1 数据库：

```sh
cd /Users/dev/Documents/Catai_Dev_M4/Catai_Products/App_Stores/store_ai4sci_app

# 创建数据库
npx wrangler d1 create ai4sci-db
```

输出会显示 `database_id`，把它填入 `wrangler.jsonc`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "ai4sci-db",
    "database_id": "你的-database-id-填这里"
  }
]
```

> 当前已配置的 database_id：`1807decc-b242-4a02-95ce-70fd2eac8ac3`

---

## 3. 设置生产环境 Secrets

Wrangler 4.x 不再支持在 `wrangler.jsonc` 里写 `secrets` 数组。
secrets 只能通过命令行设置（加密存储在 Cloudflare，不进代码仓库）。

```sh
cd /Users/dev/Documents/Catai_Dev_M4/Catai_Products/App_Stores/store_ai4sci_app

# 逐条设置（每条会提示你输入值，粘贴进去后回车）
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
```

值的来源：

| Secret | 从哪里获取 |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials → OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | 同上，创建 Client 时显示的 secret |
| `SESSION_SECRET` | 随机字符串，用 `openssl rand -hex 32` 生成 |

> 💡 生产环境的值应该和本地 `.dev.vars` 里的值一致（OAuth 同一个 Client）。
> 如果用了不同的 Client，需要在 Google Console 注册对应的生产 redirect URI。

---

## 4. 远程 D1 建表 + 种子数据

```sh
# 应用所有 migration 到远程数据库
npm run db:migrate

# 灌入种子数据（分类 + 示例 App + 关联表）
npm run db:seed
```

> 这两条等同于：
> `npx wrangler d1 migrations apply ai4sci-db --remote`
> `npx wrangler d1 execute ai4sci-db --remote --file=seed.sql`

验证建表成功：

```sh
npx wrangler d1 execute ai4sci-db --remote --command="SELECT COUNT(*) FROM apps"
```

应返回 `3`（3 个种子 App）。

---

## 5. 确认 wrangler.jsonc 配置

部署前确认 `wrangler.jsonc` 关键字段：

```jsonc
{
  "name": "ai4sci-app-store",
  "main": "src/index.ts",
  "compatibility_date": "2024-09-23",
  "assets": {
    "directory": "./public",
    "binding": "STATIC"
  },
  "vars": {
    "SITE_NAME": "ai4sci.app — AI for Science App Store",
    "ENVIRONMENT": "production"        // ← 生产必须为 production
  },
  "d1_databases": [{ "binding": "DB", ... }],
  "r2_buckets": [{ "binding": "BUCKET", ... }],
  "routes": [
    { "pattern": "ai4sci.app", "custom_domain": true }
  ]
}
```

**注意事项：**
- `ENVIRONMENT` 必须为 `"production"`（决定 OAuth redirect_uri 用 https://ai4sci.app）
- 不能有 `secrets` 数组字段（Wrangler 4.x 不支持）
- `routes` 里的域名必须已在 Cloudflare 托管

---

## 6. 部署到 Cloudflare Workers

```sh
npm run deploy
```

> 等同于 `npx wrangler deploy`

成功输出示例：

```
Your Worker has access to the following bindings:
Binding                  Resource
env.DB (ai4sci-db)       D1 Database
env.BUCKET (ai4sci-assets) R2 Bucket
env.STATIC               Assets
env.SITE_NAME (...)       Environment Variable
env.ENVIRONMENT (...)     Environment Variable

Uploaded ai4sci-app-store (8.66 sec)
Deployed ai4sci-app-store triggers
https://ai4sci-app-store.<your-subdomain>.workers.dev
https://ai4sci.app
```

---

## 7. Google Console 添加生产回调地址

部署成功后，必须在 Google Console 添加生产环境的 redirect URI，否则线上登录会失败。

1. 打开 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 点击你的 **OAuth 2.0 Client ID**
3. 在 **Authorized redirect URIs** 添加：
   ```
   https://ai4sci.app/api/auth/callback
   ```
4. （保留本地开发的）`http://localhost:8787/api/auth/callback` 不要删
5. 点击 **Save**

> ⚠️ Google OAuth 不允许非 localhost 域名用 `http://`，生产必须 `https://`。

---

## 8. 上线后验证（Smoke Test）

在浏览器中逐一确认：

| # | 测试 | URL | 预期 |
|---|---|---|---|
| 1 | 首页加载 | `https://ai4sci.app/` | 显示 App 卡片列表 |
| 2 | 分类 API | `https://ai4sci.app/api/categories` | JSON 返回 7 个分类 |
| 3 | App API | `https://ai4sci.app/api/apps` | JSON 返回 3 个 App |
| 4 | robots.txt | `https://ai4sci.app/robots.txt` | 显示爬虫规则 |
| 5 | sitemap.xml | `https://ai4sci.app/sitemap.xml` | 显示站点地图 |
| 6 | 登录 | `https://ai4sci.app/` → Sign in | Google OAuth 成功跳转 |
| 7 | 详情页 | `https://ai4sci.app/apps/protein-fold-ai` | 显示分级内容 |
| 8 | 定价+等待名单 | `https://ai4sci.app/pricing` | 填邮箱 → "You're on the list!" |
| 9 | 提交 | `https://ai4sci.app/submit` | 登录后可填表提交 |
| 10 | HTTPS | `https://ai4sci.app/` | 浏览器显示锁图标（证书有效） |

命令行快速验证：

```sh
curl -sI https://ai4sci.app/ | head -5
curl -s https://ai4sci.app/api/categories | head -3
curl -s https://ai4sci.app/robots.txt
```

---

## 9. 管理员设置（登录后做一次）

给自己管理员权限才能访问 `/admin`：

```sh
# 1. 先在浏览器用 Google 登录一次（产生 users 记录）
# 2. 把你的邮箱设为 admin
npx wrangler d1 execute ai4sci-db --remote \
  --command="UPDATE users SET role='admin' WHERE email='你的邮箱@gmail.com'"
```

验证：

```sh
npx wrangler d1 execute ai4sci-db --remote \
  --command="SELECT email, role FROM users WHERE role='admin'"
```

---

## 10. 后续更新部署

代码有改动后，重新部署只需：

```sh
cd /Users/dev/Documents/Catai_Dev_M4/Catai_Products/App_Stores/store_ai4sci_app

# 如果有新的 migration
npm run db:migrate

# 部署
npm run deploy
```

Secrets 只需设置一次，后续部署不需要重复。

---

## 11. 排错

| 问题 | 原因 | 解决 |
|---|---|---|
| `Could not find zone for ai4sci.app` | 域名未托管在 Cloudflare | 完成 Step 1 添加域名 |
| `The field "secrets" should be an object` | wrangler.jsonc 有 secrets 数组 | 删除 secrets 字段，用 `wrangler secret put` |
| 登录报 `redirect_uri_mismatch` | Google Console 缺回调地址 | Step 7 添加 https://ai4sci.app/api/auth/callback |
| 登录报 `token_exchange_failed` | Client Secret 不对或环境变量缺失 | 重新 `wrangler secret put GOOGLE_CLIENT_SECRET` |
| 页面显示 "See public/ for Pages deployment" | Workers Assets 未配置 | 确认 wrangler.jsonc 有 `assets.directory` |
| API 返回空/no such table | 远程 D1 未建表 | 运行 Step 4 `npm run db:migrate` |
| `/admin` 显示 Forbidden | 未设管理员权限 | Step 9 设置 role='admin' |

---

## 附录：完整一键部署（首次）

```sh
# 确认前提
npx wrangler whoami                          # 已登录
cd /Users/dev/Documents/Catai_Dev_M4/Catai_Products/App_Stores/store_ai4sci_app

# Secrets（一次性）
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET

# 数据库
npm run db:migrate
npm run db:seed

# 部署
npm run deploy

# 管理员（登录后）
npx wrangler d1 execute ai4sci-db --remote \
  --command="UPDATE users SET role='admin' WHERE email='你的邮箱@gmail.com'"
```

> 然后去 Google Console 添加生产 redirect URI（Step 7）。
