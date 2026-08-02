// ================================================================
// 任务 4：理财分析引擎
// ----------------------------------------------------------------
// 三个能力：
//   A. 自动分类  categorizeTransaction()  —— 描述文本 → ExpenseCategory
//   B. 结构分析  analyzeFinance()        —— 类目结构 / 趋势 / 异常 / 预测
//   C. 建议生成  规则版 + LLM 版（数字一律由本地算，模型只做归因与措辞）
//
// 刻意不做的事：不推荐任何理财产品、不预测收益、不给投资建议。
// ================================================================

import type { FinanceRecord, SavingsGoal, ExpenseCategory } from "@/types";
import { FINANCE_ADVICE } from "./prompts";
import { callAI } from "./client";
import { ok, clamp, clamp01, type EngineResult, type Recommendation } from "./types";

export const FINANCE_VERSION = "1.0.0";

// ---------------------------------------------------------------
// A. 自动分类
// ---------------------------------------------------------------
const CATEGORY_RULES: { cat: ExpenseCategory; w: number; re: RegExp }[] = [
  { cat: "housing", w: 5, re: /房贷|房租|物业|水费|电费|燃气|取暖|宽带|装修/ },
  { cat: "education", w: 5, re: /学费|培训|补习|网课|钢琴课|兴趣班|辅导|教材|书包|文具|课本/ },
  { cat: "health", w: 5, re: /医院|门诊|挂号|药|体检|疫苗|口腔|眼镜|保险/ },
  { cat: "transport", w: 4, re: /加油|油费|打车|滴滴|地铁|公交|高铁|机票|停车|过路|洗车|保养|充电/ },
  { cat: "food", w: 4, re: /外卖|午餐|晚餐|早餐|餐|饭|咖啡|奶茶|超市|水果|蔬菜|生鲜|零食|食材/ },
  { cat: "entertainment", w: 4, re: /电影|游戏|演出|门票|旅游|酒店|会员|视频|音乐|KTV|健身卡/ },
  { cat: "family", w: 3, re: /孝敬|赡养|红包|礼金|亲戚|家用/ },
  { cat: "shopping", w: 3, re: /衣|鞋|包|数码|手机|电脑|家电|日用|化妆|护肤|淘宝|京东|拼多多/ },
];

/** 家庭成员名字出现时，教育/健康类的判定更准 */
const CHILD_NAMES = ["朵朵"];

export interface CategoryGuess {
  category: ExpenseCategory;
  confidence: number;
  matched?: string;
}

export function categorizeTransaction(description: string, amount?: number): CategoryGuess {
  const text = description ?? "";
  const scores = new Map<ExpenseCategory, number>();
  let matched: string | undefined;

  for (const r of CATEGORY_RULES) {
    const m = text.match(r.re);
    if (m) {
      scores.set(r.cat, (scores.get(r.cat) ?? 0) + r.w);
      matched = matched ?? m[0];
    }
  }
  // 孩子相关的采购优先归教育而非购物
  if (CHILD_NAMES.some((n) => text.includes(n))) {
    if (scores.has("shopping") && /书包|文具|课本|校服|绘本/.test(text)) {
      scores.set("education", (scores.get("education") ?? 0) + 3);
    }
    scores.set("family", (scores.get("family") ?? 0) + 1);
  }
  // 大额且无强信号 → 更可能是住房/健康这类刚性支出，但不硬判，只降低置信度
  if (!scores.size) return { category: "other", confidence: 0.2 };

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [cat, score] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  const confidence = clamp01((score - second * 0.5) / 6);
  void amount;
  return { category: cat, confidence, matched };
}

/** 批量补全缺失/可疑分类，返回需要人工确认的条目 */
export function reclassify(records: FinanceRecord[]): { record: FinanceRecord; guess: CategoryGuess }[] {
  return records
    .filter((r) => r.type === "expense")
    .map((r) => ({ record: r, guess: categorizeTransaction(r.description, r.amount) }))
    .filter((x) => x.guess.category !== x.record.category && x.guess.confidence >= 0.5);
}

