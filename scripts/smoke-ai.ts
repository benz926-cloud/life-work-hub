/**
 * AI 管线冒烟测试：用 mock-data 跑一遍全部引擎，
 * 断言输出结构与 UI 现有渲染契约兼容。
 * 运行：npx tsx scripts/smoke-ai.ts
 */
import {
  mockInboxItems, mockContentFeeds, mockSubscriptionRules, mockWardrobeItems,
  mockOutfits, mockFinanceRecords, mockSavingsGoals, mockGrowthRecords,
  mockFamilyMembers, mockTravelPlans,
} from "@/lib/mock-data";
import { parseIntentLocal } from "@/lib/ai/intent";
import { rankContentLocal } from "@/lib/ai/content";
import { recommendOutfitsLocal } from "@/lib/ai/outfit";
import { analyzeFinance, categorizeTransaction } from "@/lib/ai/finance";
import { analyzeGrowth } from "@/lib/ai/growth";
import { generateTravelLocal, toTravelPlan, checklistProgress, normalizeChecklist, normalizeItinerary, pickUpcomingTrip } from "@/lib/ai/travel";
import { buildUserContext } from "@/hooks/useAI";
import { buildSuggestions } from "@/lib/ai/suggestions";
import { buildCockpit, cardSubtitle, normalizeApproval, normalizeMessage, normalizeReport, normalizeBrief } from "@/lib/ai/cockpit";
import type { AgentOutput } from "@/types";
import { mockAlerts, mockHabits, mockCheckins } from "@/lib/mock-data";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failed++; console.error("  ✗ " + msg); } else { console.log("  ✓ " + msg); }
}
const NOW = new Date("2026-08-02T12:00:00+08:00");

console.log("\n===== 1. 意图解析 =====");
const cases: [string, string][] = [
  ["准备下周一部门汇报PPT，需要Q2数据", "task"],
  ["买一双跑步鞋，Nike Pegasus或者亚瑟士", "shopping"],
  ["如果做一个AI穿搭App，核心功能应该是衣柜数字化+智能匹配", "inspiration"],
  ["帮我调研大理5天4晚亲子游行程", "ai_processing"],
  ["朵朵秋季开学需要准备的学习用品清单", "task"],
  ["关注Sora视频生成技术最新进展", "inspiration"],
  ["添加任务：8月5日前交报销单", "task"],
  ["明天下午3点前把合同发给张伟经理", "task"],
];
for (const [text, expect] of cases) {
  const r = parseIntentLocal(text, NOW);
  const d = r.data;
  const okCat = d.category === expect;
  console.log(`  [${okCat ? "✓" : "✗"}] "${text.slice(0, 22)}" → ${d.category}(期望${expect}) p=${d.priority} due=${d.entities.dueDate ?? "-"} tags=${d.entities.tags.join(",") || "-"} conf=${r.confidence.toFixed(2)}`);
  if (!okCat) failed++;
}
const dateCase = parseIntentLocal("下周一要交材料", NOW).data.entities;
assert(dateCase.dueDate === "2026-08-03", `「下周一」(2026-08-02 是周日) → ${dateCase.dueDate}，期望 2026-08-03`);
assert(parseIntentLocal("报销2800元差旅费", NOW).data.entities.amount === 2800, "金额抽取 2800");

console.log("\n===== 2. 内容评分 =====");
const ctx = buildUserContext({
  trip: { destination: mockTravelPlans[0].destination, start_date: mockTravelPlans[0].start_date },
  familyMembers: mockFamilyMembers,
  childTopics: ["开学", "钢琴"],
  workTopics: ["AI", "产线"],
  learningGoals: ["英语"],
  now: NOW,
});
const ranked = rankContentLocal(mockContentFeeds, mockSubscriptionRules, { ctx, now: NOW });
ranked.data.forEach((r, i) => {
  console.log(`  ${i + 1}. [${r.score}] ${r.verdict.padEnd(13)} ${r.feed.title.slice(0, 24)} | ${r.why}${r.actionable ? ` → ${r.actionable}` : ""}`);
});
assert(ranked.data.length === mockContentFeeds.length, "全部内容都被评分");
assert(ranked.data[0].score >= ranked.data[ranked.data.length - 1].score, "首条得分不低于末条");
const dali = ranked.data.find((r) => r.feed.title.includes("大理"))!;
assert(dali.breakdown.情境相关 >= 60, `大理攻略因行程临近获得情境加分（${dali.breakdown.情境相关}）`);
const bp = ranked.data.find((r) => r.feed.title.includes("高血压"))!;
assert(bp.breakdown.情境相关 >= 60, `高血压内容因家人病史获得加分（${bp.breakdown.情境相关}）`);
assert(new Set(ranked.data.slice(0, 3).map((r) => r.category)).size >= 3, "前三条类目不重复（多样性重排生效）");

