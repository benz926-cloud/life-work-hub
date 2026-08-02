# AI 管线方案设计（feat/ai-pipeline）

> 负责人：Claude｜分支：`feat/ai-pipeline`（已 rebase `feat/supabase-auth`）
> 原则：**不改任何 UI 组件结构**，只提供引擎与 hook，供 Codex 在 `feat/ui-polish` 接入。

---

## 1. 总体架构

```
UI 组件 (Codex 负责)
      │  只 import 这一层
      ▼
src/hooks/useAI.ts          ← React 接入层：6 个 hook，返回结构统一
      │
      ▼
src/lib/ai/                 ← 引擎层（纯函数，可单测、可在 Node 里跑）
  ├─ intent.ts     意图解析
  ├─ content.ts    内容评分
  ├─ outfit.ts     穿搭匹配
  ├─ finance.ts    理财分析
  ├─ growth.ts     成长分析
  ├─ travel.ts     旅行生成
  ├─ prompts.ts    Prompt 库（7 个模板，版本化）
  ├─ client.ts     LLM 调用适配器（超时/重试/JSON 容错/缓存）
  ├─ types.ts      EngineResult<T> 等公共类型
  └─ index.ts      统一出口
      │
      ▼
src/app/api/ai/route.ts     ← 服务端唯一出口，key 不进浏览器
      │
      ▼
Anthropic / OpenAI / DeepSeek（fetch 直连，未引入任何 SDK 依赖）
```

### 为什么是「本地引擎 + LLM 增强」而不是纯 LLM

| | 纯 LLM | 本方案 |
|---|---|---|
| 没配 key 时 | 页面全空 | 照常出结果，只是不够"聪明" |
| 首屏延迟 | 2~5s | 0ms（同步算完） |
| 数字准确性 | 会算错钱 | 数字全由 TS 算，模型碰不到 |
| 成本 | 每次访问都烧 token | 只在用户点「AI 分析」时调用 |
| 可测试 | 难 | `scripts/smoke-ai.ts` 全量断言 |

模型只做三件它擅长的事：**语义复核**（这条内容对我到底有没有用）、**常识补齐**（大理有哪些景点）、**措辞润色**（把指标写成人话）。计算、排序、阈值判断一律留在 TS 里。

### 统一返回结构

所有引擎返回 `EngineResult<T>`：

```ts
{ data: T, source: "local"|"llm"|"hybrid", confidence: 0~1, reasons: string[], degraded?: boolean, version: string }
```

`reasons` 是给用户看的中文可解释性文案，UI 可以直接渲染成"AI 为什么这么推荐"。

---

## 2. 七个任务的算法设计

### 任务 1 — 收件箱意图解析 `src/lib/ai/intent.ts`

四层管线，越往后越贵，前面能定就不往后走：

| 层 | 做什么 | 成本 |
|---|---|---|
| L0 | 快捷 chip 注入的显式前缀（`添加任务：`）直接命中 | 0 |
| L1 | 加权中文词典（权重 3/2/1）+ 5 条结构正则 → 四类得分 | 0 |
| L2 | 实体抽取：中文日期、金额、数量、人名、标签 | 0 |
| L3 | 仅当"模糊"（top1 总分 < 2，或 top1−top2 ≤ 1）才调 LLM 复核 | ~1 次调用 |

判别优先级刻意设定：`帮我/调研/对比/整理一份` 类委托动词 → `ai_processing` 压过 `task`；`买/入手/下单` → `shopping` 压过 `task`。这是最容易混的两组。

中文日期解析支持：`今天/明天/后天/大后天`、`N天后`、`周三/本周三/下周一/下下周五`（以本周一为锚点，规避周日跨周歧义）、`8月5日`、`2026-08-05`、`下个月`。优先级由「显式紧急词 → 截止日距今天数 → 类别默认值」三级推导。

**Mock 数据回归：6 条全部还原成原有类别。**

给 Codex 的接入点：`useIntentParser()` 提供 `preview(text)`（输入时零延迟预览将归入哪一类，可以做成输入框下方的实时标签）和 `parse(text)`（提交时的完整解析）。

### 任务 2 — 内容聚合评分 `src/lib/ai/content.ts`

```
总分 = 兴趣匹配 40% + 情境相关 25% + 内容质量 15% + 时效 15% + 平台偏好 5%
```

三个关键设计：