// ---------------------------------------------------------------
// 刚性 / 弹性划分：优化建议只能动弹性部分
// ---------------------------------------------------------------
const RIGIDITY: Record<ExpenseCategory, "fixed" | "semi" | "flexible"> = {
  housing: "fixed",
  health: "fixed",
  education: "fixed",
  family: "semi",
  transport: "semi",
  food: "semi",
  shopping: "flexible",
  entertainment: "flexible",
  other: "flexible",
};

export const CATEGORY_ZH: Record<ExpenseCategory, string> = {
  food: "餐饮", transport: "交通", shopping: "购物", housing: "住房",
  entertainment: "娱乐", health: "健康", education: "教育", family: "家庭", other: "其他",
};

// ---------------------------------------------------------------
// B. 结构分析
// ---------------------------------------------------------------
export interface CategoryStat {
  category: ExpenseCategory;
  label: string;
  amount: number;
  pct: number;
  count: number;
  avgTicket: number;
  rigidity: "fixed" | "semi" | "flexible";
  /** 与上一周期比的百分比变化，无对照期为 null */
  momChange: number | null;
}

export interface Anomaly {
  kind: "single_large" | "category_spike" | "new_category" | "fixed_change";
  category: ExpenseCategory;
  message: string;
  amount: number;
  severity: "urgent" | "attention" | "info";
}

export interface GoalProjection {
  goal: SavingsGoal;
  progress: number;
  remaining: number;
  /** 按截止日推算的每月应存 */
  monthlyNeed: number;
  monthsLeft: number | null;
  onTrack: boolean;
  /** 按当前结余速度推算的达成日期 */
  projectedDate: string | null;
}

export interface FinanceAnalysis {
  period: string;
  totals: { income: number; expense: number; net: number; savingsRate: number; /** 本期未记录收入、用历史均值估算时为 true */ incomeIsEstimated: boolean };
  byCategory: CategoryStat[];
  rigidSplit: { fixed: number; semi: number; flexible: number };
  monthly: { month: string; income: number; expense: number; net: number }[];
  /** 支出线性回归斜率（元/月），正数=在涨 */
  expenseTrend: { slope: number; direction: "up" | "down" | "stable" };
  anomalies: Anomaly[];
  budget: {
    limit: number | null;
    used: number;
    usedPct: number | null;
    /** 月末总支出预测：刚性支出按已发生计，弹性支出按日均外推 */
    projected: number;
    /** 当月数据太少时预测不可靠，UI 应弱化展示 */
    projectionConfidence: "low" | "medium" | "high";
    risk: "safe" | "watch" | "over";
  };
  goals: GoalProjection[];
  /** 0~100 财务健康分 */
  healthScore: number;
  recommendations: Recommendation[];
}

export interface AnalyzeOptions {
  monthlyBudget?: number;
  /** 分析所属月份，默认取记录中最新月份 */
  month?: string; // YYYY-MM
  now?: Date;
}

const monthOf = (d: string) => (d ?? "").slice(0, 7);

