# 老黄的后花园

一方自己的小院：想说什么，就种下一句。

一个 **Vue 3 + Pinia + Hono** 的轻量发布小站。数据放在服务端的**进程内内存**里，通过 **RESTful API** 读写；界面为 iOS **Liquid Glass** 风格的浅色磨砂玻璃。

## 功能

- **发布**：填写署名（留空记为「花园访客」）+ 正文（1–500 字），点「种下这条」或按 `Ctrl / ⌘ + Enter` 提交；实时字数计数，超过 500 字自动禁用提交。
- **查看**：按发布时间倒序展示，包含头像首字、署名、相对时间（刚刚 / N 分钟前 / 今日时分 / 月日时分）与正文，正文保留换行。
- **点赞**：每条可点赞 / 取消点赞，按钮旁显示点赞总数；状态与计数都写到服务端，刷新、换设备后都还在（全局共享）。
- **收藏**：每条可收藏 / 取消收藏，筛选区可在「全部 / 收藏」之间切换，只看收藏时统计文案变为「收藏 N 条」。
- **删除**：二次确认后删除，列表与服务端同步移除。
- **筛选**：顶部搜索框对正文与署名做大小写不敏感匹配，实时过滤并显示「共 N 条 · 命中 M 条」，命中文字高亮，可一键清除（或按 `Esc`）。
- **容错**：接口不可用、数据损坏、返回非约定结构都有明确提示；「一条都没有」与「没搜到」是两种不同空态。
- **同步**：窗口重新获得焦点或页面重新可见时自动拉取一次，替代原来的多标签 `storage` 事件。

## 技术栈

| 关注点 | 选型 |
| --- | --- |
| 运行时 | Node.js ≥ 20（开发与构建） |
| 前端 | Vue 3.5（Composition API + `<script setup lang="ts">`）+ Pinia 3 + Vite 6 |
| 后端 | Hono 4 + `@hono/node-server`，`tsx` 直接跑 TypeScript |
| 存储 | 进程内 `Map`（内存存储，重启即清空） |
| 测试 | Vitest 3 + @vue/test-utils 2 + jsdom（后端用例走 node 环境） |
| 语言 | TypeScript（`tsc --noEmit` 严格模式） |

## 快速开始

```bash
npm install

# 终端 1：后端（http://127.0.0.1:8787）
npm run server

# 终端 2：前端（http://localhost:5173，/api 由 Vite 代理到 8787）
npm run dev
```

其他命令：

```bash
npm run build      # 生产构建到 dist/
npm start          # 由 Hono 同源托管 dist/ 与 /api（默认 8787，可用 PORT 覆盖）
npm test           # 跑一次全部测试（前端 + 后端）
npm run test:watch # 监听模式（TDD 时使用）
npm run typecheck  # TypeScript 严格类型检查
npm run accept     # 构建后起真实浏览器做端到端验收
```

> 浏览器直接双击 `index.html` 已经不可用（需要 Vite 编译 + 后端接口），请使用上面的命令。

## RESTful API

统一前缀 `/api`，错误体统一为 `{ error: { code, message } }`：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/posts` | 列表，按 `createdAt` 倒序 |
| `POST` | `/api/posts` | 新建，`{ author?, content }` → `201 { post }` |
| `PATCH` | `/api/posts/:id` | 点赞 / 收藏，`{ liked?, favorited? }`（至少给一个）→ `200 { post }` |
| `DELETE` | `/api/posts/:id` | 删除 → `204`；不存在 → `404` |
| `DELETE` | `/api/posts` | 清空集合（验收/演示用） |
| `GET` | `/api/health` | `{ status: 'ok', posts: number }` |

错误码：`content_required`、`content_too_long`、`invalid_json`、`invalid_body`、`not_found`、`route_not_found`。

## TDD 工作流

项目按「先测试、后实现」推进，每一轮都跑过一次红灯再转绿：

```bash
npm run test:watch   # 1. 写一个失败的测试（红）
                     # 2. 写最小实现让它通过（绿）
                     # 3. 重构，测试保持全绿
