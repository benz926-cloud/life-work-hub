// ================================================================
// 任务 5：孩子成长 AI 分析
// ----------------------------------------------------------------
// 输出「趋势描述 + 参考区间对照 + 家长可执行建议」，不做任何医学判断。
//
// ⚠️ 合规边界（写死在引擎里，LLM 也被 Prompt 约束）：
//   - 参考区间仅用于"位置感知"，措辞一律是「处于参考区间的哪一段」，
//     绝不出现"正常/异常/偏矮/超重/需要治疗"这类结论。
//   - 视力只描述变化幅度，提示复查，不判断近视与否。
//   - 学业只描述变化与练习建议，不做能力评价、不贴标签。
// ================================================================

import type { ChildGrowthRecord, FamilyMember } from "@/types";
import { CHILD_GROWTH_REPORT } from "./prompts";
import { callAI } from "./client";
import { ok, clamp01, type EngineResult } from "./types";

export const GROWTH_VERSION = "1.0.0";

export const GROWTH_DISCLAIMER =
  "以上仅为记录数据的趋势整理与区间对照，不构成医学或教育评估。身高、体重、视力请以儿保科/眼科体检结果为准。";

// ---------------------------------------------------------------
// 参考区间（粗略，用于"位置感知"，不用于诊断）
// 数据量级参考我国学龄儿童体格发育公开资料，按 P3 / P50 / P97 三档给出。
// 需要更精细时应替换为完整 LMS 表。
// ---------------------------------------------------------------
interface RefBand { p3: number; p50: number; p97: number }

const HEIGHT_REF: Record<number, RefBand> = {
  6: { p3: 106, p50: 118, p97: 130 },
  7: { p3: 111, p50: 124, p97: 137 },
  8: { p3: 116, p50: 130, p97: 143 },
  9: { p3: 121, p50: 135, p97: 149 },
  10: { p3: 126, p50: 140, p97: 156 },
};
const WEIGHT_REF: Record<number, RefBand> = {
  6: { p3: 16, p50: 21, p97: 30 },
  7: { p3: 18, p50: 24, p97: 35 },
  8: { p3: 20, p50: 27, p97: 40 },
  9: { p3: 22, p50: 30, p97: 46 },
  10: { p3: 24, p50: 34, p97: 53 },
};

/** 返回「靠近区间下段 / 中段 / 上段」这类中性描述 */
function bandPosition(value: number, band?: RefBand): string | null {
  if (!band) return null;
  if (value < band.p3) return "低于常见参考区间";
  if (value > band.p97) return "高于常见参考区间";
  if (value < band.p50 - (band.p50 - band.p3) * 0.33) return "处于参考区间偏下段";
  if (value > band.p50 + (band.p97 - band.p50) * 0.33) return "处于参考区间偏上段";
  return "处于参考区间中段";
}

// ---------------------------------------------------------------
// 类型
// ---------------------------------------------------------------
export interface MetricTrend {
  key: "height" | "weight" | "bmi";
  label: string;
  latest: number | null;
  previous: number | null;
  delta: number | null;
  /** 年化速度，如 cm/年 */
  velocity: number | null;
  unit: string;
  bandNote: string | null;
}

export interface SubjectTrend {
  subject: string;
  latest: number;
  previous: number | null;
  delta: number | null;
  /** 百分制 or 等级制（钢琴 3 级这种） */
  scale: "percent" | "level";
  /** 相对孩子自身平均水平的位置 */
  relative: "above_self" | "near_self" | "below_self";
}

export interface VisionTrend {
  left: number | null;
  right: number | null;
  leftDelta: number | null;
  rightDelta: number | null;
  needsRecheck: boolean;
}

export interface GrowthReport {
  childName: string;
  age: number | null;
  spanDays: number | null;
  metrics: MetricTrend[];
  vision: VisionTrend | null;
  subjects: SubjectTrend[];
  newMilestones: string[];
  headline: string;
  sections: { title: string; text: string }[];
  suggestions: string[];
  disclaimer: string;
}

