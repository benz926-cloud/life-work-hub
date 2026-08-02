# Life Work Hub — AI 驱动的个人生活与工作管理平台

> **双端架构**：网页版管理中心（全面管理）+ iOS PWA（轻量卡片式交互）
> **多 AI 协作项目**：WorkBuddy（架构+部署） × Claude（AI 管线） × Codex（前端交互）

## 项目概览

| 模块 | 说明 |
|------|------|
| 📊 总览 | 家人状态、工作速览、内容统计、AI 主动建议 |
| 📥 AI 收件箱 | 自然语言输入 → 意图解析 → 四列看板（任务/购物/灵感/AI处理） |
| 📡 内容聚合 | B站/小红书/YouTube 内容发现 → 收藏库 → AI 转化为知识清单/小测试 |
| 💼 工作助手 | 审批中心、关键报表、预警监控、任务跟踪闭环（飞书/工业互联网/北森iTalent） |
| 💊 家庭健康 | 4 人健康数据（Apple Health 同步模拟） |
| 📚 孩子成长 | 学科进度、身高体重趋势、里程碑、AI 分析 |
| ✈️ 旅行计划 | 行程规划、行李清单、AI 攻略生成 |
| 👔 智能穿搭 | 衣柜数据库、颜色/风格匹配、季节适配 |
| 💰 理财管理 | 收支记录、储蓄目标、投资组合 |
| 🎯 打卡习惯 | Keep/多邻国/贝壳英语动态打卡 |
| ⚙️ 设置 | 家庭成员管理、系统集成开关 |

## 技术栈

- **框架**：Next.js 16 (Turbopack) + TypeScript
- **样式**：Tailwind CSS
- **图标**：Lucide React
- **数据库**：Supabase (PostgreSQL，已接入 — 20+ 张表，Auth 已启用)
- **认证**：Supabase Auth (email/password)，AuthContext + 客户端路由守卫
- **PWA**：manifest.json + Service Worker（离线缓存）
- **部署目标**：Vercel / EdgeOne Pages + Supabase

## 项目结构

```
life-work-hub/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # 服务端布局（元数据 + PWA 标签）
│   │   ├── page.tsx            # 主入口
│   │   └── globals.css         # 全局样式
│   ├── components/
│   │   ├── layout/             # AppShell, Sidebar, InstallPrompt, ClientLayout, SW
│   │   ├── overview/           # 总览页
│   │   ├── inbox/              # AI 收件箱
│   │   ├── work/               # 审批/报表/预警/任务
│   │   ├── family/             # 家庭健康/孩子成长/旅行
│   │   ├── content/            # 内容聚合
│   │   ├── wardrobe/           # 智能穿搭
│   │   ├── finance/            # 理财
│   │   ├── health/             # 打卡
│   │   └── shared/             # 通用组件 + 设置页
│   ├── lib/
│   │   ├── auth/AuthContext.tsx   # Supabase Auth Provider (signIn/signUp/signOut)
│   │   ├── mock-data.ts           # 全模块 Mock 数据
│   │   ├── navigation.ts          # 侧边栏导航配置
│   │   └── supabase.ts            # Supabase 客户端 (getSupabase)
│   ├── hooks/
│   │   └── useSupabase.ts         # 19 个泛型 CRUD hooks (useInbox/useApprovals...)
│   └── types/
│       └── index.ts               # 全部 TypeScript 类型定义（17+ 接口）
├── database/
│   └── schema.sql              # PostgreSQL 完整建表 SQL（20+ 张表）
├── public/
│   ├── manifest.json           # PWA 清单
│   ├── sw.js                   # Service Worker（离线缓存）
│   └── icons/                  # App 图标 (192/512/180)
└── .workbuddy/                 # WorkBuddy 项目记忆
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# → http://localhost:3000

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 环境变量

复制 `.env.example` 为 `.env.local` 并填入：

```bash
# Supabase（待接入）
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

目前所有数据使用 Mock 数据（`src/lib/mock-data.ts`），无需配置即可运行。

## 多 AI 协作指引

本项目由三个 AI 协同开发。**当前阶段：Supabase Auth 已集成，进入功能开发阶段。**

### 当前状态 (2026-08-02)

| 项目 | 状态 |
|------|------|
| 项目骨架 (Next.js 16 + Tailwind) | ✅ 完成 |
| Supabase 项目连接 | ✅ czgstjicmvtkdsjpdoni.supabase.co |
| Auth (email/password) | ✅ AuthContext + 路由守卫 |
| 数据库 Schema (20+ 表) | ✅ 已部署 |
| 19 个 CRUD Hooks | ✅ useSupabase.ts |
| PWA (iOS 安装) | ✅ manifest + SW |
| 页面组件 (14 页面) | ✅ 使用 Mock 数据渲染 |
| AI 管线逻辑 | ❌ 待 Claude 开发 |
| UI 交互打磨 | ❌ 待 Codex 开发 |

### Git 分支策略

```
main ────────────────────────────  (WorkBuddy 维护，合并目标)
  ├── feat/supabase-auth  ← 当前  (Auth 基础设施，即将合并)
  ├── feat/ai-pipeline             (Claude — 从 supabase-auth 拉最新)
  └── feat/ui-polish               (Codex — 从 supabase-auth 拉最新)
```

