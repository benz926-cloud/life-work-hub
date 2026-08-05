// ================================================================
// 工作驾驶舱 —— agent_outputs 的读取侧逻辑
// ----------------------------------------------------------------
// WorkBuddy 负责写，这里负责「怎么读、怎么排、怎么显示」。
//
// 一条硬性纪律：`detail` 是 jsonb，运行时形状不保证。
// 旅行页那次崩溃就是直接展开数据库 JSON 列导致的（mock 里永远完整，
// 接真库才炸）。所以这里所有 detail 一律经过归一化函数，绝不直接取字段。
// ================================================================

import type {
  AgentOutput, AgentOutputKind, AgentOutputSeverity, AgentOutputStatus,
} from "@/types";

export const COCKPIT_VERSION = "1.0.0";

// ---------------------------------------------------------------
// 各 kind 的 detail 形状（约定见 docs/AGENT_OUTPUTS.md）
// ---------------------------------------------------------------
export interface BriefDetail { from?: string; needsReply: boolean; deadline?: string; keyPoints: string[] }
export interface ApprovalDetail { applicant?: string; amount?: number; reason?: string; dueDate?: string; aiSuggestion?: string; aiConcerns: string[] }
export interface MessageDetail { chatName?: string; sender?: string; mentionedMe: boolean; unreadCount: number; keyPoints: string[]; needsReply: boolean }
export interface ReportPending { who: string; what: string; overdueDays: number }
export interface ReportDetail { period?: string; dueDate?: string; pending: ReportPending[]; completedCount: number; totalCount: number }

// ---------------------------------------------------------------
// 安全取值：jsonb 什么都可能是
// ---------------------------------------------------------------
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean => v === true;
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map(String) : []);

export function normalizeBrief(detail: unknown): BriefDetail {
  const d = obj(detail);
  return { from: str(d.from), needsReply: bool(d.needs_reply), deadline: str(d.deadline), keyPoints: strs(d.key_points) };
}

export function normalizeApproval(detail: unknown): ApprovalDetail {
  const d = obj(detail);
  return {
    applicant: str(d.applicant), amount: num(d.amount), reason: str(d.reason), dueDate: str(d.due_date),
    aiSuggestion: str(d.ai_suggestion), aiConcerns: strs(d.ai_concerns),
  };
}

export function normalizeMessage(detail: unknown): MessageDetail {
  const d = obj(detail);
  return {
    chatName: str(d.chat_name), sender: str(d.sender), mentionedMe: bool(d.mentioned_me),
    unreadCount: num(d.unread_count) ?? 0, keyPoints: strs(d.key_points), needsReply: bool(d.needs_reply),
  };
}

export function normalizeReport(detail: unknown): ReportDetail {
  const d = obj(detail);
  const pending: ReportPending[] = Array.isArray(d.pending)
    ? d.pending.map(obj).map((p) => ({ who: str(p.who) ?? "未知", what: str(p.what) ?? "未命名", overdueDays: num(p.overdue_days) ?? 0 })).filter((p) => p.what !== "未命名" || p.who !== "未知")
    : [];
  return { period: str(d.period), dueDate: str(d.due_date), pending, completedCount: num(d.completed_count) ?? 0, totalCount: num(d.total_count) ?? 0 };
}

// ---------------------------------------------------------------
// 排序：严重度优先，同级按事件时间倒序
// ---------------------------------------------------------------
const SEVERITY_RANK: Record<AgentOutputSeverity, number> = { urgent: 0, attention: 1, info: 2 };

/** 事件时间缺失时回落到写入时间，保证排序稳定 */
const timeOf = (o: AgentOutput): number => {
  const t = Date.parse(o.occurred_at ?? o.created_at ?? "");
  return Number.isNaN(t) ? 0 : t;
};

export function sortOutputs(items: AgentOutput[]): AgentOutput[] {
  return [...items].sort((a, b) => {
    const s = (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3);
    if (s !== 0) return s;
    return timeOf(b) - timeOf(a);
  });
}

// ---------------------------------------------------------------
// 分组与总览
// ---------------------------------------------------------------
export interface CockpitSection {
  kind: AgentOutputKind;
  label: string;
  icon: string;
  items: AgentOutput[];
  urgentCount: number;
  /** 该组没有数据时给 UI 的一句人话 */
  emptyHint: string;
}