1. **质量分做平台内归一化。** 小红书 3.2 万赞和 B 站 8 千赞不是一个量级，直接比大小会让小红书永远霸榜。用各平台基准中位数（`PLATFORM_BASELINE`）做 log10 归一化，再叠加互动深度（评论/点赞比，反映"引发讨论"而非"随手点赞"）。
2. **情境相关分是这个产品真正的差异点。** 同一篇大理攻略，用户 12 天后要去大理，它就该排第一；没有行程时它只是普通旅游内容。情境从各模块真实数据推导（`buildUserContext()`：旅行计划、家人 `health_conditions`、孩子话题、工作关键词、学习目标）。
3. **MMR 多样性重排**（λ=0.75）。相似度 = 同类目 0.6 + 同平台 0.25 + 同作者 0.5。避免"前六条全是穿搭"。

冒烟测试实测：大理攻略情境分 76、高血压内容情境分 70，前三条类目互不重复。

### 任务 3 — 穿搭推荐 `src/lib/ai/outfit.ts`

三步：

1. **需求建模**：温度 → 槽位组合 + 总保暖度目标（≥28°C 三件套；8~15°C 加外套；<8°C 加厚外套 + 配饰）；场合 → 允许风格 + 目标正式度（通勤 3.6、正式 4.7、运动 1.2）。
2. **单品打分**：季节 30 + 风格 30 + 温度 20 + 新鲜度 10（越久没穿越优先，7 天满分）。
3. **组合搜索**：按槽位做 **beam search（每层留 12 条）**。全枚举在衣柜到 100 件时是 10⁶ 量级，beam 在 O(n·k) 内拿到接近最优解。
   组合分 = 单品均分 60% + 颜色协调 25% + 风格一致 10% + 正式度 5% − 保暖度偏差惩罚。

**颜色协调**用 HSL 色轮而非硬编码配对表：中性色 + 任意 = 85；两件中性色需拉开明度（差 <0.12 判 68，会糊）；同色系（色相差 <30）需明度层次；互补色需至少一方低饱和；60°~150° 的中间地带判 45（最容易脏）。中英文色名都能解析（`驼色`/`camel`/`藏青` 均可）。

连衣裙走独立分支替代 top+bottom；有雨时提示换防水鞋；单品集合相同的组合会去重。

### 任务 4 — 理财分析 `src/lib/ai/finance.ts`

**A. 自动分类** `categorizeTransaction()`：8 组加权正则，带家庭上下文修正 —— "朵朵书包文具" 现有 mock 归在 `shopping`，引擎判为 `education`（置信度 1.0），更符合家庭记账习惯。`reclassify()` 批量给出需人工确认的条目。

**B. 结构分析** `analyzeFinance()`：

- 类目结构（金额/占比/笔数/客单价/环比）
- **刚性 / 半刚性 / 弹性三分**（住房·健康·教育 = 刚性），优化建议只动弹性部分
- 趋势：月度序列 + 支出线性回归斜率
- 异常检测：单笔 > 该类目 P90×1.5、类目环比 ≥50%、新增类目
- 储蓄目标：每月应存、按当前结余速度的达成月份、是否 on track
- 财务健康分（储蓄率 40 + 预算遵守 30 + 刚性占比 20 + 目标进度 10）

**两个坑，已在引擎里解决**（这两个 bug 现有 `FinancePage.tsx` 都有）：

1. **月末预测被刚性支出污染。** 8 月 2 日时房贷 3800 已入账，用「总支出 ÷ 已过天数 × 当月天数」会外推出 **¥71,114** 这种荒谬数字。引擎改为：刚性支出按已发生额计，只对弹性部分做日均外推 → **¥16,014**，并附 `projectionConfidence: low/medium/high`，样本 <7 天时不下"大概率超支"结论。
2. **工资跨月入账导致储蓄率为 0。** 7 月工资记在 7/31，8 月账本收入是 0 → 储蓄率 0%、健康分 6 分。引擎在本期无收入记录时用历史月均兜底（标记 `incomeIsEstimated`），并把健康分改为**近 90 天滚动窗口**计算，避免月初两天的偏态数据。

> 顺带提醒 Codex / WorkBuddy：现有 `FinancePage.tsx` 把所有月份的记录混加成"8月账本"（4677 实为 7 月+8 月），接引擎后应改为 `analysis.totals`。

**不做的事**：不推荐任何理财产品、股票，不预测收益，不给投资建议（已写进 Prompt 纪律）。

### 任务 5 — 孩子成长分析 `src/lib/ai/growth.ts`

输出「趋势 + 参考区间对照 + 可执行建议」，**合规边界写死在引擎里**：

