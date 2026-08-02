// ================================================================
// 任务 3：穿搭推荐匹配引擎
// ----------------------------------------------------------------
// 三步走：
//   ① 需求建模：温度 → 需要哪些"槽位"(top/bottom/outerwear/shoes/accessory)
//                以及总保暖度目标；场合 → 允许的风格与正式度区间
//   ② 单品打分：季节 30 + 风格 30 + 温度 20 + 新鲜度 10 + 历史评分 10
//   ③ 组合搜索：按槽位做 beam search（宽度 4），组合分 = 单品均分 60%
//                + 颜色协调 25% + 风格一致 10% + 正式度一致 5%
//
// 为什么不用全组合枚举：6 件衣服无所谓，衣柜到 100 件时 top×bottom×outer×shoes
// 就是 10^6 量级。beam search 在 O(n·k) 内拿到接近最优解。
// ================================================================

import type { WardrobeItem, Outfit, Season, ClothingStyle, ClothingType } from "@/types";
import { OUTFIT_RATIONALE } from "./prompts";
import { callAI } from "./client";
import { ok, clamp, clamp01, type EngineResult } from "./types";

export const OUTFIT_VERSION = "1.0.0";

export type Occasion = "work" | "casual" | "sport" | "formal" | "date" | "travel";

export interface OutfitContext {
  /** 摄氏度，缺省按季节推一个典型值 */
  temperature?: number;
  /** 「晴」「小雨」「大风」等；含雨会强制运动鞋/避免浅色下装 */
  weather?: string;
  season?: Season;
  occasion?: Occasion;
  date?: Date;
  /** 最近穿过的 outfit，用于避免重复 */
  recentOutfits?: Outfit[];
  /** 想排除的单品（洗了/破了） */
  excludeIds?: string[];
}

export interface OutfitCandidate {
  items: WardrobeItem[];
  score: number;
  breakdown: { 单品适配: number; 颜色协调: number; 风格一致: number; 正式度: number };
  /** 中文理由，可直接写进 Outfit.notes */
  note: string;
  reasons: string[];
  warnings: string[];
}

// ---------------------------------------------------------------
// 颜色：把常见色名映射到 HSL，用于计算协调度
// ---------------------------------------------------------------
interface ColorSpec {
  h: number; // 0~360
  s: number; // 0~1
  l: number; // 0~1
  neutral: boolean;
}

const COLORS: Record<string, ColorSpec> = {
  white: { h: 0, s: 0, l: 0.98, neutral: true },
  black: { h: 0, s: 0, l: 0.06, neutral: true },
  gray: { h: 0, s: 0, l: 0.55, neutral: true },
  grey: { h: 0, s: 0, l: 0.55, neutral: true },
  beige: { h: 40, s: 0.3, l: 0.8, neutral: true },
  camel: { h: 33, s: 0.5, l: 0.55, neutral: true },
  khaki: { h: 45, s: 0.35, l: 0.55, neutral: true },
  navy: { h: 220, s: 0.65, l: 0.25, neutral: true },
  denim: { h: 215, s: 0.4, l: 0.45, neutral: true },
  brown: { h: 25, s: 0.5, l: 0.32, neutral: true },
  blue: { h: 215, s: 0.7, l: 0.5, neutral: false },
  red: { h: 0, s: 0.75, l: 0.5, neutral: false },
  pink: { h: 340, s: 0.65, l: 0.75, neutral: false },
  green: { h: 130, s: 0.5, l: 0.4, neutral: false },
  yellow: { h: 50, s: 0.85, l: 0.6, neutral: false },
  orange: { h: 25, s: 0.85, l: 0.55, neutral: false },
  purple: { h: 280, s: 0.5, l: 0.45, neutral: false },
};

/** 中文色名 → 英文 key */
const COLOR_ALIAS: Record<string, string> = {
  白: "white", 白色: "white", 米白: "beige", 米色: "beige",
  黑: "black", 黑色: "black",
  灰: "gray", 灰色: "gray", 浅灰: "gray", 深灰: "gray",
  藏青: "navy", 深蓝: "navy", 蓝: "blue", 蓝色: "blue", 牛仔蓝: "denim",
  驼: "camel", 驼色: "camel", 卡其: "khaki", 棕: "brown", 咖啡: "brown",
  红: "red", 红色: "red", 粉: "pink", 粉色: "pink",
  绿: "green", 绿色: "green", 黄: "yellow", 黄色: "yellow",
  橙: "orange", 紫: "purple",
};

