# Run_Dev_v2.md — 本地开发启动指南（ai4sci-app-store v2）

> 版本:v2 = 多分类系统(app_categories 关联表)+ 分类管理 CRUD 已落地。
> 平台:macOS / Linux(zsh)。Windows 请用等效命令。

## 0. 前置

- Node.js ≥ 18(推荐 20+)
- 已安装依赖:`npm install`(仓库根目录)
- Cloudflare 账号 + `wrangler` 已登录:`npx wrangler login`(首次需要)
- D1 数据库 `ai4sci-db` 已创建(database_id 已写入 `wrangler.jsonc`)

## 1. 配置本地密钥

复制模板并填入真实的 Google OAuth 凭据(本地 dev 用,不会被提交):

```sh
cp .dev.vars.example .dev.vars
# 然后编辑 .dev.vars 填入:
#   GOOGLE_CLIENT_ID=...
#   GOOGLE_CLIENT_SECRET=...
#   SESSION_SECRET=随便一段随机字符串
```

> 仅浏览/分类功能不登录也能跑;只有 `/api/auth/*` 需要 OAuth 凭据。
> 不填的话启动不会报错,但登录会失败。

## 2. 初始化本地数据库(首次 / schema 变更后)

```sh
# 应用全部迁移到本地 D1(.wrangler/ 下的本地 sqlite)
npm run db:migrate:local

# 灌入种子数据(分类 + 示例 app + app_categories 关联)
npx wrangler d1 execute ai4sci-db --local --file=seed.sql
```

## 3. 启动开发服务器

```sh
npm run dev
# 等同于: wrangler dev
```

启动后访问:

- 首页 / 浏览: http://localhost:8787/
- 分类管理(需 admin): http://localhost:8787/admin
- 提交 app: http://localhost:8787/submit

## 4. 给自己管理员权限(进入 /admin 前必须做一次)

本地库执行:

```sh
# 先用 Google 登录一次(产生 users 记录),再把你的邮箱设为 admin
npx wrangler d1 execute ai4sci-db --local \
  --command="UPDATE users SET role='admin' WHERE email='你的邮箱@gmail.com'"
```

## 5. 常用命令速查

| 用途 | 命令 |
|---|---|
| 启动 dev | `npm run dev` |
| 本地迁移 | `npm run db:migrate:local` |
| 本地灌种子 | `npx wrangler d1 execute ai4sci-db --local --file=seed.sql` |
| 远端迁移 | `npm run db:migrate` |
| 远端灌种子 | `npm run db:seed` |
| 部署 | `npm run deploy` |

## 6. 验证清单(启动后)

- `GET /api/categories` → 返回 7 个分类,带 `app_count`
- `GET /api/apps?category=bioinformatics,climate` → 返回并集结果(多分类筛选)
- `GET /api/apps/protein-fold-ai` → `app.categories` 是数组
- `/admin` 非 admin 看到禁止提示;设为 admin 后可增删改分类,删被引用分类会被拦截

## 7. 排错

- **端口被占 / EPERM listen 127.0.0.1**:换个端口 `npx wrangler dev --port 8788`,或确认没有别的进程占用 8787。
- **`no such table`**:没跑 `db:migrate:local`,先跑第 2 步。
- **登录回调报 `token_exchange_failed`**:`.dev.vars` 的 OAuth 凭据没填或 redirect_uri 不匹配(本地用 `http://localhost:8787/api/auth/callback`)。
- **`/admin` 显示 Forbidden**:没执行第 4 步设 role='admin'。
