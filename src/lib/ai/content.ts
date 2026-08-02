// ================================================================
// 任务 2：内容聚合评分算法
// ----------------------------------------------------------------
// 总分 = 兴趣匹配 40% + 情境相关 25% + 质量 15% + 时效 15% + 平台偏好 5%
// 排序后再做 MMR 多样性重排，避免"六条全是小红书穿搭"。
//
// 关键设计：
// 1. 质量分做「平台内归一化」——小红书 3.2 万赞和 B 站 8 千赞不是一个量级，
//    直接比大小会让小红书永远霸榜。用各平台基准中位数做对数归一化。
// 2. 情境相关分是这个产品真正的差异点：同样一篇大理攻略，用户 12 天后
//    要去大理，它就该排第一；没有行程时它只是普通旅游内容。
// 3. 互动深度（评论/点赞）比绝对点赞数更能反映"值得看"。
// ================================================================

import type { ContentFeed, ContentCategory, ContentPlatform, SubscriptionRule } from "@/types";
import { CONTENT_TRIAGE } from "./prompts";
import { callAI } from "./client";
import { ok, clamp, clamp01, type EngineResult, type ScoreBreakdown } from "./types";

export const CONTENT_VERSION = "1.0.0";

export type Verdict = "must_read" | "worth_reading" | "skim" | "skip";

export interface ScoredContent {
  feed: ContentFeed;
  score: number;
  breakdown: ScoreBreakdown;
  category: ContentCategory;
  matchedKeywords: string[];
  verdict: Verdict;
  /** 一句话推荐理由，UI 可直接显示在卡片上 */
  why: string;
  /** 可转化的动作，如「存进大理行程」 */
  actionable?: string;
}

/** 用户当下的情境——由各模块的真实数据推导，不是写死的 */
export interface UserContext {
  /** 近期旅行：目的地 + 距出发天数 */
  upcomingTrip?: { destination: string; daysUntil: number };
  /** 家人健康关注点，如 ["高血压"] */
  healthConcerns?: string[];
  /** 孩子相关，如 ["开学", "钢琴"] */
  childTopics?: string[];
  /** 在做的工作/项目关键词 */
  workTopics?: string[];
  /** 学习目标，如 ["英语"] */
  learningGoals?: string[];
  /** 预算偏紧时降低种草类内容权重 */
  budgetTight?: boolean;
}

// ---------------------------------------------------------------
// 平台基准：用于把互动数据归一化到同一尺度
// 数值 = 该平台一条"中位数热度"内容的点赞量，可按实测调整
// ---------------------------------------------------------------
const PLATFORM_BASELINE: Record<ContentPlatform, number> = {
  xiaohongshu: 20000,
  bilibili: 8000,
  youtube: 40000,
};

/** 平台偏好权重（可做成用户设置） */
const PLATFORM_PREFERENCE: Record<ContentPlatform, number> = {
  xiaohongshu: 1.0,
  bilibili: 1.05,
  youtube: 0.95,
};

// ---------------------------------------------------------------
// 类目推断：ContentFeed 本身没有 category 字段，从标题+摘要推断
// ---------------------------------------------------------------
const CATEGORY_SIGNALS: [ContentCategory, RegExp][] = [
  ["fashion", /穿搭|OOTD|搭配|衣橱|极简|时尚|通勤装/],
  ["travel", /旅行|攻略|景点|古城|自驾|亲子游|民宿|路线|打卡地/],
  ["food", /美食|探店|馆子|菜谱|家常菜|烘焙|小吃/],
  ["health", /健康|养生|血压|血糖|膳食|营养|睡眠|医生|healthy/i],
  ["english", /英语|口语|English|雅思|词汇|listening/i],
  ["skill", /编程|AI|Cursor|Claude|效率工具|自动化|教程|实战|开发/i],
  ["knowledge", /科普|原理|深度|解读|复盘|方法论/],
];

export function inferCategory(feed: ContentFeed): ContentCategory {
  const text = `${feed.title} ${feed.summary ?? ""}`;
  for (const [cat, re] of CATEGORY_SIGNALS) if (re.test(text)) return cat;
  return "other";
}