// ---------------------------------------------------------------
// 主分析
// ---------------------------------------------------------------
export function analyzeGrowth(
  records: ChildGrowthRecord[],
  child?: FamilyMember
): EngineResult<GrowthReport> {
  // 不修改入参（原组件里出现过 .reverse() 就地反转的坑）
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const name = child?.name ?? "孩子";
  const age = child?.age ?? null;

  if (!latest) {
    return ok<GrowthReport>(
      {
        childName: name, age, spanDays: null, metrics: [], vision: null, subjects: [],
        newMilestones: [], headline: "还没有成长记录", sections: [],
        suggestions: ["先补一条身高体重记录，后续才能看到趋势"], disclaimer: GROWTH_DISCLAIMER,
      },
      { version: GROWTH_VERSION, confidence: 0.1, reasons: ["无数据"], source: "local" }
    );
  }

  const spanDays = prev
    ? Math.round((new Date(latest.date).getTime() - new Date(prev.date).getTime()) / 86400000)
    : null;
  const yearFraction = spanDays ? spanDays / 365 : null;

  // —— 体格 ——
  const mk = (
    key: MetricTrend["key"], label: string, unit: string,
    cur: number | null | undefined, before: number | null | undefined, band?: RefBand
  ): MetricTrend => {
    const latestV = cur ?? null;
    const prevV = before ?? null;
    const delta = latestV != null && prevV != null ? +(latestV - prevV).toFixed(1) : null;
    const velocity = delta != null && yearFraction ? +(delta / yearFraction).toFixed(1) : null;
    return { key, label, latest: latestV, previous: prevV, delta, velocity, unit, bandNote: latestV != null ? bandPosition(latestV, band) : null };
  };

  const heightBand = age != null ? HEIGHT_REF[age] : undefined;
  const weightBand = age != null ? WEIGHT_REF[age] : undefined;
  const bmi = (r?: ChildGrowthRecord) =>
    r?.height_cm && r?.weight_kg ? +(r.weight_kg / (r.height_cm / 100) ** 2).toFixed(1) : null;

  const metrics: MetricTrend[] = [
    mk("height", "身高", "cm", latest.height_cm, prev?.height_cm, heightBand),
    mk("weight", "体重", "kg", latest.weight_kg, prev?.weight_kg, weightBand),
    mk("bmi", "BMI", "", bmi(latest), bmi(prev)),
  ];

  // —— 视力 ——
  let vision: VisionTrend | null = null;
  if (latest.vision_left != null || latest.vision_right != null) {
    const ld = latest.vision_left != null && prev?.vision_left != null ? +(latest.vision_left - prev.vision_left).toFixed(2) : null;
    const rd = latest.vision_right != null && prev?.vision_right != null ? +(latest.vision_right - prev.vision_right).toFixed(2) : null;
    vision = {
      left: latest.vision_left ?? null,
      right: latest.vision_right ?? null,
      leftDelta: ld,
      rightDelta: rd,
      // 任一眼下降 ≥0.1 或绝对值 <4.9 → 提示复查（只提示，不判断）
      needsRecheck:
        (ld != null && ld <= -0.1) || (rd != null && rd <= -0.1) ||
        (latest.vision_left != null && latest.vision_left < 4.9) ||
        (latest.vision_right != null && latest.vision_right < 4.9),
    };
  }

  // —— 学科 ——
  const curScores = latest.subject_scores ?? {};
  const prevScores = prev?.subject_scores ?? {};
  const percentValues = Object.values(curScores).filter((v) => v > 10);
  const selfMean = percentValues.length ? percentValues.reduce((a, b) => a + b, 0) / percentValues.length : null;

  const subjects: SubjectTrend[] = Object.entries(curScores).map(([subject, score]) => {
    // 「钢琴: 3」这种是考级等级，不能和百分制混在一起比
    const scale: "percent" | "level" = score <= 10 ? "level" : "percent";
    const before = prevScores[subject] ?? null;
    const delta = before != null ? +(score - before).toFixed(1) : null;
    let relative: SubjectTrend["relative"] = "near_self";
    if (scale === "percent" && selfMean != null) {
      if (score >= selfMean + 3) relative = "above_self";
      else if (score <= selfMean - 3) relative = "below_self";
    }
    return { subject, latest: score, previous: before, delta, scale, relative };
  });

  // —— 里程碑 ——
  const oldMilestones = new Set(sorted.slice(0, -1).flatMap((r) => r.milestones ?? []));
  const newMilestones = (latest.milestones ?? []).filter((m) => !oldMilestones.has(m));

  // —— 文案 ——
  const sections: { title: string; text: string }[] = [];
  const h = metrics[0];
  const w = metrics[1];
  if (h.latest != null) {
    const parts = [`当前 ${h.latest}${h.unit}`];
    if (h.delta != null && spanDays) parts.push(`${spanDays} 天里长了 ${h.delta}cm`);
    if (h.velocity != null) parts.push(`折合年增长约 ${h.velocity}cm`);
    if (h.bandNote) parts.push(h.bandNote);
    sections.push({ title: "体格发育", text: parts.join("，") + "。" + (w.latest != null ? `体重 ${w.latest}kg${w.bandNote ? "，" + w.bandNote : ""}。` : "") });
  }
  if (vision) {
    const t = `左 ${vision.left ?? "—"} / 右 ${vision.right ?? "—"}` +
      (vision.leftDelta != null || vision.rightDelta != null
        ? `，较上次${vision.leftDelta != null ? ` 左眼${vision.leftDelta >= 0 ? "+" : ""}${vision.leftDelta}` : ""}${vision.rightDelta != null ? ` 右眼${vision.rightDelta >= 0 ? "+" : ""}${vision.rightDelta}` : ""}`
        : "") +
      (vision.needsRecheck ? "。建议安排一次眼科复查。" : "。保持现有用眼习惯即可。");
    sections.push({ title: "视力", text: t });
  }
  if (subjects.length) {
    const up = subjects.filter((s) => s.delta != null && s.delta > 0).map((s) => `${s.subject}+${s.delta}`);
    const down = subjects.filter((s) => s.delta != null && s.delta < 0).map((s) => `${s.subject}${s.delta}`);
    const levels = subjects.filter((s) => s.scale === "level").map((s) => `${s.subject}${s.latest}级`);
    const bits: string[] = [];
    if (up.length) bits.push(`进步：${up.join("、")}`);
    if (down.length) bits.push(`回落：${down.join("、")}`);
    if (levels.length) bits.push(`等级类：${levels.join("、")}`);
    if (!bits.length) bits.push("本期各科与上期持平");
    sections.push({ title: "学业", text: bits.join("；") + "。" });
  }
  if (newMilestones.length) {
    sections.push({ title: "兴趣与里程碑", text: `新达成：${newMilestones.join("、")}。` });
  }

  const suggestions: string[] = [];
  if (vision?.needsRecheck) suggestions.push("预约一次眼科检查，并记录每天户外活动时长");
  const down = subjects.filter((s) => s.scale === "percent" && s.delta != null && s.delta < -3);
  if (down.length) suggestions.push(`给${down[0].subject}安排每天 15 分钟的专项练习，两周后再看变化`);
  const levelSubj = subjects.find((s) => s.scale === "level");
  if (levelSubj) suggestions.push(`${levelSubj.subject}备考期建议固定每天练习时段并记录时长`);
  if (h.velocity != null && spanDays && spanDays >= 60) suggestions.push("保持每 2~3 个月量一次身高体重，趋势比单次数值更有意义");
  if (!suggestions.length) suggestions.push("继续保持当前记录频率，数据攒够后趋势会更清晰");

  const headline =
    h.delta != null && h.delta > 0
      ? `${name}近 ${spanDays} 天长高 ${h.delta}cm，各项记录稳定更新中`
      : `${name}的成长记录已更新至 ${latest.date}`;

  const confidence = clamp01(sorted.length >= 4 ? 0.8 : sorted.length >= 2 ? 0.55 : 0.3);
  const reasons = [
    `共 ${sorted.length} 条记录，跨度 ${spanDays ?? 0} 天`,
    sorted.length < 3 ? "记录点较少，趋势判断仅供参考" : "已按时间序列计算变化速度",
  ];

  return ok<GrowthReport>(
    { childName: name, age, spanDays, metrics, vision, subjects, newMilestones, headline, sections, suggestions, disclaimer: GROWTH_DISCLAIMER },
    { version: GROWTH_VERSION, confidence, reasons, source: "local" }
  );
}