console.log("\n===== 3. 穿搭推荐 =====");
const outfits = recommendOutfitsLocal(mockWardrobeItems, {
  temperature: 32, weather: "晴", occasion: "casual", date: NOW, recentOutfits: mockOutfits,
}, 3);
outfits.data.forEach((c, i) => {
  console.log(`  ${i + 1}. [${c.score}] ${c.items.map((x) => x.name).join(" + ")}`);
  console.log(`     ${c.note}`);
  if (c.warnings.length) console.log(`     ⚠ ${c.warnings.join("；")}`);
});
assert(outfits.data.length > 0, "32°C 夏季能生成推荐");
assert(outfits.data[0].items.some((i) => i.type === "top") && outfits.data[0].items.some((i) => i.type === "bottom") && outfits.data[0].items.some((i) => i.type === "shoes"), "夏季槽位 = 上衣+下装+鞋");
assert(!outfits.data[0].items.some((i) => i.type === "outerwear"), "32°C 不应推荐外套");
const winter = recommendOutfitsLocal(mockWardrobeItems, { temperature: 3, occasion: "work", date: new Date("2026-01-10") }, 2);
console.log(`  冬季通勤 3°C → ${winter.data[0]?.items.map((x) => x.name).join(" + ") ?? "无"}`);
assert(Boolean(winter.data[0]?.items.some((i) => i.type === "outerwear")), "3°C 应包含外套");

console.log("\n===== 4. 理财分析 =====");
console.log("  自动分类：");
for (const r of mockFinanceRecords.filter((r) => r.type === "expense")) {
  const g = categorizeTransaction(r.description, r.amount);
  console.log(`    ${r.description.padEnd(10)} → ${g.category} (现:${r.category}) conf=${g.confidence.toFixed(2)}`);
}
const fin = analyzeFinance(mockFinanceRecords, mockSavingsGoals, { monthlyBudget: 10000, now: NOW });
const f = fin.data;
console.log(`  周期 ${f.period}｜收入 ${f.totals.income} 支出 ${f.totals.expense} 结余 ${f.totals.net} 储蓄率 ${(f.totals.savingsRate * 100).toFixed(1)}%`);
console.log(`  健康分 ${f.healthScore}｜预算风险 ${f.budget.risk}｜月末预测 ¥${f.budget.projected}`);
console.log(`  类目：${f.byCategory.map((c) => `${c.label} ${c.amount}(${c.pct.toFixed(0)}%)`).join(" / ")}`);
f.recommendations.forEach((r) => console.log(`    ${r.icon} [${r.severity}] ${r.title} — ${r.detail}`));
assert(f.totals.expense === 4588, `2026-08 支出合计 = 4588（实得 ${f.totals.expense}）—— 注意现有 FinancePage 是把所有月份混加成 4677`);
assert(f.totals.incomeIsEstimated && f.totals.income === 30000, "本期无收入记录 → 按历史月均 30000 估算");
assert(f.budget.projectionConfidence === "low", "8月2日只过了 2 天 → 预测置信度 low");
assert(f.budget.projected < 20000, `月末预测已剔除刚性支出的重复外推（实得 ¥${f.budget.projected}）`);
assert(f.byCategory[0].category === "housing", "住房是最大支出类目");
assert(f.rigidSplit.fixed >= 3800, "房贷被划入刚性支出");
assert(f.goals.length === 2 && f.goals[0].monthlyNeed > 0, "储蓄目标已测算每月应存");
assert(f.healthScore >= 0 && f.healthScore <= 100, "健康分在 0~100");