- 身高体重只给「处于参考区间中段 / 偏上段 / 偏下段」这类**位置描述**，绝不出现"正常/异常/偏矮/超重"；免责声明由代码固定注入，不采用模型生成的版本。
- 视力只描述变化幅度并提示复查（任一眼下降 ≥0.1 或绝对值 <4.9 触发），不判断近视。
- 学业只描述变化与练习建议，不做能力评价、不贴"偏科"标签。

技术要点：

- **"钢琴: 3" 是考级等级不是百分制**，引擎按 `score <= 10` 判为 `level`，不参与百分制均值与涨跌比较（否则会算出"钢琴 3 分严重不及格"）。
- 计算年化生长速度（mock：61 天 +2cm → 12cm/年）。
- **不就地修改入参数组** —— 现有 `ChildGrowth.tsx` 里的 `mockGrowthRecords.reverse()` 会污染全局 mock 数据，每次渲染顺序都翻转，是个真实存在的 bug。引擎一律先 `[...records]`。

### 任务 6 — 旅行攻略生成 `src/lib/ai/travel.ts`

**输出结构与现有 `TravelPlan.itinerary / checklist` 完全同构**，`TravelPlan.tsx` 一行不用改就能渲染：

```ts
itinerary = { days: [{ day, title, activities: string[], area?, note? }], tips: string[] }
checklist = { documents | clothing | kids | other : { name, done }[] }
```

分工：**本地负责结构**（天数骨架、节奏、行李、预算拆分 —— 确定性、可复现），**LLM 负责内容**（具体景点、地理动线）。LLM 返回的天数被强制对齐本地骨架，多的截断、缺的用骨架补，避免"要 5 天给了 7 天"。

- 内置 5 个高频目的地知识库（大理/成都/三亚/北京/厦门），景点带 `area / kidFriendly / intensity / tags`，**按片区聚合排布减少折返**。未知目的地输出可编辑骨架并给出警告。
- 首末日活动量减半留交通缓冲；有儿童每天插入休息段；**有长辈（≥65 岁或 role=parent）时过滤 intensity=3 的徒步项**——实测「洗马潭步道」被正确剔除。
- 行李清单规则驱动：基础项 + 气候（高原/海滨/内陆/寒冷）+ 同行人（儿童 6 项、长辈用药分装）+ 活动类型（徒步→防滑鞋）+ 天数（上衣件数：短途 days+1，长途 ×0.8+1）。
- 预算拆分 交通 35 / 住宿 30 / 餐饮 20 / 门票 10 / 机动 5，并校验人均日均合理性（<¥300 提示偏紧，>¥3000 提示可升级）。

### 任务 7 — Prompt 库 `src/lib/ai/prompts.ts`

7 个模板，全部版本化（改 Prompt 必须升 version，便于回溯效果）：

| id | 用途 | temperature |
|---|---|---|
| `inbox.intent` | 意图解析复核 | 0.1 |
| `content.triage` | 内容价值分诊 | 0.2 |
| `content.knowledge` | 内容→清单/小测/行动计划（对应「AI 转化」按钮） | 0.4 |
| `wardrobe.rationale` | 搭配理由（不改组合，只写理由） | 0.5 |
| `finance.advice` | 理财归因与建议 | 0.3 |
| `family.growth` | 成长报告叙述 | 0.3 |
| `travel.itinerary` | 行程内容填充 | 0.6 |

四条设计原则：

1. **结构化 CoT** —— 强制模型先填 `reasoning: string[]`（3~6 条要点，每条 ≤30 字）再填 `result`。保留推理收益，同时保证输出可解析。
2. **Schema 前置** —— 期望的 JSON 结构写进 system，显著降低格式错误率。
3. **模型不碰数字** —— 所有数值由本地引擎算好后作为输入喂进去，Prompt 明确写"只使用输入中给出的数字，禁止自行计算"。
4. **纪律条款** —— 医疗/理财类模板带硬性红线（见任务 4、5）。

---

## 3. 接入方式（给 Codex）

**只需要 import `@/hooks/useAI`，不要直接碰 `@/lib/ai` 内部实现。**

每个 hook 返回：`{ data, loading, error, source, confidence, reasons, degraded, enhance() }`。
`data` 在首次渲染就有值（本地引擎同步算出），**不会白屏、不会 loading 闪烁**；`enhance()` 是可选的 LLM 增强，绑在「AI 分析」「AI 扫描」这类按钮上。

