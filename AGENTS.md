<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Life Work Hub — 多 AI 协作规范

**本文件是 WorkBuddy / Claude / Codex 开工前必读的唯一规则源。**
`README.md` 面向人、会过时；规则冲突时**以本文件为准**。

项目：Next.js 16 + TypeScript + Tailwind + Supabase 的个人生活与工作管理平台，
网页版管理中心 + iOS PWA 双端。

---

## 1. 铁律：按「层」分工，不按「文件」分工

一个 React 组件天然同时含逻辑和视图，按文件划分守不住——`ContentHub.tsx`
曾被同时分给两个 AI，必然冲突。改为按目录层划分，交接面收敛到接口而不是整个组件。

| 层 | 目录 | 负责人 | 明确禁止 |
|---|---|---|---|
| 业务逻辑 / AI 引擎 | `src/lib/ai/**`、`src/hooks/**`、`src/app/api/**`、`docs/**`、`scripts/**` | **Claude** | 写 JSX；修改 `src/components/**` |
| 视图与交互 | `src/components/**`、`src/app/globals.css`、`public/**` | **Codex** | 写业务计算逻辑；绕过 hook 直接 import `src/lib/ai/` 内部实现 |
| 骨架 / 数据 / 部署 | `src/app/**`（api 除外）、`src/lib/`（ai 除外）、`database/**`、`.github/**`、根配置 | **WorkBuddy** | — |

### 三条配套规则

1. **`src/hooks/**` 是唯一的层间契约。** Codex 只 import `@/hooks/useAI`，
   不碰 `@/lib/ai/*` 的内部实现。引擎内部随时可以重写，只要 hook 返回结构不变。
2. **`src/types/index.ts` 是共享契约，只增不改。** 新增接口/字段自便；
   修改或删除已有字段必须先经 WorkBuddy 确认，否则会同时打断另外两条线。
3. **确实需要越界时**：不要偷偷改。要么开 issue 让对应负责人改，
   要么在 PR 上打 `override-ownership` 标签并在描述里写明理由。
   CI 的归属守卫（`scripts/check-ownership.sh`）会按分支名机械检查这条规则。

---

## 2. 分支与合并

```
main ──────────────────────────────  WorkBuddy 维护，唯一合并目标
  ├── feat/supabase-auth             Auth 基础设施
  ├── feat/ai-pipeline               Claude
  └── feat/ui-polish                 Codex
```

- **开工第一件事永远是 rebase。** 曾经出现过 `feat/ai-pipeline` 还指向
  「Initial commit from Create Next App」的情况——不 rebase 就等于在空脚手架上干一天。
- **小步合并，不攒大包。** 新接口先合一个只含类型/空壳的 PR 把契约定下来，
  另外两条线拿着契约同步开工，不要等功能全做完才第一次集成。
- PR 由 WorkBuddy review 后合入 main；CI 全绿是合入的前置条件。

---

## 3. 开工检查清单（每次必做）

```bash
git fetch origin
git checkout <你的分支>
git rebase origin/main          # 或当前的基线分支
npm install
npx tsc --noEmit                # 起手必须是干净的；不干净说明基线有问题，先问 WorkBuddy
```

然后读三样东西：本文件 → `docs/` 下与你任务相关的设计文档 → 你要动的那一层的现有代码。

---

## 4. 收工检查清单（每次必做）

```bash
npx tsc --noEmit                                    # 必须 0 error
npx eslint src/lib/ai src/hooks src/app/api         # 你新写的代码必须 0 error 0 warning
npm i --no-save tsx && npx tsx scripts/smoke-ai.ts  # 动过引擎就要跑
bash scripts/check-ownership.sh                     # 确认没越界
```

PR 描述里必须包含四段：**本轮完成 / 关键决定 / 改动的文件 / 下一步（具体到能直接开干）**。
另外单列一段「路过时发现的问题」——见第 5 节。

---

## 5. 代码约定

### AI 管线（Claude 的地盘，其他人接入时也要知道）

- **本地引擎兜底 + LLM 增强**：没配 API key 时页面必须照常出结果，不允许白屏。
- **模型不碰数字**：所有计算、排序、阈值判断留在 TypeScript 里。
  模型只做语义复核、常识补齐、措辞润色。Prompt 里明确写「只使用输入中给出的数字」。
- **key 只在服务端**：LLM 调用一律走 `src/app/api/ai`，
  环境变量不许带 `NEXT_PUBLIC_` 前缀。
- **医疗与理财有硬红线**：儿童成长不做医学判断、不说"正常/异常"；
  理财不推荐任何产品、不预测收益。红线写在代码里，不只写在 Prompt 里。

### 数据与副作用

- **不就地修改入参**。渲染函数里对共享数组做 `.reverse()` / `.sort()`
  会污染全局 mock 数据，先 `[...arr]`。这个 bug 真实发生过。
- **`src/lib/mock-data.ts` 是共享 fixture**，不是草稿纸。改它等于同时改三个人的测试基线，
  要改先说。冒烟测试的断言直接依赖它。
- 跨月/跨周期的聚合要显式按周期过滤，不要把所有记录混加。

### 存量问题谁负责

三条线各走各的，最容易没人管的是「路过时发现的别人层里的 bug」。
规则：**发现者不修，但必须记录**——写进 PR 的「路过时发现的问题」段落，
由 WorkBuddy 分派。已知未修的存量问题见 `docs/AI_PIPELINE.md` 第 6 节。

---

## 6. CI 门禁（`.github/workflows/ci.yml`）

| 检查 | 是否阻断 | 说明 |
|---|---|---|
| `tsc --noEmit` | ✅ 阻断 | 全仓库必须 0 error |
| ESLint（新代码） | ✅ 阻断 | `src/lib/ai`、`src/hooks`、`src/app/api` 必须 0 error 0 warning |
| ESLint（存量棘轮） | ✅ 阻断 | 全仓库错误数不得超过基线，只许降不许涨 |
| `next build` | ✅ 阻断 | 防止只在类型层面正确、构建期才炸 |
| 冒烟测试 | ✅ 阻断（文件存在时） | `scripts/smoke-ai.ts` |
| 归属守卫 | ✅ 阻断（可 label 豁免） | 按分支名检查有没有越层 |

存量 ESLint 基线写在 workflow 的 `LINT_ERROR_BASELINE` 里。修掉存量错误后
**记得把基线调低**，否则棘轮就锁不紧了。

---

## 7. 交接

每轮收工在 Notion「AI 交接日志」新建一条，正文用六段模板：
本轮完成 / 关键结论·决定 / 产出·改动的文件 / 下一步 / 待确认 / 值得长期记住的事实。
状态与领域只用已有下拉选项，不新造词。