console.log("\n===== 5. 孩子成长 =====");
const before = JSON.stringify(mockGrowthRecords);
const growth = analyzeGrowth(mockGrowthRecords, mockFamilyMembers.find((m) => m.role === "child"));
const g = growth.data;
console.log(`  ${g.headline}`);
g.sections.forEach((s) => console.log(`    【${s.title}】${s.text}`));
g.suggestions.forEach((s) => console.log(`    · ${s}`));
assert(before === JSON.stringify(mockGrowthRecords), "未就地修改入参数组（原组件 reverse() 的坑）");
assert(g.metrics[0].delta === 2, `身高变化 +2cm（实得 ${g.metrics[0].delta}）`);
assert(g.metrics[0].velocity !== null && g.metrics[0].velocity > 10, `年化生长速度已计算（${g.metrics[0].velocity} cm/年）`);
const piano = g.subjects.find((s) => s.subject === "钢琴")!;
assert(piano.scale === "level", "钢琴 3 被识别为等级制而非百分制");
assert(g.subjects.find((s) => s.subject === "数学")!.delta === 3, "数学 +3 分");
assert(g.disclaimer.includes("不构成医学"), "免责声明存在");
assert(!JSON.stringify(g).match(/正常|异常|偏矮|超重/), "文案未出现诊断性词汇");

console.log("\n===== 6. 旅行攻略 =====");
const travel = generateTravelLocal({
  destination: "大理",
  startDate: "2026-08-14",
  endDate: "2026-08-18",
  travelers: mockFamilyMembers,
  budget: 15000,
  pace: "balanced",
});
const t = travel.data;
console.log(`  ${t.destination} ${t.days} 天`);
t.itinerary.days.forEach((d) => console.log(`    D${d.day} ${d.title}（${d.area ?? "-"}）：${d.activities.join("、")}`));
console.log(`  提示：${t.itinerary.tips.join("；")}`);
console.log(`  清单：证件${t.checklist.documents.length} 衣物${t.checklist.clothing.length} 儿童${t.checklist.kids.length} 其他${t.checklist.other.length}`);
console.log(`  预算：${t.budgetBreakdown?.map((b) => `${b.label}¥${b.amount}`).join(" / ")}｜人均每天 ¥${t.perPersonPerDay}`);
if (t.warnings.length) console.log(`  ⚠ ${t.warnings.join("；")}`);
assert(t.days === 5, `天数 = 5（实得 ${t.days}）`);
assert(t.itinerary.days.length === 5, "生成 5 天行程");
assert(t.itinerary.days[0].activities[0].includes("抵达"), "D1 含抵达缓冲");
assert(t.itinerary.days[4].activities.some((a) => a.includes("返程")), "末日含返程");
assert(t.checklist.kids.length > 0, "有 7 岁孩子 → 生成儿童清单");
assert(t.checklist.other.some((i) => i.name.includes("长辈")), "有 68 岁长辈 → 生成长辈用药项");
assert(!t.itinerary.days.some((d) => d.activities.some((a) => a.includes("洗马潭"))), "高强度徒步已因长辈同行被过滤");

// 与 UI 渲染契约的结构一致性
const plan = toTravelPlan(t, { destination: "大理", startDate: "2026-08-14", endDate: "2026-08-18" }, "u1");
const it = plan.itinerary as { days: { day: number; title: string; activities: string[] }[] };
const cl = plan.checklist as Record<string, { name: string; done: boolean }[]>;
assert(Array.isArray(it.days) && typeof it.days[0].day === "number" && Array.isArray(it.days[0].activities),
  "itinerary 结构与 TravelPlan.tsx 渲染契约一致（days[].day/title/activities[]）");
assert(["documents", "clothing", "kids", "other"].every((k) => Array.isArray(cl[k]) && (cl[k].length === 0 || typeof cl[k][0].done === "boolean")),
  "checklist 结构与 TravelPlan.tsx 渲染契约一致（分组 → {name,done}[]）");
console.log(`  清单完成度：${checklistProgress(t.checklist).pct}%`);

