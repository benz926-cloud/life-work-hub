"use client";

// ================================================================
// AI 管线的 React 接入层
// ----------------------------------------------------------------
// 给 Codex 的约定：UI 组件只用这些 hook，不直接 import 引擎内部实现。
// 每个 hook 的返回结构一致：
//   { data, loading, error, source, confidence, reasons, enhance() }
// - data 在首次渲染就有值（本地引擎同步算出），不会白屏、不会 loading 闪烁
// - enhance() 是可选的 LLM 增强，点「AI 分析」按钮时再调
// ================================================================

import { useCallback, useMemo, useState } from "react";
import type {
  ContentFeed, SubscriptionRule, WardrobeItem,
  FinanceRecord, SavingsGoal, ChildGrowthRecord, FamilyMember,
} from "@/types";
import type { EngineResult } from "@/lib/ai/types";
import { parseIntent, parseIntentLocal, type IntentResult } from "@/lib/ai/intent";
import { rankContent, rankContentLocal, type ScoredContent, type UserContext, type RankOptions } from "@/lib/ai/content";
import { recommendOutfits, recommendOutfitsLocal, type OutfitCandidate, type OutfitContext } from "@/lib/ai/outfit";
import { analyzeFinance, analyzeFinanceWithAI, type FinanceAnalysis, type AnalyzeOptions } from "@/lib/ai/finance";
import { analyzeGrowth, analyzeGrowthWithAI, type GrowthReport } from "@/lib/ai/growth";
import { generateTravel, generateTravelLocal, type TravelDraft, type TravelInput } from "@/lib/ai/travel";
import { buildSuggestions, type SuggestionInput } from "@/lib/ai/suggestions";
import type { Recommendation } from "@/lib/ai/types";

interface AIState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  source: EngineResult<T>["source"];
  confidence: number;
  reasons: string[];
  degraded: boolean;
}

function toState<T>(r: EngineResult<T>, loading = false, error: string | null = null): AIState<T> {
  return {
    data: r.data,
    loading,
    error,
    source: r.source,
    confidence: r.confidence,
    reasons: r.reasons,
    degraded: Boolean(r.degraded),
  };
}

// ---------------------------------------------------------------
// 1. 收件箱意图解析
// ---------------------------------------------------------------
export function useIntentParser() {
  const [state, setState] = useState<AIState<IntentResult> | null>(null);

  /** 输入时的即时预览（纯本地、零延迟），用于输入框下方实时显示将归入哪一类 */
  const preview = useCallback((text: string) => {
    if (!text.trim()) return null;
    return parseIntentLocal(text);
  }, []);

  /** 提交时的完整解析：模糊时才走 LLM */
  const parse = useCallback(async (text: string, opts?: { forceAI?: boolean }) => {
    const local = parseIntentLocal(text);
    setState(toState(local, true));
    try {
      const res = await parseIntent(text, opts);
      const next = toState(res);
      setState(next);
      return res;
    } catch (e) {
      setState(toState(local, false, e instanceof Error ? e.message : "解析失败"));
      return local;
    }
  }, []);

  return { ...(state ?? { data: null, loading: false, error: null, source: "local" as const, confidence: 0, reasons: [], degraded: false }), preview, parse };
}