// ---------------------------------------------------------------
// LLM 增强：把结构化指标写成家长易读的叙述
// ---------------------------------------------------------------
interface LLMGrowth {
  headline: string;
  sections: { title: string; text: string }[];
  suggestions: string[];
  disclaimer: string;
}

export async function analyzeGrowthWithAI(
  records: ChildGrowthRecord[],
  child?: FamilyMember
): Promise<EngineResult<GrowthReport>> {
  const local = analyzeGrowth(records, child);
  const d = local.data;
  if (!d.metrics.length) return local;

  const metricsText = d.metrics
    .filter((m) => m.latest != null)
    .map((m) => `${m.label} ${m.latest}${m.unit}${m.delta != null ? `（较上次${m.delta >= 0 ? "+" : ""}${m.delta}）` : ""}${m.bandNote ? `，${m.bandNote}` : ""}`)
    .join("；") + (d.vision ? `；视力 左${d.vision.left ?? "—"}/右${d.vision.right ?? "—"}${d.vision.needsRecheck ? "（建议复查）" : ""}` : "");

  const subjectsText = d.subjects
    .map((s) => `${s.subject} ${s.latest}${s.scale === "level" ? "级" : "分"}${s.delta != null ? `（${s.delta >= 0 ? "+" : ""}${s.delta}）` : ""}`)
    .join("；") || "无学科记录";

  const env = await callAI<Parameters<typeof CHILD_GROWTH_REPORT.build>[0], LLMGrowth>(CHILD_GROWTH_REPORT, {
    name: d.childName,
    age: d.age ?? 0,
    metrics: metricsText,
    subjects: subjectsText,
    milestones: d.newMilestones,
  });
  if (!env?.result) return { ...local, degraded: true };

  return ok<GrowthReport>(
    {
      ...d,
      headline: env.result.headline || d.headline,
      sections: env.result.sections?.length ? env.result.sections : d.sections,
      suggestions: env.result.suggestions?.length ? env.result.suggestions : d.suggestions,
      // 免责声明永远用我们自己的，不采用模型生成的版本
      disclaimer: GROWTH_DISCLAIMER,
    },
    { version: GROWTH_VERSION, confidence: local.confidence, reasons: [...local.reasons, ...env.reasoning.slice(0, 2)], source: "hybrid" }
  );
}
