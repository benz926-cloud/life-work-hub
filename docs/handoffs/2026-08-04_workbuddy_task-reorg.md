# Handoff: 任务体系重组 + 项目状态梳理

**日期:** 2026-08-04
**Agent:** WorkBuddy
**交接给:** 不限（Claude / Codex / 下次 WorkBuddy session）

---

## 1. 本轮完成

- ✅ 清理 6 条过期 WorkBuddy 任务（Schema 设计、ESLint、RLS 跑测、手写交接等）
- ✅ 新建 6 条当前有效任务，按 agent 分配：
  - **WorkBuddy**: 推送分支、合并到 main、Python Worker、自动化监控
  - **Codex**: UI hooks 接入
  - **Claude**: AI Pipeline 联调
- ✅ 项目状态已转入 WorkBuddy 任务系统 + git repo 双轨管理

## 2. 关键决定

- **项目管理模式**: git 管代码/文档 → WorkBuddy 管任务/自动化/记忆。两者互补，不互替。
- **Agent 开工流程**: 先读 LATEST.md → 再查 WorkBuddy 任务列表 → 认领自己的任务 → 开工。
- **不建重叠系统**: 不用 Jira/Notion/Linear，WorkBuddy 原生活务就够了。

## 3. 改动文件

- WorkBuddy 任务系统：6 条关闭 + 6 条新增（无文件改动）

## 4. 当前状态

**分支图**:
```
main ← feat/ai-pipeline-rls2 (当前, 未推送的 handoff)
     ← feat/ai-pipeline-rls (有 handoff 文件, 待废弃?)
     ← feat/ai-pipeline (Claude 的 AI pipeline 代码)
```

**待合并**: `feat/ai-pipeline-rls2` → `main`（先推送再合并）

**自动化**: 3 条已创建，明天（8/5）首跑

## 5. 下一步（按优先级）

| # | 任务 | Agent | 状态 |
|---|------|-------|------|
| 1 | 推送 feat/ai-pipeline-rls2 到 GitHub | WorkBuddy | ⬜ |
| 2 | 合并到 main | WorkBuddy | ⬜ |
| 3 | Python 内容抓取 Worker | WorkBuddy | ⬜ |
| 4 | 自动化首跑监控 (8/5) | WorkBuddy | ⬜ |
| 5 | UI hooks 接入 | Codex | ⬜ |
| 6 | AI Pipeline 端到端联调 | Claude | ⬜ |

## 6. 交接给谁

- **下一个 WorkBuddy session**: 从任务 #1（推送+合并）开始
- **Codex**: 读此文档 → 认领任务 #5（UI hooks）
- **Claude**: 读此文档 → 等 Python Worker 产出数据后认领任务 #6

## 7. 给 Tao 的备注

- 明天早上 7:30 第一条自动化会跑——如果飞书/QQ邮箱没登录会报错，留意一下
- 当前分支有点乱（`feat/ai-pipeline-rls` vs `feat/ai-pipeline-rls2`），建议合并后清理旧分支
- 下次开新任务直接说「看任务列表，继续干活」就行
