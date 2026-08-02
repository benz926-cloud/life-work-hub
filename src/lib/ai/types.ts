// ================================================================
// AI 管线公共类型
// 所有引擎统一返回 EngineResult<T>，保证 UI 侧接入方式一致：
//   - 无 LLM key 时 source === "local"，仍有可用结果（不会白屏）
//   - 配置 key 后 source === "llm"，结构完全相同，UI 无需改动
// ================================================================

/** 结果来源：local = 本地确定性算法；llm = 大模型增强；hybrid = 本地骨架 + LLM 润色 */
export type EngineSource = "local" | "llm" | "hybrid";

export interface EngineResult<T> {
  data: T;
  source: EngineSource;
  /** 0~1，置信度。本地规则给出的是加权得分归一化值 */
  confidence: number;
  /** 可解释性：给用户看的中文理由，UI 可直接渲染 */
  reasons: string[];
  /** LLM 调用失败并回落到本地结果时为 true */
  degraded?: boolean;
  /** 引擎版本，便于 A/B 与回溯 */
  version: string;
}

export function ok<T>(
  data: T,
  opts: Partial<Omit<EngineResult<T>, "data">> & { version: string }
): EngineResult<T> {
  return {
    data,
    source: opts.source ?? "local",
    confidence: clamp01(opts.confidence ?? 0.6),
    reasons: opts.reasons ?? [],
    degraded: opts.degraded,
    version: opts.version,
  };
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** 打分明细，UI 可用来画雷达图 / 进度条 */
export interface ScoreBreakdown {
  [dimension: string]: number;
}

/** 建议卡片，统一结构，可直接喂给 OverviewPage 的 AISuggestion */
export interface Recommendation {
  id: string;
  icon: string;
  title: string;
  detail: string;
  action?: string;
  /** urgent 会在 UI 上标红 */
  severity: "urgent" | "attention" | "info";
  /** 该建议预计带来的量化影响（金额 / 分钟 / 分数），可选 */
  impact?: { value: number; unit: string };
}
