// ================================================================
// AI 主动建议聚合器
// ----------------------------------------------------------------
// 「AI 主动建议」不该是一张数据库表——它是各引擎结论的汇总视图。
// 这里把理财、成长、旅行、预警、打卡五个来源产出的结论收敛成一个
// 排好序的 Recommendation[]，概览页直接渲染。
//
// 原则：只用真实存在的数据推导，不编造。没有数据的来源就不出建议，
// 宁可少几条，也不要凑数。
// ================================================================

import type { Alert, CheckinHabit, CheckinRecord } from "@/types";
import type { Recommendation } from "./types";
import type { FinanceAnalysis } from "./finance";
import type { GrowthReport } from "./growth";
import type { TravelDraft } from "./travel";
import { checklistProgress } from "./travel";

export const SUGGESTIONS_VERSION = "1.0.0";

export interface SuggestionInput {
  finance?: FinanceAnalysis;
  growth?: GrowthReport;
  travel?: { draft: TravelDraft; startDate: string };
  alerts?: Alert[];
  checkins?: { habits: CheckinHabit[]; records: CheckinRecord[] };
  now?: Date;
}

const RANK: Record<Recommendation["severity"], number> = { urgent: 0, attention: 1, info: 2 };

export function buildSuggestions(input: SuggestionInput): Recommendation[] {
  const now = input.now ?? new Date();
  const out: Recommendation[] = [];

  // —— 1. 未处理的关键预警：最该先看的东西 ——
  for (const a of (input.alerts ?? []).filter((x) => !x.resolved && x.level === "critical").slice(0, 2)) {
    out.push({
      id: `alert-${a.id}`,
      icon: "⚠️",
      title: a.title,
      detail: a.description,
      action: "查看详情",
      severity: "urgent",
    });
  }

  // —— 2. 理财：引擎已经产出 Recommendation，直接取前两条 ——
  for (const r of (input.finance?.recommendations ?? []).slice(0, 2)) {
    out.push({ ...r, id: `finance-${r.id}` });
  }

  // —— 3. 旅行：临近出发 + 清单未完成 ——
  if (input.travel) {
    const { draft, startDate } = input.travel;
    const daysUntil = Math.ceil((new Date(startDate).getTime() - now.getTime()) / 86400000);
    const p = checklistProgress(draft.checklist);
    const remaining = p.total - p.done;
    if (daysUntil >= 0 && daysUntil <= 30 && remaining > 0) {
      out.push({
        id: "travel-checklist",
        icon: "✈️",
        title: `${draft.destination}行前准备`,
        detail: `距出发还有 ${daysUntil} 天，行李清单还有 ${remaining} 项未完成`,
        action: "查看清单",
        // 三天内还没备齐就该催了
        severity: daysUntil <= 3 ? "urgent" : daysUntil <= 10 ? "attention" : "info",
        impact: { value: remaining, unit: "项" },
      });
    }
    for (const w of draft.warnings.slice(0, 1)) {
      out.push({ id: "travel-warning", icon: "🧭", title: "行程提醒", detail: w, action: "查看行程", severity: "info" });
    }
  }

  // —— 4. 孩子成长：视力复查优先，其余取第一条建议 ——
  if (input.growth) {
    if (input.growth.vision?.needsRecheck) {
      out.push({
        id: "growth-vision",
        icon: "👀",
        title: `${input.growth.childName}的视力记录有变化`,
        detail: "建议安排一次眼科复查。此提示不构成医学判断，请以体检结果为准。",
        action: "查看成长",
        severity: "attention",
      });
    }
    const first = input.growth.suggestions[0];
    if (first) {
      out.push({
        id: "growth-suggestion",
        icon: "📚",
        title: `${input.growth.childName}成长建议`,
        detail: first,
        action: "查看详情",
        severity: "info",
      });
    }
  }

  // —— 5. 打卡：本周完成率低于目标的习惯 ——
  if (input.checkins) {
    const { habits, records } = input.checkins;
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    for (const h of habits.filter((x) => x.active && x.target_days_per_week)) {
      const done = records.filter((r) => r.habit_id === h.id && r.completed && r.date >= weekAgo).length;
      const target = h.target_days_per_week!;
      if (done < target) {
        out.push({
          id: `habit-${h.id}`,
          icon: "🎯",
          title: `「${h.name}」进度落后`,
          detail: `近 7 天完成 ${done}/${target} 次，还差 ${target - done} 次达标`,
          action: "去打卡",
          severity: target - done >= target * 0.6 ? "attention" : "info",
          impact: { value: target - done, unit: "次" },
        });
        break; // 每次只提醒最需要补的那一个，避免刷屏
      }
    }
  }

  // 按严重度排序，同级按是否有量化影响排前
  return out
    .sort((a, b) => RANK[a.severity] - RANK[b.severity] || (b.impact ? 1 : 0) - (a.impact ? 1 : 0))
    .slice(0, 6);
}
