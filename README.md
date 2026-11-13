# 老黄的后花园

一方自己的小院：想说什么，就种下一句。

一个 **Vue 3 + Pinia + Vite** 的轻量发布小站。没有服务端，所有内容保存在你自己浏览器的 `localStorage` 里；界面为 iOS **Liquid Glass** 风格的浅色磨砂玻璃。

## 功能

- **发布**：填写署名（留空记为「花园访客」）+ 正文（1–500 字），点「种下这条」或按 `Ctrl / ⌘ + Enter` 提交；实时字数计数，超过 500 字自动禁用提交。
- **查看**：按发布时间倒序展示，包含头像首字、署名、相对时间（刚刚 / N 分钟前 / 今日时分 / 月日时分）与正文，正文保留换行。
- **点赞**：每条可点赞 / 取消点赞，状态写入本地存储，刷新后仍在。
- **删除**：二次确认后删除，列表与本地存储同步移除。
- **筛选**：顶部搜索框对正文与署名做大小写不敏感匹配，实时过滤并显示「共 N 条 · 命中 M 条」，命中文字高亮，可一键清除（或按 `Esc`）。
- **容错**：存储被禁用、数据损坏、空间已满都有明确提示；「一条都没有」与「没搜到」是两种不同空态。
- **多标签同步**：任意标签页写入后，其他页监听 `storage` 事件自动刷新列表。

## 技术栈

| 关注点 | 选型 |
| --- | --- |
| 运行时 | Node.js ≥ 20（开发与构建） |
| 框架 | Vue 3.5（Composition API + `<script setup lang="ts">`） |
| 状态 | Pinia 3（setup store） |
| 构建 | Vite 6 |
| 测试 | Vitest 3 + @vue/test-utils 2 + jsdom |
| 语言 | TypeScript（`tsc --noEmit` 严格模式） |
| 存储 | 浏览器 `localStorage`，键名 `lyd.posts.v1` / `lyd.author.v1` |

## 快速开始

```bash
npm install       # 安装依赖
npm run dev       # 本地开发（默认 http://localhost:5173）
npm run build     # 生产构建到 dist/
npm run preview   # 预览构建产物
npm test          # 跑一次全部测试
npm run test:watch # 监听模式（TDD 时使用）
npm run typecheck # TypeScript 严格类型检查
```

> 浏览器直接双击 `index.html` 已经不可用（需要 Vite 编译），请使用上面的命令。

## TDD 工作流

项目按「先测试、后实现」推进，每一轮都跑过一次红灯再转绿：

```bash
npm run test:watch   # 1. 写一个失败的测试（红）
                     # 2. 写最小实现让它通过（绿）
                     # 3. 重构，测试保持全绿
```

当前 **9 个测试文件 / 94 个用例全部通过**：

| 测试文件 | 覆盖内容 |
| --- | --- |
| `tests/unit/time.spec.ts` | 相对时间分档、跨天、跨年、未来时间 |
| `tests/unit/highlight.spec.ts` | 关键词切片、大小写、多次命中、不丢字 |
| `tests/unit/storage.spec.ts` | 常量契约、id 生成、脏数据降级、字段裁剪、禁用存储、配额失败 |
| `tests/stores/posts.spec.ts` | 初始化 / 发布 / 校验 / 回滚 / 点赞 / 删除 / 排序 / 筛选 / 双空态 |
| `tests/components/PostComposer.spec.ts` | 计数、超限禁用、空内容校验、提交载荷、快捷键、`reset()` |
| `tests/components/PostCard.spec.ts` | 署名 / 正文 / `<time>`、高亮、点赞态、二次确认删除、头像变体 |
| `tests/components/SearchBar.spec.ts` | 统计文案、清除按钮显隐、`v-model` 同步、`Esc` |
| `tests/components/PostFeed.spec.ts` | 列表渲染、两种空态、事件上抛 |
| `tests/components/App.spec.ts` | 端到端集成：渲染、发布、筛选、点赞、删除、跨标签同步 |

## 目录结构

```text
laohuang-backyard/
├── index.html                  # Vite 入口（挂载 #app）
├── package.json
├── vite.config.ts              # Vite + Vitest 配置（jsdom 环境、@ 别名）
├── tsconfig.json
├── src/
│   ├── main.ts                 # createApp + Pinia + 全局样式
│   ├── App.vue                 # 组合页面：头部 / 发布 / 筛选 / 列表 / Toast / 壁纸
│   ├── components/
│   │   ├── AppHeader.vue       # 悬浮玻璃导航（滚动加深）
│   │   ├── PostComposer.vue    # 发布卡（草稿、计数、校验，暴露 reset/focus）
│   │   ├── SearchBar.vue       # 筛选条与统计
│   │   ├── PostCard.vue        # 单条动态（高亮、点赞、删除确认）
│   │   ├── PostFeed.vue        # 列表容器与双空态
│   │   └── ToastMessage.vue    # 提示条
│   ├── stores/posts.ts         # Pinia store：状态 + 派生 + 行为
│   ├── lib/
│   │   ├── storage.ts          # localStorage 读写、校验、容错（可注入 storage）
│   │   ├── time.ts             # 相对时间 / 完整时间格式化
│   │   └── highlight.ts        # 关键词切片（纯函数）
│   └── styles/main.css         # Liquid Glass 主题
└── tests/
    ├── setup.ts                # 每个用例前清空 localStorage
    ├── unit/  stores/  components/
```

## 数据契约

| 键名 | 内容 |
| --- | --- |
| `lyd.posts.v1` | 全部动态的 JSON 数组 |
| `lyd.author.v1` | 上次使用的署名 |

```ts
interface Post {
  id: string          // Date.now().toString(36) + 随机串
  author: string      // 1–20 字，空则回退「花园访客」
  content: string     // 1–500 字，trim 后不得为空
  createdAt: number   // 毫秒时间戳
  liked: boolean      // 本地点赞状态
}
```

- 数据只存在于当前浏览器与当前域名下；清除站点数据、换浏览器或换设备都不会同步。
- 读取时逐条校验并裁剪字段，损坏数据降级为空列表并提示。
- 写入顺序是「先落盘、成功后才改内存与视图」，失败则回滚并提示，不会出现「看起来发出去了其实没存住」。

## 架构要点

- **依赖方向单向**：`组件 → store → lib`。`lib` 不依赖 Vue，便于纯函数测试；`storage` 接受可注入的 `Storage`，测试里可直接传入会抛错的假实现，无需 mock 全局。
- **状态最小化**：store 只保存 `posts / author / keyword / error`，排序、命中数、空态全部由 `computed` 派生，避免冗余状态不一致。
- **组件职责**：`App.vue` 负责编排（事件 → store → Toast），子组件保持展示型；`PostComposer` 持有草稿状态并在保存成功后才由父组件调用 `reset()`，保证写入失败时不丢字。
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
