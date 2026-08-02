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
- **数据库**：Supabase (PostgreSQL，待接入)
- **PWA**：manifest.json + Service Worker + iOS 全屏支持
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
│   │   ├── mock-data.ts        # 全模块 Mock 数据
│   │   ├── navigation.ts       # 侧边栏导航配置
│   │   └── supabase.ts         # Supabase 客户端（待接入）
│   └── types/
│       └── index.ts            # 全部 TypeScript 类型定义（17+ 接口）
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

本项目由三个 AI 协同开发，分工如下：

### WorkBuddy — 架构 + DevOps
- 项目脚手架、导航路由、布局系统
- Supabase 数据库集成
- PWA 配置与 iOS 适配
- 部署（Vercel/EdgeOne/CloudStudio）
- 代码审查与分支合并
- Python Worker（内容采集脚本）

### Claude — AI 管线核心
**分支：`feat/ai-pipeline`**
- AI 收件箱意图解析 Prompt 设计
- 内容聚合过滤评分算法
- 穿搭推荐匹配逻辑
- 理财分析 & 孩子成长 AI 分析
- 旅行攻略自动生成

### Codex — 前端交互打磨
**分支：`feat/ui-polish`**
- 任务看板拖拽动画
- 健康数据趋势图动画
- 内容卡片 hover/展开动效
- 移动端手势交互
- 暗色模式切换动画
- 表单验证 & 无障碍

### Git 分支策略
```
main ────────────────────────────  (WorkBuddy 维护)
  ├── feat/supabase-auth           (WorkBuddy)
  ├── feat/ai-pipeline             (Claude)
  └── feat/ui-polish               (Codex)
```

**铁律**：同一时间同一文件只一个 AI 改。PR 由 WorkBuddy Review 后合并。

### 给 Claude 的上下文
```
项目：Next.js 16 + TypeScript + Tailwind
类型定义：src/types/index.ts（所有接口）
Mock 数据：src/lib/mock-data.ts
AI 收件箱组件：src/components/inbox/InboxPage.tsx
内容聚合组件：src/components/content/ContentHub.tsx

请设计 [具体功能] 的 AI Prompt 链/算法逻辑，
输出方案设计，不直接改代码。
```

### 给 Codex 的上下文
```
项目：Next.js 16 + TypeScript + Tailwind
组件路径：src/components/work/WorkTasks.tsx（或其他）

请优化 [具体组件] 的交互体验：
- 保持现有 Tailwind class 命名风格
- 输出完整组件代码
```

## iOS 安装

部署后，iPhone Safari 打开网址 → 点击分享 → **添加到主屏幕**
即可获得全屏原生 App 体验（离线可用）。

## License

Private — personal use project.