// ---------------------------------------------------------------
// 2. 内容评分排序
// ---------------------------------------------------------------
export function useContentRanking(
  feeds: ContentFeed[],
  rules: SubscriptionRule[],
  opts: RankOptions & { aiTopN?: number } = {}
) {
  // 情境对象每次渲染都是新引用，用序列化结果做依赖键
  const ctxKey = JSON.stringify(opts.ctx ?? {});
  const local = useMemo(() => rankContentLocal(feeds, rules, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feeds, rules, ctxKey, opts.diversity, opts.lambda, opts.minScore]);

  const [state, setState] = useState<AIState<ScoredContent[]> | null>(null);

  const enhance = useCallback(async () => {
    setState((s) => ({ ...(s ?? toState(local)), loading: true }));
    try {
      const res = await rankContent(feeds, rules, { ...opts, aiTopN: opts.aiTopN ?? 6 });
      setState(toState(res));
      return res;
    } catch (e) {
      setState(toState(local, false, e instanceof Error ? e.message : "AI 分诊失败"));
      return local;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeds, rules, local]);

  return { ...(state ?? toState(local)), enhance };
}

/** 从各模块真实数据推导「当下情境」，供内容评分使用 */
export function buildUserContext(args: {
  trip?: { destination: string; start_date: string } | null;
  familyMembers?: FamilyMember[];
  childTopics?: string[];
  workTopics?: string[];
  learningGoals?: string[];
  budgetTight?: boolean;
  now?: Date;
}): UserContext {
  const now = args.now ?? new Date();
  const ctx: UserContext = {};
  if (args.trip) {
    const daysUntil = Math.ceil((new Date(args.trip.start_date).getTime() - now.getTime()) / 86400000);
    if (daysUntil >= -1) ctx.upcomingTrip = { destination: args.trip.destination, daysUntil: Math.max(0, daysUntil) };
  }
  const conditions = (args.familyMembers ?? []).flatMap((m) => m.health_conditions ?? []);
  if (conditions.length) ctx.healthConcerns = Array.from(new Set(conditions));
  if (args.childTopics?.length) ctx.childTopics = args.childTopics;
  if (args.workTopics?.length) ctx.workTopics = args.workTopics;
  if (args.learningGoals?.length) ctx.learningGoals = args.learningGoals;
  if (args.budgetTight) ctx.budgetTight = true;
  return ctx;
}

// ---------------------------------------------------------------
// 3. 穿搭推荐
// ---------------------------------------------------------------
export function useOutfitRecommendation(
  wardrobe: WardrobeItem[],
  ctx: OutfitContext = {},
  topK = 3
) {
  const excludeKey = JSON.stringify(ctx.excludeIds ?? []);
  const local = useMemo(() => recommendOutfitsLocal(wardrobe, ctx, topK),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wardrobe, ctx.temperature, ctx.weather, ctx.occasion, ctx.season, excludeKey, topK]);

  const [state, setState] = useState<AIState<OutfitCandidate[]> | null>(null);
  const [index, setIndex] = useState(0);

  const current = (state?.data ?? local.data)[index] ?? null;

  /** 「换一套」按钮 */
  const next = useCallback(() => {
    const list = state?.data ?? local.data;
    if (list.length) setIndex((i) => (i + 1) % list.length);
  }, [state, local]);

  const enhance = useCallback(async () => {
    setState((s) => ({ ...(s ?? toState(local)), loading: true }));
    try {
      const res = await recommendOutfits(wardrobe, ctx, { topK, useAI: true });
      setState(toState(res));
      return res;
    } catch (e) {
      setState(toState(local, false, e instanceof Error ? e.message : "AI 生成失败"));
      return local;
    }
     
  }, [wardrobe, ctx, topK, local]);

  return { ...(state ?? toState(local)), current, index, next, enhance };
}

// ---------------------------------------------------------------
// 4. 理财分析
// ---------------------------------------------------------------
export function useFinanceAnalysis(
  records: FinanceRecord[],
  goals: SavingsGoal[] = [],
  opts: AnalyzeOptions = {}
) {
  const local = useMemo(() => analyzeFinance(records, goals, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, goals, opts.monthlyBudget, opts.month]);


  const [state, setState] = useState<AIState<FinanceAnalysis> | null>(null);

  const enhance = useCallback(async () => {
    setState((s) => ({ ...(s ?? toState(local)), loading: true }));
    try {
      const res = await analyzeFinanceWithAI(records, goals, opts);
      setState(toState(res as EngineResult<FinanceAnalysis>));
      return res;
    } catch (e) {
      setState(toState(local, false, e instanceof Error ? e.message : "AI 分析失败"));
      return local;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, goals, local]);

  return { ...(state ?? toState(local)), enhance };
}

// ---------------------------------------------------------------
// 5. 孩子成长报告
// ---------------------------------------------------------------
export function useGrowthReport(records: ChildGrowthRecord[], child?: FamilyMember) {
  const local = useMemo(() => analyzeGrowth(records, child), [records, child]);
  const [state, setState] = useState<AIState<GrowthReport> | null>(null);

  const enhance = useCallback(async () => {
    setState((s) => ({ ...(s ?? toState(local)), loading: true }));
    try {
      const res = await analyzeGrowthWithAI(records, child);
      setState(toState(res));
      return res;
    } catch (e) {
      setState(toState(local, false, e instanceof Error ? e.message : "AI 生成失败"));
      return local;
    }
  }, [records, child, local]);

  return { ...(state ?? toState(local)), enhance };
}

// ---------------------------------------------------------------
// 6. 旅行攻略生成
// ---------------------------------------------------------------
export function useTravelGenerator() {
  const [state, setState] = useState<AIState<TravelDraft> | null>(null);

  const generate = useCallback(async (input: TravelInput, useAI = true) => {
    const local = generateTravelLocal(input);
    setState(toState(local, useAI));
    if (!useAI) return local;
    try {
      const res = await generateTravel(input);
      setState(toState(res));
      return res;
    } catch (e) {
      setState(toState(local, false, e instanceof Error ? e.message : "AI 生成失败"));
      return local;
    }
  }, []);

  return { ...(state ?? { data: null, loading: false, error: null, source: "local" as const, confidence: 0, reasons: [], degraded: false }), generate };
}


// ---------------------------------------------------------------
// 7. AI 主动建议（概览页）
// ---------------------------------------------------------------
/**
 * 把各引擎的结论汇总成一个排好序的建议列表。
 * 这不是数据库里的表，而是实时算出来的视图——数据变了建议就变。
 * 传进来的每一项都是可选的，缺哪个就少几条建议，不会报错。
 */
export function useAISuggestions(input: SuggestionInput): Recommendation[] {
  const { finance, growth, travel, alerts, checkins, now } = input;
  return useMemo(
    () => buildSuggestions({ finance, growth, travel, alerts, checkins, now }),
    [finance, growth, travel, alerts, checkins, now]
  );
}