// ---------------------------------------------------------------
// 各维度打分（均为 0~100）
// ---------------------------------------------------------------

/** 1. 兴趣匹配：命中订阅规则关键词 + 类目一致 + 平台一致 */
function scoreInterest(feed: ContentFeed, rules: SubscriptionRule[], cat: ContentCategory) {
  const text = `${feed.title} ${feed.summary ?? ""}`.toLowerCase();
  const matched: string[] = [];
  let score = 0;

  for (const rule of rules) {
    if (!rule.active) continue;
    const platformMatch = rule.platform === feed.platform;
    const categoryMatch = rule.category === cat;

    let hits = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        hits++;
        matched.push(kw);
      }
    }
    if (hits === 0 && !categoryMatch) continue;

    // 关键词命中是主力（每条 22 分，边际递减），类目/平台一致是加成
    score += Math.min(hits, 3) * 22 * (1 - (Math.min(hits, 3) - 1) * 0.15);
    if (categoryMatch) score += 20;
    if (categoryMatch && platformMatch) score += 10;
  }
  return { score: clamp(score, 0, 100), matched: Array.from(new Set(matched)) };
}

/** 2. 情境相关：与用户当下正在发生的事挂钩 —— 本产品的核心差异点 */
function scoreSituation(feed: ContentFeed, cat: ContentCategory, ctx: UserContext) {
  const text = `${feed.title} ${feed.summary ?? ""}`;
  let score = 0;
  const notes: string[] = [];

  if (ctx.upcomingTrip) {
    const { destination, daysUntil } = ctx.upcomingTrip;
    const nameHit = destination && text.includes(destination);
    if (nameHit) {
      // 越临近越相关，30 天外基本无加成
      const urgency = clamp01((30 - daysUntil) / 30);
      score += 55 + 35 * urgency;
      notes.push(`${daysUntil} 天后去${destination}`);
    } else if (cat === "travel" && daysUntil <= 30) {
      score += 25;
      notes.push("近期有出行计划");
    }
  }
  if (ctx.healthConcerns?.length) {
    for (const c of ctx.healthConcerns) {
      if (text.includes(c)) {
        score += 70;
        notes.push(`家人关注「${c}」`);
        break;
      }
    }
    if (cat === "health" && !notes.some((n) => n.startsWith("家人"))) score += 20;
  }
  if (ctx.childTopics?.length) {
    for (const t of ctx.childTopics) {
      if (text.includes(t)) {
        score += 45;
        notes.push(`孩子相关：${t}`);
        break;
      }
    }
  }
  if (ctx.workTopics?.length) {
    for (const t of ctx.workTopics) {
      if (text.toLowerCase().includes(t.toLowerCase())) {
        score += 40;
        notes.push(`在做的事：${t}`);
        break;
      }
    }
  }
  if (ctx.learningGoals?.length) {
    for (const g of ctx.learningGoals) {
      if (text.includes(g) || cat === "english") {
        score += 35;
        notes.push(`学习目标：${g}`);
        break;
      }
    }
  }
  // 预算紧张时，纯种草/购物类内容降权
  if (ctx.budgetTight && /好物|种草|必买|清单推荐|开箱/.test(text)) {
    score -= 25;
    notes.push("预算偏紧，降低种草内容");
  }
  return { score: clamp(score, 0, 100), notes };
}

/**
 * 3. 质量：平台内归一化的热度 + 互动深度
 * 热度用 log 压缩，避免爆款一家独大；互动深度 = 评论/点赞，反映"引发思考"。
 */
function scoreQuality(feed: ContentFeed) {
  const likes = feed.likes ?? 0;
  const comments = feed.comments ?? 0;
  const baseline = PLATFORM_BASELINE[feed.platform] || 10000;

  // 相对热度：等于基准得 60 分，10 倍基准约 90 分
  const rel = likes / baseline;
  const heat = likes === 0 ? 40 : clamp(60 + 30 * Math.log10(Math.max(rel, 0.01)), 0, 95);

  // 互动深度：评论/点赞，正常 2%~8%，超过 8% 说明话题性强
  const depth = likes > 0 ? clamp((comments / likes) * 1000, 0, 100) : 30;

  // 摘要缺失说明信息不全，轻微扣分
  const completeness = feed.summary && feed.summary.length > 10 ? 100 : 60;

  return clamp(heat * 0.6 + depth * 0.25 + completeness * 0.15, 0, 100);
}