console.log("\n===== 7. AI 主动建议聚合 =====");
const sugg = buildSuggestions({
  finance: fin.data,
  growth: growth.data,
  travel: { draft: t, startDate: "2026-08-14" },
  alerts: mockAlerts,
  checkins: { habits: mockHabits, records: mockCheckins },
  now: NOW,
});
sugg.forEach((s) => console.log(`  ${s.icon} [${s.severity}] ${s.title} — ${s.detail}${s.impact ? ` (${s.impact.value}${s.impact.unit})` : ""}`));
assert(sugg.length > 0 && sugg.length <= 6, `建议数量在 1~6 条（实得 ${sugg.length}）`);
assert(sugg[0].severity === "urgent", `最紧急的排第一（实得 ${sugg[0].severity}）`);
assert(sugg.some((s) => s.id.startsWith("alert-")), "未处理的关键预警被纳入");
assert(sugg.some((s) => s.id === "travel-checklist"), "行前清单未完成被纳入");
assert(new Set(sugg.map((s) => s.id)).size === sugg.length, "建议 id 无重复");
assert(buildSuggestions({}).length === 0, "无任何数据源时不编造建议");

console.log("\n===== 收件箱 mock 回归（现有数据能否被正确重分类）=====");
for (const item of mockInboxItems) {
  const r = parseIntentLocal(item.content, NOW).data;
  const flag = r.category === item.category ? "✓" : "≠";
  console.log(`  ${flag} ${item.content.slice(0, 24)} → ${r.category} (mock: ${item.category})`);
}


// ===== 8. 空值兜底（接真实数据库后才会遇到的形状）=====
console.log("\n===== 8. itinerary / checklist 空值兜底 =====");
{
  const bad: unknown[] = [null, undefined, {}, { days: null }, { documents: null }, "not-an-object", 42,
    { days: [{ title: "缺 day 和 activities" }] },
    { documents: [{ name: "有名字" }, { done: true }, null] }];
  let crashed = 0;
  for (const b of bad) {
    try { checklistProgress(b); normalizeItinerary(b); normalizeChecklist(b); }
    catch { crashed++; console.error("   ✗ 崩在:", JSON.stringify(b)); }
  }
  assert(crashed === 0, `9 种畸形输入全部不崩（实际崩 ${crashed} 次）`);
  assert(checklistProgress(null).pct === 0, "null 清单进度为 0");
  assert(normalizeItinerary(null).days.length === 0, "null 行程返回空数组");
  const partial = normalizeChecklist({ documents: [{ name: "身份证", done: true }, { done: false }] });
  assert(partial.documents.length === 1 && partial.clothing.length === 0,
    "残缺分组被补全、无名条目被丢弃");
  assert(normalizeItinerary({ days: [{ title: "x" }] }).days[0].day === 1, "缺 day 字段时按序号补");
}

console.log("\n===== 9. 挑「即将出行」而不是撞运气 =====");
{
  const ps = [
    { start_date: "2026-01-01", end_date: "2026-01-05" },
    { start_date: "2026-09-10", end_date: "2026-09-15" },
    { start_date: "2026-08-14", end_date: "2026-08-18" },
  ];
  assert(pickUpcomingTrip(ps, NOW)?.start_date === "2026-08-14", "取最近的一次未来行程");
  const past = [{ start_date: "2025-01-01", end_date: "2025-01-05" }, { start_date: "2026-01-01", end_date: "2026-01-05" }];
  assert(pickUpcomingTrip(past, NOW)?.start_date === "2026-01-01", "全是过去行程时取最近结束的");
  assert(pickUpcomingTrip([], NOW) === undefined, "空列表返回 undefined 而不是崩");
  const ongoing = [{ start_date: "2026-08-01", end_date: "2026-08-10" }];
  assert(pickUpcomingTrip(ongoing, NOW)?.start_date === "2026-08-01", "进行中的行程算未来");
}