```tsx
// 1. InboxPage —— 替换现有的 if(input.includes("买")) 那段
const { preview, parse } = useIntentParser();
const hint = preview(input);            // 输入时实时显示「将归入：任务 · 8月5日到期」
const res = await parse(input);         // 提交时解析，模糊才走 LLM
setItems([{ ...toInboxItem(res.data, userId), id: `i${Date.now()}` }, ...items]);

// 2. ContentHub
const ctx = buildUserContext({ trip: plan, familyMembers, childTopics: ["开学"], workTopics: ["AI"] });
const { data: ranked, enhance } = useContentRanking(feeds, rules, { ctx });
// ranked[i].score / .verdict / .why / .actionable / .breakdown 直接渲染
// 「🤖 AI 扫描」按钮 → onClick={enhance}

// 3. WardrobePage
const { current, next, enhance } = useOutfitRecommendation(items, { temperature: 32, weather: "晴", occasion: "casual" });
// current.items 渲染卡片，current.note 写进「AI 搭配理由」，current.warnings 显示提醒
// 「换一套」按钮 → onClick={next}

// 4. FinancePage
const { data: a, enhance } = useFinanceAnalysis(records, goals, { monthlyBudget: 10000 });
// a.totals / a.byCategory / a.budget / a.goals / a.healthScore / a.recommendations

// 5. ChildGrowth
const { data: report, enhance } = useGrowthReport(records, child);
// report.metrics / report.sections / report.suggestions / report.disclaimer（必须渲染）

// 6. TravelPlan
const { data: draft, generate } = useTravelGenerator();
await generate({ destination: "大理", startDate, endDate, travelers, budget: 15000, pace: "balanced" });
// draft.itinerary / draft.checklist 与现有渲染逻辑完全兼容
```

UI 上建议加两个通用元素：

- `source === "hybrid"` 时显示「AI 增强」小标；`degraded === true` 时显示「AI 暂不可用，已用本地规则」。
- `reasons[]` 折叠成「为什么这么推荐」，这是这个产品的信任感来源。

---

## 4. 环境变量

`.env.local`（**不要加 `NEXT_PUBLIC_` 前缀，key 不能进浏览器**）：

```bash
AI_PROVIDER=anthropic          # anthropic | openai | deepseek
AI_API_KEY=sk-...
AI_MODEL=claude-sonnet-5       # 或 gpt-4o-mini / deepseek-chat
# AI_BASE_URL=                 # 可选：自建网关 / 兼容 OpenAI 协议的服务
```

**不配也能跑**：`GET /api/ai` 返回 `{enabled:false}`，前端全部走本地引擎，页面功能完整。

---

## 5. 验证

```bash
npx tsc --noEmit                      # 类型检查：通过
npx eslint src/lib/ai src/hooks/useAI.ts src/app/api/ai   # 0 error 0 warning
npx tsx scripts/smoke-ai.ts           # 冒烟测试：全部通过（需 npm i --no-save tsx）
```

`scripts/smoke-ai.ts` 用 `mock-data.ts` 跑一遍全部六个引擎，覆盖 30+ 条断言，包括：

- 8 条意图分类用例 + mock 全量回归 + 中文日期/金额抽取
- 情境加分是否生效、多样性重排是否生效
- 32°C 不出外套 / 3°C 必出外套
- 支出合计、刚性划分、收入估算、预测置信度
- 不就地修改入参、钢琴等级制识别、文案无诊断性词汇
- 旅行输出结构与 `TravelPlan.tsx` 渲染契约的一致性

> `npx next build` 在本沙箱失败，原因是 `layout.tsx` 里的 `next/font/google` 需要访问 Google Fonts 而沙箱无外网 —— 与本次改动无关，本机应能正常构建。

---

## 6. 交接：本次没做 / 建议下一步

1. **不改 UI 结构**（约定如此）。接入工作在 `feat/ui-polish`，见第 3 节代码片段。
2. `InboxPage` 现有分类逻辑、`FinancePage` 的跨月混加、`ChildGrowth` 的 `reverse()` 副作用建议一并替换/修复。
3. 内容抓取（B 站/小红书/YouTube）仍是 WorkBuddy 的 Python Worker 范畴，引擎只消费 `ContentFeed`。
4. 天气数据目前靠 `OutfitContext.temperature` 传入，接真实天气 API 后穿搭推荐才完整。
5. 建议后续把 `scripts/smoke-ai.ts` 的断言拆成 vitest 用例进 CI。