/** 4. 时效：指数衰减，半衰期 3 天（资讯类信息 3 天后价值减半） */
function scoreFreshness(feed: ContentFeed, now: Date, cat: ContentCategory) {
  const published = new Date(feed.published_at).getTime();
  if (Number.isNaN(published)) return 50;
  const ageDays = Math.max(0, (now.getTime() - published) / 86400000);
  // 方法论/技能类内容衰减慢，资讯类衰减快
  const halfLife = cat === "skill" || cat === "knowledge" || cat === "english" ? 10 : 3;
  return clamp(100 * Math.pow(0.5, ageDays / halfLife), 0, 100);
}

const WEIGHTS = { interest: 0.4, situation: 0.25, quality: 0.15, freshness: 0.15, platform: 0.05 };

function verdictOf(score: number): Verdict {
  if (score >= 72) return "must_read";
  if (score >= 55) return "worth_reading";
  if (score >= 38) return "skim";
  return "skip";
}

// ---------------------------------------------------------------
// 主评分
// ---------------------------------------------------------------
export function scoreContent(
  feed: ContentFeed,
  rules: SubscriptionRule[],
  ctx: UserContext,
  now = new Date()
): ScoredContent {
  const category = inferCategory(feed);
  const interest = scoreInterest(feed, rules, category);
  const situation = scoreSituation(feed, category, ctx);
  const quality = scoreQuality(feed);
  const freshness = scoreFreshness(feed, now, category);
  const platform = clamp((PLATFORM_PREFERENCE[feed.platform] ?? 1) * 100 - 40, 0, 100);

  const breakdown: ScoreBreakdown = {
    兴趣匹配: Math.round(interest.score),
    情境相关: Math.round(situation.score),
    内容质量: Math.round(quality),
    时效性: Math.round(freshness),
    平台偏好: Math.round(platform),
  };

  const score = Math.round(
    interest.score * WEIGHTS.interest +
      situation.score * WEIGHTS.situation +
      quality * WEIGHTS.quality +
      freshness * WEIGHTS.freshness +
      platform * WEIGHTS.platform
  );

  // 理由文案：优先说情境，其次说兴趣，最后兜底说热度
  let why: string;
  let actionable: string | undefined;
  if (situation.notes.length) {
    why = situation.notes[0];
    if (ctx.upcomingTrip && feed.title.includes(ctx.upcomingTrip.destination)) {
      actionable = `存进${ctx.upcomingTrip.destination}行程`;
    } else if (category === "health") {
      actionable = "转成家人健康清单";
    } else if (category === "english" || category === "skill") {
      actionable = "转成学习计划";
    }
  } else if (interest.matched.length) {
    why = `命中订阅「${interest.matched.slice(0, 2).join("、")}」`;
  } else if (quality >= 75) {
    why = "平台内热度显著高于同类";
  } else {
    why = "与当前关注点关联较弱";
  }

  return {
    feed,
    score,
    breakdown,
    category,
    matchedKeywords: interest.matched,
    verdict: verdictOf(score),
    why,
    actionable,
  };
}

/**
 * MMR 多样性重排：λ 越大越看重相关性，越小越看重多样性。
 * 相似度定义为「同平台 + 同类目 + 同作者」的加权命中。
 */
export function diversify(items: ScoredContent[], lambda = 0.75): ScoredContent[] {
  const pool = [...items].sort((a, b) => b.score - a.score);
  const picked: ScoredContent[] = [];

  const sim = (a: ScoredContent, b: ScoredContent) => {
    let s = 0;
    if (a.category === b.category) s += 0.6;
    if (a.feed.platform === b.feed.platform) s += 0.25;
    if (a.feed.author === b.feed.author) s += 0.5;
    return Math.min(1, s);
  };

  while (pool.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const maxSim = picked.length ? Math.max(...picked.map((p) => sim(pool[i], p))) : 0;
      const val = lambda * (pool[i].score / 100) - (1 - lambda) * maxSim;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    picked.push(pool.splice(bestIdx, 1)[0]);
  }
  return picked;
}