export function resolveColor(name: string): ColorSpec {
  const k = name?.trim().toLowerCase() ?? "";
  if (COLORS[k]) return COLORS[k];
  const alias = COLOR_ALIAS[name?.trim()];
  if (alias && COLORS[alias]) return COLORS[alias];
  for (const [cn, en] of Object.entries(COLOR_ALIAS)) {
    if (name?.includes(cn)) return COLORS[en];
  }
  // 未知色按中性中灰处理，不奖不罚
  return { h: 0, s: 0.1, l: 0.5, neutral: true };
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * 两件单品的配色得分 0~100：
 * - 中性 + 任意 = 安全（85）
 * - 同色系（色相差 < 30）= 高级（80，但明度需拉开）
 * - 类似色（30~60）= 和谐（75）
 * - 互补色（150~180）且至少一方低饱和 = 有张力（70）
 * - 中间地带（60~150）= 容易脏（45）
 */
export function pairColorScore(a: WardrobeItem, b: WardrobeItem): number {
  const ca = resolveColor(a.color);
  const cb = resolveColor(b.color);

  if (ca.neutral && cb.neutral) {
    // 两件中性色：明度差太小会糊
    const lDiff = Math.abs(ca.l - cb.l);
    return lDiff < 0.12 ? 68 : 90;
  }
  if (ca.neutral || cb.neutral) return 85;

  const hd = hueDistance(ca.h, cb.h);
  const lDiff = Math.abs(ca.l - cb.l);
  if (hd < 30) return lDiff >= 0.2 ? 82 : 62; // 同色系需要明度层次
  if (hd < 60) return 75;
  if (hd >= 150) return ca.s < 0.5 || cb.s < 0.5 ? 72 : 55; // 双高饱和撞色风险大
  return 45;
}

// ---------------------------------------------------------------
// 保暖度：由类型 + 名称关键词推断（1 最薄 ~ 5 最厚）
// ---------------------------------------------------------------
const WARMTH_KEYWORDS: [RegExp, number][] = [
  [/羽绒|棉服|派克/, 5],
  [/大衣|风衣|夹克|皮衣/, 4],
  [/毛衣|针织|卫衣|抓绒/, 3],
  [/衬衫|长袖|长裤|牛仔/, 2],
  [/T恤|短袖|短裤|吊带|背心|薄/, 1],
];

const TYPE_BASE_WARMTH: Record<ClothingType, number> = {
  top: 2, bottom: 2, outerwear: 4, dress: 2, shoes: 1, accessory: 1,
};

export function warmthOf(item: WardrobeItem): number {
  for (const [re, w] of WARMTH_KEYWORDS) if (re.test(item.name)) return w;
  return TYPE_BASE_WARMTH[item.type] ?? 2;
}

// ---------------------------------------------------------------
// 正式度（1 最随意 ~ 5 最正式）
// ---------------------------------------------------------------
const STYLE_FORMALITY: Record<ClothingStyle, number> = {
  formal: 5, business: 4, casual: 2, street: 2, sport: 1,
};

function formalityOf(item: WardrobeItem): number {
  if (!item.style?.length) return 2.5;
  return item.style.reduce((s, st) => s + (STYLE_FORMALITY[st] ?? 2.5), 0) / item.style.length;
}

/** 场合 → 首选风格 + 目标正式度 */
const OCCASION_PROFILE: Record<Occasion, { styles: ClothingStyle[]; formality: number; label: string }> = {
  work: { styles: ["business", "casual"], formality: 3.6, label: "通勤" },
  formal: { styles: ["formal", "business"], formality: 4.7, label: "正式场合" },
  casual: { styles: ["casual", "street"], formality: 2.2, label: "休闲" },
  sport: { styles: ["sport"], formality: 1.2, label: "运动" },
  date: { styles: ["casual", "business"], formality: 3.0, label: "约会" },
  travel: { styles: ["casual", "sport"], formality: 1.8, label: "出行" },
};

// ---------------------------------------------------------------
// 季节与温度
// ---------------------------------------------------------------
export function seasonOf(date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

const SEASON_TYPICAL_TEMP: Record<Season, number> = { spring: 18, summer: 30, autumn: 17, winter: 5 };

/** 温度 → 需要的槽位与总保暖度目标 */
export function planSlots(temp: number): { slots: ClothingType[]; optional: ClothingType[]; targetWarmth: number } {
  if (temp >= 28) return { slots: ["top", "bottom", "shoes"], optional: ["accessory"], targetWarmth: 4 };
  if (temp >= 22) return { slots: ["top", "bottom", "shoes"], optional: ["outerwear", "accessory"], targetWarmth: 5 };
  if (temp >= 15) return { slots: ["top", "bottom", "shoes"], optional: ["outerwear"], targetWarmth: 7 };
  if (temp >= 8) return { slots: ["top", "bottom", "outerwear", "shoes"], optional: ["accessory"], targetWarmth: 9 };
  return { slots: ["top", "bottom", "outerwear", "shoes"], optional: ["accessory"], targetWarmth: 11 };
}

// ---------------------------------------------------------------
// 单品打分
// ---------------------------------------------------------------
interface ScoredItem {
  item: WardrobeItem;
  score: number;
  notes: string[];
}

function scoreItem(
  item: WardrobeItem,
  season: Season,
  profile: (typeof OCCASION_PROFILE)[Occasion],
  temp: number,
  lastWornDays: Map<string, number>
): ScoredItem {
  const notes: string[] = [];

  // 季节 30
  const seasonFit = !item.season?.length ? 20 : item.season.includes(season) ? 30 : 4;
  if (seasonFit === 30) notes.push("当季");

  // 风格 30
  const styleHit = item.style?.filter((s) => profile.styles.includes(s)) ?? [];
  const styleFit = styleHit.length ? 30 - (profile.styles.indexOf(styleHit[0]) * 6) : 8;
  if (styleHit.length) notes.push(`风格贴合${profile.label}`);

  // 温度 20：单品保暖度与"该温度下单件应有的厚度"的接近程度
  const idealWarmth = temp >= 28 ? 1 : temp >= 22 ? 1.6 : temp >= 15 ? 2.3 : temp >= 8 ? 3.2 : 4;
  const w = warmthOf(item);
  const tempFit = clamp(20 - Math.abs(w - idealWarmth) * 6, 0, 20);

  // 新鲜度 10：越久没穿越优先，7 天以上满分
  const days = lastWornDays.get(item.id) ?? 999;
  const freshness = clamp((days / 7) * 10, 0, 10);
  if (days <= 2) notes.push("最近刚穿过");

  return { item, score: seasonFit + styleFit + tempFit + freshness, notes };
}

// ---------------------------------------------------------------
// 组合评分
// ---------------------------------------------------------------
function scoreCombo(
  items: WardrobeItem[],
  itemScores: Map<string, number>,
  profile: (typeof OCCASION_PROFILE)[Occasion],
  targetWarmth: number
) {
  const avgItem = items.reduce((s, i) => s + (itemScores.get(i.id) ?? 0), 0) / items.length; // 0~90

  // 颜色：两两配色分的均值，鞋子权重减半（鞋更容易百搭）
  let cSum = 0;
  let cCount = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const w = items[i].type === "shoes" || items[j].type === "shoes" ? 0.5 : 1;
      cSum += pairColorScore(items[i], items[j]) * w;
      cCount += w;
    }
  }
  const color = cCount ? cSum / cCount : 70;

  // 风格一致性：所有单品共享风格的比例
  const styleSets = items.map((i) => new Set(i.style ?? []));
  const allStyles = Array.from(new Set(items.flatMap((i) => i.style ?? [])));
  const shared = allStyles.filter((s) => styleSets.every((set) => set.has(s)));
  const cohesion = shared.length ? 100 : allStyles.length <= 2 ? 70 : 45;

  // 正式度：与场合目标的偏差 + 内部方差（西裤配运动鞋这类）
  const fs = items.map(formalityOf);
  const mean = fs.reduce((a, b) => a + b, 0) / fs.length;
  const variance = fs.reduce((a, b) => a + (b - mean) ** 2, 0) / fs.length;
  const formality = clamp(100 - Math.abs(mean - profile.formality) * 22 - variance * 18, 0, 100);

  // 保暖度偏差作为惩罚项（不足比过量更难受）
  const totalWarmth = items.reduce((s, i) => s + warmthOf(i), 0);
  const warmthGap = totalWarmth - targetWarmth;
  const warmthPenalty = warmthGap < 0 ? Math.abs(warmthGap) * 5 : warmthGap * 2.5;

  const score = clamp(
    (avgItem / 90) * 100 * 0.6 + color * 0.25 + cohesion * 0.1 + formality * 0.05 - warmthPenalty,
    0,
    100
  );

  return {
    score: Math.round(score),
    breakdown: {
      单品适配: Math.round((avgItem / 90) * 100),
      颜色协调: Math.round(color),
      风格一致: Math.round(cohesion),
      正式度: Math.round(formality),
    },
    totalWarmth,
    warmthGap,
  };
}

