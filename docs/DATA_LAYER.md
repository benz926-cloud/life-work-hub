# 数据层方案（feat/data-layer）

目标：把 14 个组件从 `mock-data.ts` 切到 Supabase，让"加一条刷新就没"变成"真的存住"。

## 现状问题

20 张表建好了、19 个 CRUD hook 写好了，**零处调用**。登录和不登录看到的是同一份
"林涛/小雅/朵朵"演示数据，Auth 等于白做。

## 架构

```
组件（Codex 的层）
   │  只 import 这一层，不再 import mock-data
   ▼
src/hooks/useData.ts        ← 数据层契约：Collection<T>，17 个具名 hook
   │
   ▼
src/hooks/useSupabase.ts    ← 泛型 CRUD（已修排序与归属列）
   ▼
Supabase (RLS)
```

## 契约

所有数据 hook 返回同一个结构：

```ts
interface Collection<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  source: "supabase" | "mock";
  isDemo: boolean;                     // true = 演示数据，写操作不持久化
  refresh(): Promise<void>;
  create(input: Partial<T>): Promise<T | null>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
}
```

三条行为约定：

1. **未配置 Supabase / 未登录 → 自动回落 mock**，`isDemo = true`，页面照常可用。
   和 AI 管线同一套哲学：本地兜底，不白屏。
2. **已登录 → 只显示真实数据**。空表就是空态，不会"删光了 mock 又冒出来"。
   首次使用的数据由播种脚本灌入，不靠 UI 层兜底。
3. **写操作一律乐观更新**：先改本地、再发请求、失败回滚并置 `error`。
   勾一个行李清单不该等 300ms 网络往返。

## 具名 hook

`useInboxData` `useApprovalsData` `useAlertsData` `useWorkTasksData` `useKPIData`
`useFamilyMembersData` `useHealthData` `useCheckinHabitsData` `useCheckinRecordsData`
`useFinanceData` `useSavingsGoalsData` `useWardrobeData` `useOutfitsData`
`useTravelPlansData` `useContentFeedsData` `useSubscriptionRulesData`
`useChildGrowthData(familyMemberId)`

## 三个坑（已在数据层解决）

1. **`list()` 原来没有 `order`。** PostgREST 不保证返回顺序，UI 每次刷新排列都可能变。
   已按表加默认排序（收件箱按 `created_at`、账目按 `date`、成长记录按 `date` 升序…）。
2. **`child_growth_records` 没有 `user_id` 列**，归属靠 `family_member_id`。
   通用 `list(userId)` 对它无效。已支持 `scopeColumn`，并单独提供
   `useChildGrowthData(familyMemberId)`；拿不到孩子 id 时停在演示数据，而不是去查别人的记录。
3. **切换账号时的竞态**：旧请求晚回来会覆盖新数据。已用递增 `reqId` 丢弃过期响应。

## 与 AI 引擎的关系

AI 引擎吃的是纯数据数组，不关心来源。组件把 `items` 传给引擎即可：

```tsx
const { items: records, isDemo } = useFinanceData();
const { items: goals } = useSavingsGoalsData();
const { data: analysis, enhance } = useFinanceAnalysis(records, goals, { monthlyBudget: 10000 });
```

注意：`items` 每次渲染是新数组引用会让 `useMemo` 失效。数据层已用 `useMemo`
稳定了引用，只要不在组件里 `.filter()` 后再传给引擎就没问题；确需过滤请自己 `useMemo`。

## 播种

```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... SEED_EMAIL=you@example.com \
  npx tsx scripts/seed-supabase.ts --dry-run   # 先看会写什么
  npx tsx scripts/seed-supabase.ts             # 真正写入
```

- 需要 **service_role key**（绕过 RLS），**只在本地跑，别进前端、别进 CI**
- 默认幂等：目标账号已有数据就跳过，`--force` 覆盖
- 处理了 id 重映射：`outfits.items` → 新衣物 id、`checkin_records.habit_id` → 新习惯 id、
  `health_records.family_member_id` / `child_growth_records.family_member_id` → 新成员 id

## 还没做（下轮）

- **RLS 实测**：schema 里写了策略，但没人用真账号验证过"能读写自己的、读不到别人的"。
  这是上线前必须做的一次手工测试。
- 组件接入（Codex 的层）：14 个组件换 hook + 加载/空态/失败提示 + `isDemo` 横幅。
- Realtime 订阅、分页、离线队列：都先不做，等真用起来再看需不需要。