```

当前 **12 个测试文件 / 204 个用例全部通过**：

| 测试文件 | 覆盖内容 |
| --- | --- |
| `tests/unit/time.spec.ts` | 相对时间分档、跨天、跨年、未来时间 |
| `tests/unit/highlight.spec.ts` | 关键词切片、大小写、多次命中、不丢字 |
| `tests/unit/api.spec.ts` | 请求方法的 URL/method/body、错误文案透出、网络异常兜底、结构校验、`likes`/`favorited` 脏数据拒收、204 空体 |
| `tests/unit/preferences.spec.ts` | 署名记忆、存储被禁用 / 抛错时的静默降级 |
| `tests/stores/posts.spec.ts` | 初始化 / 拉取失败 / 发布 / 本地校验不发请求 / 回滚 / 点赞 / 收藏 / 视图切换 / 删除 / 排序 / 筛选 / 三种空态 |
| `tests/server/store.spec.ts` | 内存 store 的创建、裁剪、校验、倒序、点赞计数（幂等、不为负）、收藏、删除、清空、实例隔离 |
| `tests/server/posts.api.spec.ts` | 六个接口的状态码、响应体、错误码、PATCH 双字段、非法 JSON / 空补丁、未知路由 |
| `tests/components/PostComposer.spec.ts` | 计数、超限禁用、空内容校验、提交载荷、快捷键、`reset()` |
| `tests/components/PostCard.spec.ts` | 署名 / 正文 / `<time>`、高亮、点赞态与计数、收藏态、二次确认删除、头像变体 |
| `tests/components/SearchBar.spec.ts` | 全部 / 收藏页签、两种统计文案、清除按钮显隐、`v-model` 同步、`Esc` |
| `tests/components/PostFeed.spec.ts` | 列表渲染、三种空态（无内容 / 没搜到 / 没收藏）、事件上抛 |
| `tests/components/App.spec.ts` | 端到端集成：渲染、发布、筛选、点赞计数、收藏与只看收藏、删除、聚焦刷新 |

> Node 26 自带需要 `--localstorage-file` 才可用的全局 `localStorage`，会遮蔽 jsdom 的实现；`tests/setup.ts` 检测到没有可用 Storage 时补一个内存实现，保证各 Node 版本下用例一致。

## 目录结构

```text
laohuang-backyard/
├── index.html                  # Vite 入口（挂载 #app）
├── package.json
├── vite.config.ts              # Vite + Vitest 配置（/api 代理、@ 别名、jsdom）
├── tsconfig.json
├── server/src/                 # 后端
│   ├── store.ts                # 内存存储 + 领域校验（不依赖 Hono，可单测）
│   ├── app.ts                  # createApp()：REST 路由与统一错误体
│   └── index.ts                # 启动：/api + 静态托管 dist/（同源，无 CORS）
├── src/
│   ├── main.ts                 # createApp + Pinia + 全局样式
│   ├── App.vue                 # 组合页面：头部 / 发布 / 筛选 / 列表 / Toast / 壁纸
│   ├── components/             # AppHeader / PostComposer / SearchBar / PostCard / PostFeed / ToastMessage
│   ├── stores/posts.ts         # Pinia store：状态 + 派生 + 异步行为
│   ├── lib/
│   │   ├── posts.ts            # Post 类型、字数常量、关键词匹配
│   │   ├── api.ts              # fetch 封装，统一 { ok, data | error } 结果
│   │   ├── preferences.ts      # 只记住上次署名（localStorage，纯界面偏好）
│   │   ├── time.ts             # 相对时间 / 完整时间格式化
│   │   └── highlight.ts        # 关键词切片（纯函数）
│   └── styles/main.css         # Liquid Glass 主题
└── tests/
    ├── setup.ts                # 清空 localStorage、还原全局替身
    ├── helpers/fake-api.ts     # 用 fetch stub 模拟 REST 接口
    └── unit/  stores/  components/  server/
```

## 数据契约

```ts
interface Post {
  id: string          // 服务端 crypto.randomUUID()
  author: string      // 1–20 字，空则回退「花园访客」
  content: string     // 1–500 字，trim 后不得为空
  createdAt: number   // 毫秒时间戳（服务端生成）
  liked: boolean      // 是否点过赞，服务端保存，全局共享
  likes: number       // 点赞总数，≥ 0；liked 为 true 时至少为 1
  favorited: boolean  // 是否收藏，服务端保存
}
```

- 数据只存在服务端进程内存里：进程重启、部署新版本都会清空；不写数据库、不落盘。
- 浏览器侧只剩 `lyd.author.v1`（上次用的署名），不再保存任何动态。
- 写入顺序仍是「服务端成功后才改内存与视图」，失败则提示并保持原状，不会出现「看起来发出去了其实没存住」。

## 架构要点

- **依赖方向单向**：`组件 → store → lib(api)`。`lib/api.ts` 不依赖 Vue，可纯函数式测试；`server/src/store.ts` 不依赖 Hono，路由只做 HTTP 语义。
- **状态最小化**：store 只保存 `posts / author / keyword / error`，排序、命中数、空态全部由 `computed` 派生。
- **可注入**：`createApp({ store })` 允许每个用例注入独立 store；测试用 `app.request()` 打接口，不起端口、不碰网络。
- **组件职责**：`App.vue` 负责编排（事件 → store → Toast），子组件保持展示型；`PostComposer` 持有草稿状态，保存成功后才 `reset()`，失败不丢字。
- **无 `v-html`**：高亮通过 `splitHighlight` 切片后渲染 `<mark>`，用户输入永远走文本插值。

## 视觉风格

iOS Liquid Glass（浅色液态玻璃）：柔和彩色光斑壁纸 + 半透明白玻璃面板，系统蓝 `#0A84FF` 为强调色，大圆角与药丸形，无硬边线与栅格。

- 玻璃基底 `rgba(255,255,255,.46)` + `backdrop-filter: blur(28px) saturate(180%)`，边缘用 `::before` 双层 `mask` 做 1px「上亮下暗」折射高光，再叠顶部内高光与左上斜向镜面反射。
- 四团光斑（蓝 / 紫 / 粉 / 薄荷）固定定位、`blur(92px)`，缓慢漂移与呼吸；中央压一层白色薄雾保证文字对比度。
- 聚焦为蓝色柔光环，点赞为淡粉底 + 红粉心形，删除转红，命中词半透明黄高亮。
- `@supports not (backdrop-filter: blur(1px))` 时把玻璃底提到 `rgba(255,255,255,.92)`；`prefers-reduced-motion` 下关闭漂移、呼吸与位移。
- 零外部资源：不请求字体、图标或 CDN。

## 说明

本项目为独立的学习演示作品，名称、文案、配色与界面均为原创，不包含任何第三方社交平台的名称、标识或界面元素。