// ---------------------------------------------------------------
// 主推荐（本地，同步）
// ---------------------------------------------------------------
export function recommendOutfitsLocal(
  wardrobe: WardrobeItem[],
  ctx: OutfitContext = {},
  topK = 3
): EngineResult<OutfitCandidate[]> {
  const date = ctx.date ?? new Date();
  const season = ctx.season ?? seasonOf(date);
  const temp = ctx.temperature ?? SEASON_TYPICAL_TEMP[season];
  const occasion = ctx.occasion ?? "casual";
  const profile = OCCASION_PROFILE[occasion];
  const { slots, optional, targetWarmth } = planSlots(temp);
  const rainy = /雨|雪/.test(ctx.weather ?? "");

  // 最近穿着天数
  const lastWorn = new Map<string, number>();
  for (const o of ctx.recentOutfits ?? []) {
    const days = Math.max(0, Math.round((date.getTime() - new Date(o.date).getTime()) / 86400000));
    for (const id of o.items) lastWorn.set(id, Math.min(lastWorn.get(id) ?? 999, days));
  }

  const exclude = new Set(ctx.excludeIds ?? []);
  const pool = wardrobe.filter((w) => !exclude.has(w.id));

  const scored = pool.map((i) => scoreItem(i, season, profile, temp, lastWorn));
  const itemScores = new Map(scored.map((s) => [s.item.id, s.score]));

  // 每个槽位取前 4 个候选
  const byType = (t: ClothingType) =>
    scored.filter((s) => s.item.type === t).sort((a, b) => b.score - a.score).slice(0, 4).map((s) => s.item);

  const warnings: string[] = [];
  const required = slots.filter((t) => {
    const has = byType(t).length > 0;
    if (!has) warnings.push(`衣柜里缺少${ZH_TYPE[t]}，本次推荐已跳过该槽位`);
    return has;
  });

  // 连衣裙可整体替代 top+bottom
  const dresses = byType("dress");
  const useDressBranch = dresses.length > 0 && required.includes("top") && required.includes("bottom");

  const buildCombos = (slotList: ClothingType[]): WardrobeItem[][] => {
    let beams: WardrobeItem[][] = [[]];
    for (const t of slotList) {
      const cands = byType(t);
      if (!cands.length) continue;
      const next: WardrobeItem[][] = [];
      for (const b of beams) for (const c of cands) next.push([...b, c]);
      // beam 剪枝：每层只留最优 12 条
      next.sort((x, y) => scoreCombo(y, itemScores, profile, targetWarmth).score - scoreCombo(x, itemScores, profile, targetWarmth).score);
      beams = next.slice(0, 12);
    }
    return beams;
  };

  const combos = buildCombos(required);
  if (useDressBranch) {
    const dressSlots: ClothingType[] = [
      ...required.filter((t) => t !== "top" && t !== "bottom"),
      "dress",
    ];
    combos.push(...buildCombos(dressSlots));
  }

  // 可选槽位（外套/配饰）：温度偏低或多雨时尝试加上
  const withOptional: WardrobeItem[][] = [];
  for (const c of combos) {
    withOptional.push(c);
    for (const t of optional) {
      const extra = byType(t)[0];
      if (!extra) continue;
      const cur = c.reduce((s, i) => s + warmthOf(i), 0);
      if (cur < targetWarmth) withOptional.push([...c, extra]);
    }
  }

  const candidates: OutfitCandidate[] = withOptional
    .map((items) => {
      const { score, breakdown, warmthGap } = scoreCombo(items, itemScores, profile, targetWarmth);
      const reasons: string[] = [];
      const warn: string[] = [...warnings];

      reasons.push(`${temp}°C / ${ZH_SEASON[season]} / ${profile.label}`);
      if (breakdown.颜色协调 >= 82) reasons.push("配色安全，有明度层次");
      else if (breakdown.颜色协调 < 60) warn.push("这套颜色偏冲，建议换一件中性色");
      if (breakdown.风格一致 >= 90) reasons.push("整套风格统一");
      if (warmthGap < -2) warn.push("按当前气温偏薄，建议加一件外套");
      if (warmthGap > 3) warn.push("按当前气温偏厚，可能会热");
      if (rainy && !items.some((i) => i.type === "shoes" && /运动|雨|皮/.test(i.name))) {
        warn.push("有雨，建议换成防水或深色鞋");
      }
      const fresh = items.filter((i) => (lastWorn.get(i.id) ?? 999) > 7);
      if (fresh.length === items.length) reasons.push("这套最近没穿过");

      const note = buildNote(items, temp, profile.label, breakdown);
      return { items, score, breakdown, note, reasons, warnings: warn };
    })
    .sort((a, b) => b.score - a.score);

  // 去重：单品集合相同的只留一条
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const k = c.items.map((i) => i.id).sort().join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const top = unique.slice(0, topK);
  const conf = top.length ? clamp01(top[0].score / 100) : 0.2;

  return ok(top, {
    version: OUTFIT_VERSION,
    confidence: conf,
    reasons: top[0]?.reasons ?? ["衣柜数据不足，无法生成推荐"],
    source: "local",
  });
}