function linearSlope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (ys[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function analyzeFinance(
  records: FinanceRecord[],
  goals: SavingsGoal[] = [],
  opts: AnalyzeOptions = {}
): EngineResult<FinanceAnalysis> {
  const now = opts.now ?? new Date();
  const months = Array.from(new Set(records.map((r) => monthOf(r.date)).filter(Boolean))).sort();
  const period = opts.month ?? months[months.length - 1] ?? now.toISOString().slice(0, 7);
  const prevPeriod = months[months.indexOf(period) - 1] ?? null;

  const inPeriod = records.filter((r) => monthOf(r.date) === period);
  const prev = prevPeriod ? records.filter((r) => monthOf(r.date) === prevPeriod) : [];

  const expenses = inPeriod.filter((r) => r.type === "expense");
  const incomes = inPeriod.filter((r) => r.type === "income");
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);
  const rawIncome = incomes.reduce((s, r) => s + r.amount, 0);

  // 工资常跨月入账（如 7/31 发 7 月工资），本期无收入记录时用历史月均兜底，
  // 否则储蓄率会被算成 0，健康分失真。
  const historicalIncomes = months
    .filter((m) => m !== period)
    .map((m) => records.filter((r) => r.type === "income" && monthOf(r.date) === m).reduce((s, r) => s + r.amount, 0))
    .filter((v) => v > 0);
  const incomeIsEstimated = rawIncome === 0 && historicalIncomes.length > 0;
  const totalIncome = incomeIsEstimated
    ? Math.round(historicalIncomes.reduce((a, b) => a + b, 0) / historicalIncomes.length)
    : rawIncome;
  const net = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? net / totalIncome : 0;

  // —— 类目结构 ——
  const prevByCat = new Map<ExpenseCategory, number>();
  for (const r of prev.filter((x) => x.type === "expense")) {
    prevByCat.set(r.category, (prevByCat.get(r.category) ?? 0) + r.amount);
  }
  const catMap = new Map<ExpenseCategory, FinanceRecord[]>();
  for (const r of expenses) {
    const arr = catMap.get(r.category) ?? [];
    arr.push(r);
    catMap.set(r.category, arr);
  }
  const byCategory: CategoryStat[] = [...catMap.entries()]
    .map(([category, rs]) => {
      const amount = rs.reduce((s, r) => s + r.amount, 0);
      const before = prevByCat.get(category);
      return {
        category,
        label: CATEGORY_ZH[category],
        amount,
        pct: totalExpense ? (amount / totalExpense) * 100 : 0,
        count: rs.length,
        avgTicket: amount / rs.length,
        rigidity: RIGIDITY[category],
        momChange: before && before > 0 ? ((amount - before) / before) * 100 : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const rigidSplit = { fixed: 0, semi: 0, flexible: 0 };
  for (const c of byCategory) rigidSplit[c.rigidity] += c.amount;

  // —— 月度序列与趋势 ——
  const monthly = months.map((m) => {
    const rs = records.filter((r) => monthOf(r.date) === m);
    const e = rs.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
    const i = rs.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
    return { month: m, income: i, expense: e, net: i - e };
  });
  const slope = linearSlope(monthly.map((m) => m.expense));
  const expenseTrend = {
    slope: Math.round(slope),
    direction: (Math.abs(slope) < Math.max(200, totalExpense * 0.03) ? "stable" : slope > 0 ? "up" : "down") as
      | "up"
      | "down"
      | "stable",
  };

  // —— 异常检测 ——
  const anomalies: Anomaly[] = [];
  const amountsByCat = new Map<ExpenseCategory, number[]>();
  for (const r of records.filter((x) => x.type === "expense")) {
    const arr = amountsByCat.get(r.category) ?? [];
    arr.push(r.amount);
    amountsByCat.set(r.category, arr);
  }
  for (const r of expenses) {
    const hist = (amountsByCat.get(r.category) ?? []).slice().sort((a, b) => a - b);
    const p90 = quantile(hist, 0.9);
    if (hist.length >= 4 && p90 > 0 && r.amount > p90 * 1.5) {
      anomalies.push({
        kind: "single_large",
        category: r.category,
        amount: r.amount,
        severity: "attention",
        message: `${CATEGORY_ZH[r.category]}出现大额单笔：${r.description} ¥${r.amount}，高于该类目常规水平`,
      });
    }
  }
  for (const c of byCategory) {
    if (c.momChange != null && c.momChange >= 50 && c.amount >= totalExpense * 0.08) {
      anomalies.push({
        kind: c.rigidity === "fixed" ? "fixed_change" : "category_spike",
        category: c.category,
        amount: c.amount,
        severity: c.momChange >= 100 ? "urgent" : "attention",
        message: `${c.label}环比上升 ${c.momChange.toFixed(0)}%，达 ¥${c.amount.toLocaleString()}`,
      });
    }
    if (c.momChange === null && prevPeriod && !prevByCat.has(c.category) && c.amount >= totalExpense * 0.1) {
      anomalies.push({
        kind: "new_category",
        category: c.category,
        amount: c.amount,
        severity: "info",
        message: `本期新增${c.label}支出 ¥${c.amount.toLocaleString()}`,
      });
    }
  }

  // —— 预算与外推 ——
  const [py, pm] = period.split("-").map(Number);
  const daysInMonth = new Date(py, pm, 0).getDate();
  const isCurrentMonth = period === now.toISOString().slice(0, 7);
  const dayCursor = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
  // 月末预测：房贷/学费这类刚性支出通常月初一次性入账，
  // 直接用「总支出 / 已过天数 × 当月天数」会把它们乘以 15 倍，得出荒谬数字。
  // 因此拆开：刚性按已发生额计入，只对弹性/半弹性部分做日均外推。
  const fixedSoFar = expenses.filter((r) => RIGIDITY[r.category] === "fixed").reduce((s, r) => s + r.amount, 0);
  const variableSoFar = totalExpense - fixedSoFar;
  const variableDaily = variableSoFar / dayCursor;
  const projected = Math.round(fixedSoFar + variableDaily * daysInMonth);
  const projectionConfidence: "low" | "medium" | "high" =
    !isCurrentMonth ? "high" : dayCursor >= 14 ? "high" : dayCursor >= 7 ? "medium" : "low";

  const limit = opts.monthlyBudget ?? null;
  const usedPct = limit ? (totalExpense / limit) * 100 : null;
  const risk: "safe" | "watch" | "over" = !limit
    ? "safe"
    : projectionConfidence === "low"
      // 数据太少时不下超支结论，只看已发生额是否已经越线
      ? (totalExpense > limit ? "over" : "safe")
      : projected > limit
        ? "over"
        : projected > limit * 0.9
          ? "watch"
          : "safe";

  // —— 储蓄目标 ——
  const monthlyNet = monthly.length ? monthly.reduce((s, m) => s + m.net, 0) / monthly.length : net;
  const goalProjections: GoalProjection[] = goals.map((g) => {
    const remaining = Math.max(0, g.target_amount - g.current_amount);
    const progress = g.target_amount > 0 ? g.current_amount / g.target_amount : 0;
    let monthsLeft: number | null = null;
    if (g.deadline) {
      const dl = new Date(g.deadline);
      monthsLeft = Math.max(0, (dl.getFullYear() - now.getFullYear()) * 12 + (dl.getMonth() - now.getMonth()));
    }
    const monthlyNeed = monthsLeft && monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
    const onTrack = remaining === 0 || (monthlyNet > 0 && monthlyNeed <= monthlyNet);
    let projectedDate: string | null = null;
    if (remaining > 0 && monthlyNet > 0) {
      const m = Math.ceil(remaining / monthlyNet);
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
      projectedDate = d.toISOString().slice(0, 7);
    }
    return { goal: g, progress, remaining, monthlyNeed, monthsLeft, onTrack, projectedDate };
  });

  // —— 健康分 ——
  // 用「近 90 天滚动窗口」而不是当月：月初只过了两天时，
  // 当月数据里只有房贷、没有日常开销，算出来的储蓄率和刚性占比都是假的。
  const windowStart = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const win = records.filter((r) => r.date >= windowStart);
  const winExpense = win.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0) || totalExpense;
  const winIncome = win.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0) || totalIncome;
  const winFixed = win
    .filter((r) => r.type === "expense" && RIGIDITY[r.category] === "fixed")
    .reduce((s, r) => s + r.amount, 0);
  const winMonths = Math.max(1, new Set(win.map((r) => monthOf(r.date))).size);

  // 储蓄率 40 + 预算遵守 30 + 刚性占比 20 + 目标进度 10
  const winSavingsRate = winIncome > 0 ? (winIncome - winExpense) / winIncome : savingsRate;
  const sScore = clamp((winSavingsRate / 0.3) * 40, 0, 40); // 30% 储蓄率满分
  const avgMonthlyExpense = winExpense / winMonths;
  const bScore = limit ? clamp(40 - ((avgMonthlyExpense / limit) * 40 - 10), 0, 30) : 21;
  const fixedRatio = winExpense ? winFixed / winExpense : 0;
  const rScore = clamp(20 - Math.max(0, fixedRatio - 0.5) * 40, 0, 20); // 刚性超 50% 开始扣分
  const gScore = goalProjections.length
    ? clamp((goalProjections.reduce((s, g) => s + g.progress, 0) / goalProjections.length) * 10, 0, 10)
    : 6;
  const healthScore = Math.round(sScore + bScore + rScore + gScore);

  // —— 规则版建议 ——
  const recommendations = buildRecommendations({
    byCategory, anomalies, savingsRate, projected, limit, risk, goalProjections, expenseTrend, totalExpense,
    projectionConfidence,
  });

  const reasons = [
    `周期 ${period}：收入 ¥${totalIncome.toLocaleString()}，支出 ¥${totalExpense.toLocaleString()}，储蓄率 ${(savingsRate * 100).toFixed(1)}%`,
    `近 90 天刚性支出占比 ${(fixedRatio * 100).toFixed(0)}%，本期弹性支出 ¥${rigidSplit.flexible.toLocaleString()}`,
  ];
  if (incomeIsEstimated) reasons.push(`本期未记录收入，已按历史月均 ¥${totalIncome.toLocaleString()} 估算储蓄率`);
  if (isCurrentMonth) {
    reasons.push(
      `已过 ${dayCursor}/${daysInMonth} 天，月末预计 ¥${projected.toLocaleString()}` +
        (projectionConfidence === "low" ? "（样本天数不足，仅供参考）" : "")
    );
  }
  if (anomalies.length) reasons.push(`检测到 ${anomalies.length} 处异常`);

  return ok<FinanceAnalysis>(
    {
      period,
      totals: { income: totalIncome, expense: totalExpense, net, savingsRate, incomeIsEstimated },
      byCategory,
      rigidSplit,
      monthly,
      expenseTrend,
      anomalies,
      budget: { limit, used: totalExpense, usedPct, projected, projectionConfidence, risk },
      goals: goalProjections,
      healthScore,
      recommendations,
    },
    { version: FINANCE_VERSION, confidence: records.length >= 10 ? 0.8 : 0.5, reasons, source: "local" }
  );
}

function buildRecommendations(x: {
  byCategory: CategoryStat[];
  anomalies: Anomaly[];
  savingsRate: number;
  projected: number;
  limit: number | null;
  risk: "safe" | "watch" | "over";
  goalProjections: GoalProjection[];
  expenseTrend: { slope: number; direction: string };
  totalExpense: number;
  projectionConfidence: "low" | "medium" | "high";
}): Recommendation[] {
  const out: Recommendation[] = [];

  if (x.limit && x.risk === "over") {
    out.push({
      id: "budget-over",
      icon: "⚠️",
      title: x.projectionConfidence === "low" ? "已接近或超出月预算" : "预算大概率超支",
      detail:
        x.projectionConfidence === "low"
          ? `本月已支出 ¥${x.totalExpense.toLocaleString()}，预算 ¥${x.limit.toLocaleString()}`
          : `按当前速度月末约 ¥${x.projected.toLocaleString()}，超出预算 ¥${(x.projected - x.limit).toLocaleString()}`,
      action: "查看弹性支出",
      severity: "urgent",
      impact: { value: x.projected - x.limit, unit: "元" },
    });
  }

  const flex = x.byCategory.filter((c) => c.rigidity === "flexible").sort((a, b) => b.amount - a.amount);
  if (flex.length && flex[0].amount > x.totalExpense * 0.15) {
    const cut = Math.round(flex[0].amount * 0.2);
    out.push({
      id: `cut-${flex[0].category}`,
      icon: "✂️",
      title: `${flex[0].label}是最大的弹性支出`,
      detail: `占总支出 ${flex[0].pct.toFixed(0)}%，压缩两成即可每月省下约 ¥${cut.toLocaleString()}`,
      action: "设类目上限",
      severity: "attention",
      impact: { value: cut, unit: "元/月" },
    });
  }

  for (const a of x.anomalies.slice(0, 2)) {
    out.push({
      id: `anomaly-${a.kind}-${a.category}`,
      icon: a.severity === "urgent" ? "🚨" : "🔍",
      title: "支出异常",
      detail: a.message,
      action: "核对明细",
      severity: a.severity,
    });
  }

  if (x.savingsRate < 0.1) {
    out.push({
      id: "low-savings",
      icon: "💧",
      title: "储蓄率偏低",
      detail: `本期储蓄率仅 ${(x.savingsRate * 100).toFixed(1)}%，建议先固定存下收入的 10% 再安排消费`,
      action: "设自动储蓄",
      severity: "attention",
    });
  }

  for (const g of x.goalProjections.filter((g) => !g.onTrack && g.remaining > 0)) {
    out.push({
      id: `goal-${g.goal.id}`,
      icon: "🎯",
      title: `「${g.goal.name}」进度落后`,
      detail: g.monthsLeft
        ? `还差 ¥${g.remaining.toLocaleString()}，距截止 ${g.monthsLeft} 个月，需每月存 ¥${g.monthlyNeed.toLocaleString()}`
        : `还差 ¥${g.remaining.toLocaleString()}${g.projectedDate ? `，按当前结余速度约 ${g.projectedDate} 达成` : ""}`,
      action: "调整目标或增加投入",
      severity: "attention",
      impact: { value: g.monthlyNeed, unit: "元/月" },
    });
  }

  if (x.expenseTrend.direction === "up") {
    out.push({
      id: "trend-up",
      icon: "📈",
      title: "支出呈上升趋势",
      detail: `近几个月支出平均每月增加约 ¥${Math.abs(x.expenseTrend.slope).toLocaleString()}`,
      action: "查看趋势",
      severity: "info",
    });
  }

  return out.slice(0, 5);
}

// ---------------------------------------------------------------
// C. LLM 增强建议（数字来自本地分析，模型只做归因与措辞）
// ---------------------------------------------------------------
interface FinanceAdviceResult {
  headline: string;
  findings: string[];
  advices: { title: string; detail: string; monthlySaving: number | null; severity: "urgent" | "attention" | "info" }[];
  goalNote: string;
}

export async function analyzeFinanceWithAI(
  records: FinanceRecord[],
  goals: SavingsGoal[] = [],
  opts: AnalyzeOptions = {}
): Promise<EngineResult<FinanceAnalysis & { headline?: string; findings?: string[]; goalNote?: string }>> {
  const local = analyzeFinance(records, goals, opts);
  const a = local.data;

  const env = await callAI<Parameters<typeof FINANCE_ADVICE.build>[0], FinanceAdviceResult>(FINANCE_ADVICE, {
    period: a.period,
    totals: a.totals,
    topCategories: a.byCategory.slice(0, 5).map((c) => ({
      category: c.label, amount: c.amount, pct: c.pct, momChange: c.momChange,
    })),
    anomalies: a.anomalies.map((x) => x.message),
    goals: a.goals.map((g) => ({
      name: g.goal.name, progress: g.progress, monthlyNeed: g.monthlyNeed, onTrack: g.onTrack,
    })),
  });
  if (!env?.result) return { ...local, degraded: true };

  const aiRecs: Recommendation[] = (env.result.advices ?? []).slice(0, 4).map((ad, i) => ({
    id: `ai-${i}`,
    icon: "💡",
    title: ad.title,
    detail: ad.detail,
    action: "采纳",
    severity: ad.severity ?? "info",
    impact: ad.monthlySaving ? { value: ad.monthlySaving, unit: "元/月" } : undefined,
  }));

  return ok(
    {
      ...a,
      headline: env.result.headline,
      findings: env.result.findings,
      goalNote: env.result.goalNote,
      // 本地的硬性预警排前面，AI 建议补充在后
      recommendations: [...a.recommendations.filter((r) => r.severity === "urgent"), ...aiRecs, ...a.recommendations.filter((r) => r.severity !== "urgent")].slice(0, 6),
    },
    { version: FINANCE_VERSION, confidence: 0.85, reasons: [...local.reasons, ...env.reasoning.slice(0, 2)], source: "hybrid" }
  );
}