console.log("\n===== 10. 工作驾驶舱 =====");
{
  const mk = (o: Partial<AgentOutput>): AgentOutput => ({
    id: Math.random().toString(36).slice(2), user_id: "u1", kind: "brief", source: "email",
    title: "t", severity: "info", status: "new", created_at: "2026-08-04T08:00:00Z",
    updated_at: "2026-08-04T08:00:00Z", ...o,
  } as AgentOutput);

  const rows: AgentOutput[] = [
    mk({ kind: "approval", source: "oa", title: "报销审批 - 李明", severity: "urgent", occurred_at: "2026-08-04T09:00:00Z",
         detail: { applicant: "李明", amount: 2800, due_date: "2026-08-05", ai_suggestion: "建议通过", ai_concerns: ["发票日期差2天"] } }),
    mk({ kind: "approval", source: "oa", title: "采购审批 - 王芳", severity: "attention", occurred_at: "2026-08-04T08:00:00Z", detail: { applicant: "王芳", amount: 15000 } }),
    mk({ kind: "message", source: "feishu", title: "产线群有人@你", severity: "urgent", occurred_at: "2026-08-04T10:00:00Z",
         detail: { chat_name: "产线智能化项目群", mentioned_me: true, unread_count: 12, key_points: ["3号线方案待确认"], needs_reply: true } }),
    mk({ kind: "brief", source: "email", title: "供应商合同续签", severity: "attention", occurred_at: "2026-08-04T07:00:00Z",
         detail: { from: "supplier@example.com", needs_reply: true, deadline: "2026-08-05", key_points: ["条款有变更"] } }),
    mk({ kind: "report", source: "bitable", title: "本周汇报进度", severity: "info", occurred_at: "2026-08-04T06:00:00Z",
         detail: { period: "2026-W32", completed_count: 5, total_count: 8, pending: [{ who: "王芳", what: "Q3报表", overdue_days: 2 }] } }),
    mk({ kind: "approval", source: "oa", title: "已处理的历史单", severity: "urgent", status: "done", occurred_at: "2026-08-03T09:00:00Z" }),
  ];

  const NOW_C = new Date("2026-08-04T12:00:00Z");
  const v = buildCockpit(rows, { now: NOW_C });
  console.log(`  ${v.headline}`);
  v.sections.forEach((sec) => console.log(`    ${sec.icon} ${sec.label}: ${sec.items.length} 条（${sec.urgentCount} 紧急）`));
  v.sections.flatMap((s) => s.items).slice(0, 3).forEach((o) => console.log(`      · ${o.title} — ${cardSubtitle(o)}`));

  assert(v.sections.length === 4, "四张卡都在");
  assert(v.urgentCount === 2, `紧急数=2，已处理的不计入（实得 ${v.urgentCount}）`);
  assert(v.sections[0].items[0].severity === "urgent", "每组内紧急排最前");
  assert(!v.sections.flatMap((s) => s.items).some((o) => o.status === "done"), "默认过滤已处理项");
  assert(buildCockpit(rows, { now: NOW_C, includeHandled: true }).urgentCount === 3, "includeHandled 后计入已处理");
  assert(v.headline.includes("2 件"), `顶部结论点出紧急件数（实得「${v.headline}」）`);
  assert(buildCockpit([], { now: NOW_C }).headline.includes("还没有数据"), "空表给出可操作提示而不是空白");
  assert(buildCockpit([], { now: NOW_C }).sections.length === 4, "空表仍返回四张卡（各自显示空态）");

  // 陈旧提醒
  const stale = buildCockpit([mk({ created_at: "2026-08-03T00:00:00Z" })], { now: NOW_C });
  assert(stale.isStale, "超过 12 小时未更新会标记 stale");
  assert(!buildCockpit(rows, { now: NOW_C }).isStale, "刚更新过不标记 stale");

  // detail 是 jsonb —— 重演旅行页那次崩溃的形状
  const junk: unknown[] = [null, undefined, {}, "字符串", 42, [], { pending: "不是数组" }, { key_points: [1, 2, null] }];
  let crashed = 0;
  for (const j of junk) {
    try { normalizeApproval(j); normalizeMessage(j); normalizeReport(j); normalizeBrief(j); cardSubtitle(mk({ kind: "approval", detail: j })); }
    catch { crashed++; console.error("   ✗ 崩在:", JSON.stringify(j)); }
  }
  assert(crashed === 0, `8 种畸形 detail 全部不崩（实际崩 ${crashed} 次）`);
  assert(normalizeReport({ pending: "不是数组" }).pending.length === 0, "pending 非数组时降级为空");
  assert(normalizeMessage(null).unreadCount === 0, "null detail 给出安全默认值");
}

console.log(`\n${failed === 0 ? "✅ 全部通过" : `❌ ${failed} 项失败`}\n`);
process.exit(failed === 0 ? 0 : 1);