const ZH_TYPE: Record<ClothingType, string> = {
  top: "上衣", bottom: "下装", outerwear: "外套", dress: "连衣裙", shoes: "鞋子", accessory: "配饰",
};
const ZH_SEASON: Record<Season, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

function buildNote(items: WardrobeItem[], temp: number, occasionLabel: string, bd: { 颜色协调: number }): string {
  const names = items.map((i) => i.name).join(" + ");
  const colorWord = bd.颜色协调 >= 85 ? "配色干净" : bd.颜色协调 >= 70 ? "配色稳妥" : "配色偏个性";
  const tempWord = temp >= 28 ? "透气不闷" : temp >= 15 ? "厚薄合适" : "保暖到位";
  return `${names}：${colorWord}，${tempWord}，适合${occasionLabel}。`;
}

// ---------------------------------------------------------------
// LLM 润色：只改文案，不改组合
// ---------------------------------------------------------------
export async function recommendOutfits(
  wardrobe: WardrobeItem[],
  ctx: OutfitContext = {},
  opts: { topK?: number; useAI?: boolean } = {}
): Promise<EngineResult<OutfitCandidate[]>> {
  const local = recommendOutfitsLocal(wardrobe, ctx, opts.topK ?? 3);
  if (!opts.useAI || !local.data.length) return local;

  const best = local.data[0];
  const env = await callAI<Parameters<typeof OUTFIT_RATIONALE.build>[0], { note: string; tip: string | null; riskWarning: string | null }>(
    OUTFIT_RATIONALE,
    {
      items: best.items.map((i) => ({ name: i.name, type: i.type, color: i.color })),
      weather: ctx.weather ?? "未知",
      temperature: ctx.temperature ?? SEASON_TYPICAL_TEMP[ctx.season ?? seasonOf()],
      occasion: OCCASION_PROFILE[ctx.occasion ?? "casual"].label,
      localReasons: best.reasons,
    }
  );
  if (!env?.result) return { ...local, degraded: true };

  const data = [...local.data];
  data[0] = {
    ...best,
    note: env.result.note || best.note,
    reasons: env.result.tip ? [...best.reasons, env.result.tip] : best.reasons,
    warnings: env.result.riskWarning ? [...best.warnings, env.result.riskWarning] : best.warnings,
  };
  return ok(data, { version: OUTFIT_VERSION, confidence: local.confidence, reasons: local.reasons, source: "hybrid" });
}

/** 推荐结果 → 可写库的 Outfit */
export function toOutfit(c: OutfitCandidate, userId: string, ctx: OutfitContext): Omit<Outfit, "id"> {
  const date = ctx.date ?? new Date();
  return {
    user_id: userId,
    date: date.toISOString().slice(0, 10),
    weather: ctx.weather,
    temperature: ctx.temperature,
    items: c.items.map((i) => i.id),
    notes: c.note,
    created_at: new Date().toISOString(),
  };
}