export interface RankOptions {
  ctx?: UserContext;
  now?: Date;
  /** 关闭多样性重排（比如用户手动按热度排序时） */
  diversity?: boolean;
  lambda?: number;
  /** 低于该分数直接过滤 */
  minScore?: number;
}

export function rankContentLocal(
  feeds: ContentFeed[],
  rules: SubscriptionRule[],
  opts: RankOptions = {}
): EngineResult<ScoredContent[]> {
  const ctx = opts.ctx ?? {};
  const now = opts.now ?? new Date();
  let scored = feeds.map((f) => scoreContent(f, rules, ctx, now));
  if (opts.minScore != null) scored = scored.filter((s) => s.score >= opts.minScore!);
  const ranked = opts.diversity === false ? scored.sort((a, b) => b.score - a.score) : diversify(scored, opts.lambda);

  const mustRead = ranked.filter((r) => r.verdict === "must_read").length;
  const reasons = [
    `共 ${feeds.length} 条，${mustRead} 条值得优先看`,
    `权重：兴趣 40% / 情境 25% / 质量 15% / 时效 15% / 平台 5%`,
  ];
  if (ctx.upcomingTrip) reasons.push(`已按「${ctx.upcomingTrip.destination}行程临近」提权`);
  if (opts.diversity !== false) reasons.push("已做多样性重排，避免同类扎堆");

  return ok(ranked, { version: CONTENT_VERSION, confidence: 0.75, reasons, source: "local" });
}

// ---------------------------------------------------------------
// LLM 复核：只对前 N 条做语义分诊，节省 token
// ---------------------------------------------------------------
interface TriageResult {
  items: { id: string; verdict: Verdict; adjust: number; why: string; actionable: string | null }[];
}

export async function rankContent(
  feeds: ContentFeed[],
  rules: SubscriptionRule[],
  opts: RankOptions & { aiTopN?: number } = {}
): Promise<EngineResult<ScoredContent[]>> {
  const local = rankContentLocal(feeds, rules, opts);
  const topN = opts.aiTopN ?? 0;
  if (topN <= 0) return local;

  const head = local.data.slice(0, topN);
  const ctx = opts.ctx ?? {};
  const situations: string[] = [];
  if (ctx.upcomingTrip) situations.push(`${ctx.upcomingTrip.daysUntil}天后去${ctx.upcomingTrip.destination}`);
  if (ctx.healthConcerns?.length) situations.push(`家人有${ctx.healthConcerns.join("、")}`);
  if (ctx.childTopics?.length) situations.push(`孩子：${ctx.childTopics.join("、")}`);
  if (ctx.workTopics?.length) situations.push(`工作：${ctx.workTopics.join("、")}`);

  const env = await callAI<Parameters<typeof CONTENT_TRIAGE.build>[0], TriageResult>(CONTENT_TRIAGE, {
    items: head.map((h) => ({
      id: h.feed.id,
      title: h.feed.title,
      summary: h.feed.summary,
      platform: h.feed.platform,
      localScore: h.score,
    })),
    interests: Array.from(new Set(rules.filter((r) => r.active).flatMap((r) => r.keywords))),
    situations,
  });
  if (!env?.result?.items) return { ...local, degraded: true };

  const patch = new Map(env.result.items.map((i) => [i.id, i]));
  const merged = local.data.map((item) => {
    const p = patch.get(item.feed.id);
    if (!p) return item;
    const score = clamp(item.score + clamp(p.adjust ?? 0, -30, 30), 0, 100);
    return {
      ...item,
      score,
      verdict: p.verdict ?? verdictOf(score),
      why: p.why || item.why,
      actionable: p.actionable ?? item.actionable,
    };
  });
  const reranked = opts.diversity === false ? merged.sort((a, b) => b.score - a.score) : diversify(merged, opts.lambda);

  return ok(reranked, {
    version: CONTENT_VERSION,
    confidence: 0.88,
    reasons: [...local.reasons, ...env.reasoning.slice(0, 2)],
    source: "hybrid",
  });
}