**铁律**：同一时间同一文件只一个 AI 改。PR 由 WorkBuddy Review 后合并到 main。

---

### 给 Claude 的任务（分支：`feat/ai-pipeline`）

⚠️ **开始前执行**：
```bash
git checkout feat/ai-pipeline
git rebase feat/supabase-auth   # 获取最新 Auth 基础设施
```

**任务清单**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| 1 | AI 收件箱意图解析 | `src/components/inbox/InboxPage.tsx` | 用户输入自然语言 → 解析为 task/shopping/inspiration/auto 四个类别。设计 Prompt 链和解析逻辑。 |
| 2 | 内容聚合评分算法 | `src/components/content/ContentHub.tsx` | B站/小红书/YouTube 内容 -> 兴趣匹配度评分 + 优先级排序 |
| 3 | 穿搭推荐匹配 | `src/components/wardrobe/WardrobePage.tsx` | 根据天气/季节/场合，从衣柜数据库中匹配推荐搭配 |
| 4 | 理财分析引擎 | `src/components/finance/FinancePage.tsx` | 收支分类 → 趋势分析 → AI 建议 |
| 5 | 孩子成长 AI 分析 | `src/components/family/ChildGrowth.tsx` | 从生长数据中提取趋势，生成成长报告 |
| 6 | 旅行攻略生成 | `src/components/family/TravelPlan.tsx` | 根据目的地 + 日期 + 偏好生成行程和行李清单 |
| 7 | AI Prompt 库 | `src/lib/ai/prompts.ts` (新建) | 统一管理所有 Prompt 模板和 chain-of-thought 逻辑 |

**交付方式**：输出方案设计文档 + 核心算法/代码。不改 UI 组件结构（留给 Codex）。

---

### 给 Codex 的任务（分支：`feat/ui-polish`）

⚠️ **开始前执行**：
```bash
git checkout feat/ui-polish
git rebase feat/supabase-auth   # 获取最新 Auth 基础设施
```

**任务清单**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| 1 | Auth 表单 UI 优化 | `src/components/auth/AuthForm.tsx` | 当前表单存在样式问题（label/输入框重叠），需要彻底重构为美观的登录/注册界面 |
| 2 | 侧边栏导航动画 | `src/components/layout/Sidebar.tsx` | 展开/折叠过渡动画，移动端手势滑动 |
| 3 | 仪表盘卡片动效 | `src/components/overview/OverviewPage.tsx` | 统计数据卡片 hover/入场动画 |
| 4 | 任务看板拖拽 | `src/components/work/WorkTasks.tsx` | 四列看板（待办/进行中/审核/完成）的拖拽排序 |
| 5 | 健康数据可视化 | `src/components/family/FamilyHealth.tsx` | 心率/步数/睡眠的趋势折线图 |
| 6 | 内容卡片交互 | `src/components/content/ContentHub.tsx` | 卡片 hover 展开、收藏动画、筛选标签 |
| 7 | 暗色模式切换 | 全局 | 提供系统自适应暗色模式 + 手动切换按钮 |
| 8 | 移动端手势优化 | 全局 | 滑动返回、下拉刷新、长按菜单 |
| 9 | 表单验证 & 无障碍 | 全局 | 输入校验、aria 标签、键盘导航 |
| 10 | iOS PWA 体验 | `public/manifest.json`, `src/components/layout/` | Splash screen、状态栏颜色、底部安全区域适配 |

**交付方式**：直接输出修改后的完整组件代码。

---

### WorkBuddy 的职责（我）

- [x] 项目骨架 + Supabase 集成 + 数据库 Schema
- [x] Auth 系统 + PWA 配置
- [ ] 修复登录流程残余 bug
- [ ] Review Claude 和 Codex 的 PR
- [ ] 代码合并到 main
- [ ] 部署到 Vercel / EdgeOne
- [ ] Python Worker（内容定时抓取脚本）

---

### 给 Claude 的上下文模板

```
项目：Next.js 16 + TypeScript + Tailwind
当前分支：feat/ai-pipeline（已 rebase feat/supabase-auth）

类型定义：src/types/index.ts（所有接口）
Mock 数据：src/lib/mock-data.ts
Supabase Hooks：src/hooks/useSupabase.ts（19 个 CRUD hook）
Auth 系统：src/lib/auth/AuthContext.tsx（useAuth() 可用）

目标组件：
- src/components/inbox/InboxPage.tsx
- src/components/content/ContentHub.tsx
- src/components/wardrobe/WardrobePage.tsx
- src/components/finance/FinancePage.tsx
- src/components/family/ChildGrowth.tsx
- src/components/family/TravelPlan.tsx

请设计 [具体功能] 的 AI Prompt 链/算法逻辑。
输出方案设计 + 核心代码，不改 UI 结构。
```

### 给 Codex 的上下文模板

```
项目：Next.js 16 + TypeScript + Tailwind
当前分支：feat/ui-polish（已 rebase feat/supabase-auth）

组件路径：src/components/[模块]/[组件].tsx
样式文件：src/app/globals.css
图标库：lucide-react

请优化 [具体组件] 的交互体验。
保持现有 Tailwind class 风格。
输出完整修改后的组件代码。
```

## iOS 安装

部署后，iPhone Safari 打开网址 → 点击分享 → **添加到主屏幕**
即可获得全屏原生 App 体验（离线可用）。

## License

Private — personal use project.