const SECTION_META: { kind: AgentOutputKind; label: string; icon: string; emptyHint: string }[] = [
  { kind: "approval", label: "待办审批", icon: "📋", emptyHint: "当前没有待你审批的单子" },
  { kind: "message", label: "飞书要闻", icon: "💬", emptyHint: "没有需要你关注的消息" },
  { kind: "brief", label: "邮件要点", icon: "✉️", emptyHint: "没有需要处理的邮件" },
  { kind: "report", label: "汇报待办", icon: "📊", emptyHint: "本周汇报都齐了" },
];

export interface CockpitView {
  sections: CockpitSection[];
  /** 顶部一句话：今天到底要处理几件事 */
  headline: string;
  urgentCount: number;
  actionableCount: number;
  /** 数据最后一次更新的时间，UI 上要显示——否则用户不知道看的是不是隔夜的 */
  lastUpdated: string | null;
  /** 距上次更新超过 12 小时，提醒用户 WorkBuddy 该跑了 */
  isStale: boolean;
}

export interface CockpitOptions {
  now?: Date;
  /** 默认只看未处理的；传 true 则包含已读/已完成 */
  includeHandled?: boolean;
  /** 每组最多显示几条 */
  limitPerSection?: number;
  staleHours?: number;
}

const OPEN_STATUS: AgentOutputStatus[] = ["new", "read"];

export function buildCockpit(items: AgentOutput[], opts: CockpitOptions = {}): CockpitView {
  const now = opts.now ?? new Date();
  const limit = opts.limitPerSection ?? 5;
  const staleHours = opts.staleHours ?? 12;

  const visible = opts.includeHandled ? items : items.filter((i) => OPEN_STATUS.includes(i.status));

  const sections: CockpitSection[] = SECTION_META.map((meta) => {
    const all = sortOutputs(visible.filter((i) => i.kind === meta.kind));
    return {
      ...meta,
      items: all.slice(0, limit),
      urgentCount: all.filter((i) => i.severity === "urgent").length,
    };
  });

  const urgentCount = visible.filter((i) => i.severity === "urgent").length;
  const actionableCount = visible.filter((i) => i.severity !== "info").length;

  // 最后更新时间取全部数据（含已处理的），否则清空后会显示"从未更新"
  const times = items.map((i) => Date.parse(i.created_at ?? "")).filter((t) => !Number.isNaN(t) && t > 0);
  const lastMs = times.length ? Math.max(...times) : null;
  const lastUpdated = lastMs ? new Date(lastMs).toISOString() : null;
  const isStale = lastMs != null && now.getTime() - lastMs > staleHours * 3600_000;

  let headline: string;
  if (!items.length) headline = "还没有数据。让 WorkBuddy 跑一次抓取即可。";
  else if (urgentCount > 0) headline = `有 ${urgentCount} 件事今天必须处理`;
  else if (actionableCount > 0) headline = `${actionableCount} 件事本周内要跟进，没有紧急项`;
  else headline = "没有待办，今天清空了";

  return { sections, headline, urgentCount, actionableCount, lastUpdated, isStale };
}

/** 卡片副标题：把 detail 压成一行，UI 不用自己拆 jsonb */
export function cardSubtitle(o: AgentOutput): string {
  switch (o.kind) {
    case "approval": {
      const d = normalizeApproval(o.detail);
      return [d.applicant, d.amount != null ? `¥${d.amount.toLocaleString()}` : null, d.dueDate ? `${d.dueDate} 截止` : null]
        .filter(Boolean).join(" · ");
    }
    case "message": {
      const d = normalizeMessage(o.detail);
      return [d.chatName, d.mentionedMe ? "@我" : null, d.unreadCount ? `${d.unreadCount} 条未读` : null]
        .filter(Boolean).join(" · ");
    }
    case "brief": {
      const d = normalizeBrief(o.detail);
      return [d.from, d.needsReply ? "需回复" : null, d.deadline ? `${d.deadline} 前` : null]
        .filter(Boolean).join(" · ");
    }
    case "report": {
      const d = normalizeReport(o.detail);
      const overdue = d.pending.filter((p) => p.overdueDays > 0).length;
      return [d.period, `${d.completedCount}/${d.totalCount} 已交`, overdue ? `${overdue} 人逾期` : null]
        .filter(Boolean).join(" · ");
    }
    default:
      return o.summary ?? "";
  }
}
