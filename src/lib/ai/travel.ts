// ================================================================
// 任务 6：旅行攻略生成
// ----------------------------------------------------------------
// 输出结构与现有 TravelPlan.itinerary / checklist 完全同构：
//   itinerary = { days: [{ day, title, activities: string[] }], tips: string[] }
//   checklist = { documents|clothing|kids|other: { name, done }[] }
// 这样 TravelPlan.tsx 一行不用改就能渲染生成结果。
//
// 分工：
//   本地引擎负责「结构」——天数骨架、节奏、行李清单、预算拆分（确定性、可复现）
//   LLM 负责「内容」——具体景点、餐厅类型、地理动线（常识性知识）
// 未配置 LLM 时，已知目的地走内置知识库，未知目的地输出可编辑的骨架。
// ================================================================

import type { TravelPlan, FamilyMember } from "@/types";
import { TRAVEL_ITINERARY } from "./prompts";
import { callAI } from "./client";
import { ok, type EngineResult } from "./types";

export const TRAVEL_VERSION = "1.0.0";

export type Pace = "relaxed" | "balanced" | "packed";

export interface TravelInput {
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  travelers?: FamilyMember[];
  budget?: number;
  preferences?: string[];
  pace?: Pace;
}

export interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
  area?: string;
  note?: string;
}

export interface ChecklistItem { name: string; done: boolean }

export interface TravelChecklist {
  documents: ChecklistItem[];
  clothing: ChecklistItem[];
  kids: ChecklistItem[];
  other: ChecklistItem[];
}

export interface TravelDraft {
  destination: string;
  days: number;
  itinerary: { days: ItineraryDay[]; tips: string[] };
  checklist: TravelChecklist;
  budgetBreakdown: { label: string; amount: number; pct: number }[] | null;
  /** 人均每日预算，用于合理性提示 */
  perPersonPerDay: number | null;
  warnings: string[];
}

// ---------------------------------------------------------------
// 内置目的地知识库（无 LLM 时的兜底；有 LLM 时作为参考）
// 只放高频国内目的地，字段刻意保守：不写价格、不写营业时间。
// ---------------------------------------------------------------
interface Spot { name: string; area: string; kidFriendly: boolean; intensity: 1 | 2 | 3; tags: string[] }

interface Destination {
  spots: Spot[];
  climate: "highland" | "coastal" | "inland" | "cold";
  tips: string[];
}

export const DESTINATIONS: Record<string, Destination> = {
  大理: {
    climate: "highland",
    tips: ["高原紫外线强，防晒帽和防晒霜必备", "早晚温差大，随身带薄外套", "部分小店只收现金，提前备些零钱"],
    spots: [
      { name: "大理古城漫步", area: "古城", kidFriendly: true, intensity: 1, tags: ["人文", "夜游"] },
      { name: "人民路夜市", area: "古城", kidFriendly: true, intensity: 1, tags: ["美食", "夜游"] },
      { name: "洱海骑行", area: "洱海东岸", kidFriendly: true, intensity: 2, tags: ["自然", "户外"] },
      { name: "喜洲古镇", area: "洱海西岸", kidFriendly: true, intensity: 1, tags: ["人文", "美食"] },
      { name: "双廊看日落", area: "洱海东岸", kidFriendly: true, intensity: 1, tags: ["自然"] },
      { name: "苍山索道", area: "苍山", kidFriendly: true, intensity: 2, tags: ["自然"] },
      { name: "洗马潭步道", area: "苍山", kidFriendly: false, intensity: 3, tags: ["徒步"] },
      { name: "沙溪古镇", area: "剑川", kidFriendly: true, intensity: 2, tags: ["人文"] },
      { name: "扎染体验", area: "周城", kidFriendly: true, intensity: 1, tags: ["手作", "亲子"] },
    ],
  },
  成都: {
    climate: "inland",
    tips: ["夏季闷热多雨，带一把轻便雨伞", "熊猫基地建议一早前往", "地铁覆盖广，市区尽量不自驾"],
    spots: [
      { name: "大熊猫繁育基地", area: "北三环", kidFriendly: true, intensity: 2, tags: ["亲子", "自然"] },
      { name: "宽窄巷子", area: "青羊", kidFriendly: true, intensity: 1, tags: ["人文", "美食"] },
      { name: "武侯祠与锦里", area: "武侯", kidFriendly: true, intensity: 1, tags: ["人文"] },
      { name: "杜甫草堂", area: "青羊", kidFriendly: true, intensity: 1, tags: ["人文"] },
      { name: "都江堰", area: "都江堰", kidFriendly: true, intensity: 2, tags: ["人文", "自然"] },
      { name: "川剧变脸", area: "市区", kidFriendly: true, intensity: 1, tags: ["演出"] },
      { name: "青城山前山", area: "都江堰", kidFriendly: false, intensity: 3, tags: ["徒步"] },
    ],
  },
  三亚: {
    climate: "coastal",
    tips: ["紫外线极强，防晒每两小时补一次", "海边活动注意涨落潮时间", "台风季关注航班动态"],
    spots: [
      { name: "亚龙湾沙滩", area: "亚龙湾", kidFriendly: true, intensity: 1, tags: ["海滨", "亲子"] },
      { name: "蜈支洲岛", area: "海棠湾", kidFriendly: true, intensity: 2, tags: ["海滨", "水上"] },
      { name: "南山文化园", area: "崖州", kidFriendly: true, intensity: 2, tags: ["人文"] },
      { name: "亚特兰蒂斯水世界", area: "海棠湾", kidFriendly: true, intensity: 2, tags: ["亲子", "水上"] },
      { name: "第一市场海鲜", area: "市区", kidFriendly: true, intensity: 1, tags: ["美食"] },
    ],
  },
  北京: {
    climate: "inland",
    tips: ["热门景点务必提前实名预约", "夏季正午暴晒，中午安排室内", "地铁换乘距离长，预留时间"],
    spots: [
      { name: "故宫", area: "东城", kidFriendly: true, intensity: 3, tags: ["人文"] },
      { name: "天安门广场", area: "东城", kidFriendly: true, intensity: 1, tags: ["人文"] },
      { name: "八达岭长城", area: "延庆", kidFriendly: false, intensity: 3, tags: ["徒步", "人文"] },
      { name: "颐和园", area: "海淀", kidFriendly: true, intensity: 2, tags: ["人文", "自然"] },
      { name: "国家博物馆", area: "东城", kidFriendly: true, intensity: 2, tags: ["人文", "室内"] },
      { name: "南锣鼓巷", area: "东城", kidFriendly: true, intensity: 1, tags: ["人文", "美食"] },
      { name: "中国科技馆", area: "朝阳", kidFriendly: true, intensity: 2, tags: ["亲子", "室内"] },
    ],
  },
  厦门: {
    climate: "coastal",
    tips: ["鼓浪屿需提前订船票", "台风季关注天气", "环岛路适合骑行，注意防晒"],
    spots: [
      { name: "鼓浪屿", area: "鼓浪屿", kidFriendly: true, intensity: 2, tags: ["人文", "海滨"] },
      { name: "环岛路骑行", area: "思明", kidFriendly: true, intensity: 2, tags: ["户外"] },
      { name: "厦门大学周边", area: "思明", kidFriendly: true, intensity: 1, tags: ["人文"] },
      { name: "曾厝垵", area: "思明", kidFriendly: true, intensity: 1, tags: ["美食"] },
      { name: "南普陀寺", area: "思明", kidFriendly: true, intensity: 1, tags: ["人文"] },
    ],
  },
};

const PACE_ACTIVITIES: Record<Pace, number> = { relaxed: 2, balanced: 3, packed: 4 };

// ---------------------------------------------------------------
// 行李清单规则
// ---------------------------------------------------------------
const BASE_DOCUMENTS = ["身份证", "机票/车票确认单", "酒店预订单", "常用银行卡"];
const BASE_OTHER = ["充电宝", "充电线与插头", "常用药", "洗漱包", "纸巾湿巾"];

const CLIMATE_EXTRA: Record<Destination["climate"], { clothing: string[]; other: string[] }> = {
  highland: { clothing: ["薄外套（早晚温差）", "长裤"], other: ["高倍防晒霜", "遮阳帽", "润唇膏"] },
  coastal: { clothing: ["泳衣", "沙滩鞋", "速干衣"], other: ["防水手机袋", "高倍防晒霜", "防晒衣"] },
  inland: { clothing: ["透气短袖", "舒适步行鞋"], other: ["折叠伞", "驱蚊液"] },
  cold: { clothing: ["羽绒服", "保暖内衣", "手套围巾"], other: ["暖宝宝", "保湿霜"] },
};

function buildChecklist(
  days: number,
  climate: Destination["climate"],
  hasKid: boolean,
  hasElder: boolean,
  spots: Spot[]
): TravelChecklist {
  const clothing = new Set<string>(CLIMATE_EXTRA[climate].clothing);
  const other = new Set<string>([...BASE_OTHER, ...CLIMATE_EXTRA[climate].other]);

  // 衣物件数按天数推：短途 days+1，长途打八折避免过量
  const tops = days <= 4 ? days + 1 : Math.ceil(days * 0.8) + 1;
  clothing.add(`上衣 ${tops} 件`);
  clothing.add(`内衣袜子 ${days + 1} 套`);
  if (days >= 5) other.add("小包洗衣液");

  if (spots.some((s) => s.tags.includes("徒步"))) clothing.add("徒步鞋/防滑鞋");
  if (spots.some((s) => s.tags.includes("水上") || s.tags.includes("海滨"))) clothing.add("速干毛巾");
  if (spots.some((s) => s.tags.includes("演出") || s.tags.includes("人文"))) other.add("景点预约二维码截图");

  const kids: string[] = [];
  if (hasKid) {
    kids.push("儿童防晒霜", "儿童墨镜/遮阳帽", "常备儿童药（退热、肠胃）", "换洗衣物 2 套备用", "打发时间的小玩具/绘本");
    if (climate === "coastal") kids.push("儿童泳衣与浮具");
    if (days >= 4) kids.push("儿童保温杯");
  }
  if (hasElder) {
    other.add("长辈日常用药（按天分装）");
    other.add("血压计（如需）");
    clothing.add("长辈舒适防滑鞋");
  }

  const toItems = (arr: Iterable<string>): ChecklistItem[] =>
    Array.from(arr).map((name) => ({ name, done: false }));

  return {
    documents: toItems(hasKid ? [...BASE_DOCUMENTS, "儿童户口本/身份证"] : BASE_DOCUMENTS),
    clothing: toItems(clothing),
    kids: toItems(kids),
    other: toItems(other),
  };
}

// ---------------------------------------------------------------
// 行程骨架
// ---------------------------------------------------------------
function buildItinerary(
  destination: string,
  days: number,
  pace: Pace,
  hasKid: boolean,
  hasElder: boolean,
  dest?: Destination
): { days: ItineraryDay[]; tips: string[]; usedSpots: Spot[] } {
  const perDay = PACE_ACTIVITIES[pace];
  const out: ItineraryDay[] = [];
  const used: Spot[] = [];

  // 候选池：有孩子过滤高强度、有老人再降一档；按片区分组以保证动线
  let pool = (dest?.spots ?? []).filter((s) => (hasKid ? s.intensity <= 2 || !s.tags.includes("徒步") : true));
  if (hasElder) pool = pool.filter((s) => s.intensity <= 2);

  const byArea = new Map<string, Spot[]>();
  for (const s of pool) {
    const arr = byArea.get(s.area) ?? [];
    arr.push(s);
    byArea.set(s.area, arr);
  }
  const areas = [...byArea.keys()];

  for (let d = 1; d <= days; d++) {
    const isFirst = d === 1;
    const isLast = d === days && days > 1;
    // 首尾日活动量减半，留出交通缓冲
    const slots = isFirst || isLast ? Math.max(1, perDay - 1) : perDay;

    const activities: string[] = [];
    if (isFirst) activities.push("抵达 · 入住办理");
    // 每天尽量取同一片区，减少折返
    const area = areas.length ? areas[(d - 1) % areas.length] : undefined;
    const areaSpots = area ? (byArea.get(area) ?? []).filter((s) => !used.includes(s)) : [];
    for (const s of areaSpots) {
      if (activities.length >= slots) break;
      activities.push(s.name);
      used.push(s);
    }
    // 片区内不够就从剩余池补
    if (activities.length < slots) {
      for (const s of pool) {
        if (activities.length >= slots) break;
        if (used.includes(s)) continue;
        activities.push(s.name);
        used.push(s);
      }
    }
    if (isLast) activities.push("采购伴手礼 · 返程");
    if (!activities.length) activities.push(`${destination}自由安排（待补充）`);
    if (hasKid && !isFirst && !isLast) activities.push("午后回酒店休息 1 小时");

    const title = isFirst ? `抵达${destination}` : isLast ? "返程日" : area ? `${area}一日` : `第${d}天`;
    out.push({
      day: d,
      title: title.slice(0, 10),
      activities,
      area,
      note: isFirst ? "预留交通延误缓冲" : isLast ? "按航班/车次倒推离店时间" : undefined,
    });
  }

  const tips = [...(dest?.tips ?? [])];
  if (hasKid) tips.push("每天留一段室内或休息时间，避免孩子过度疲劳");
  if (hasElder) tips.push("避开需要长时间爬坡的行程，随身带长辈常用药");
  if (!dest) tips.push("该目的地暂无内置资料，景点需手动补充或开启 AI 生成");

  return { days: out, tips, usedSpots: used };
}

// ---------------------------------------------------------------
// 预算拆分
// ---------------------------------------------------------------
const BUDGET_SPLIT: [string, number][] = [
  ["交通", 0.35], ["住宿", 0.3], ["餐饮", 0.2], ["门票与活动", 0.1], ["机动", 0.05],
];

// ---------------------------------------------------------------
// 主生成（本地）
// ---------------------------------------------------------------
export function generateTravelLocal(input: TravelInput): EngineResult<TravelDraft> {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const pace = input.pace ?? "balanced";

  const travelers = input.travelers ?? [];
  const hasKid = travelers.some((t) => t.role === "child" || (t.age ?? 99) < 14);
  const hasElder = travelers.some((t) => t.role === "parent" || (t.age ?? 0) >= 65);
  const headcount = travelers.length || 1;

  const destKey = Object.keys(DESTINATIONS).find((k) => input.destination.includes(k));
  const dest = destKey ? DESTINATIONS[destKey] : undefined;
  const climate = dest?.climate ?? "inland";

  const { days: itineraryDays, tips, usedSpots } = buildItinerary(input.destination, days, pace, hasKid, hasElder, dest);
  const checklist = buildChecklist(days, climate, hasKid, hasElder, usedSpots);

  const warnings: string[] = [];
  if (!dest) warnings.push(`「${input.destination}」不在内置资料库中，行程为通用骨架，建议开启 AI 生成或手动补充`);
  if (days > 10) warnings.push("行程超过 10 天，建议拆成两段分别规划");
  if (hasElder && pace === "packed") warnings.push("有长辈同行时不建议使用紧凑节奏");

  let budgetBreakdown: TravelDraft["budgetBreakdown"] = null;
  let perPersonPerDay: number | null = null;
  if (input.budget && input.budget > 0) {
    budgetBreakdown = BUDGET_SPLIT.map(([label, pct]) => ({
      label,
      amount: Math.round(input.budget! * pct),
      pct: pct * 100,
    }));
    perPersonPerDay = Math.round(input.budget / headcount / days);
    if (perPersonPerDay < 300) warnings.push(`人均每天约 ¥${perPersonPerDay}，国内游偏紧，建议复核预算`);
    if (perPersonPerDay > 3000) warnings.push(`人均每天约 ¥${perPersonPerDay}，预算宽裕，可考虑升级住宿或增加体验项目`);
  }

  const reasons = [
    `${days} 天 ${headcount} 人，节奏「${pace === "relaxed" ? "轻松" : pace === "packed" ? "紧凑" : "均衡"}」`,
    dest ? `按片区聚合动线，共安排 ${usedSpots.length} 个点位` : "使用通用骨架（无内置目的地资料）",
    hasKid ? "已按亲子出行调整强度并生成儿童清单" : "未检测到儿童同行",
  ];
  if (hasElder) reasons.push("已过滤高强度徒步类行程");

  return ok<TravelDraft>(
    {
      destination: input.destination,
      days,
      itinerary: { days: itineraryDays, tips },
      checklist,
      budgetBreakdown,
      perPersonPerDay,
      warnings,
    },
    { version: TRAVEL_VERSION, confidence: dest ? 0.7 : 0.35, reasons, source: "local" }
  );
}

// ---------------------------------------------------------------
// LLM 生成：在本地骨架上填真实景点
// ---------------------------------------------------------------
interface LLMTravel {
  days: ItineraryDay[];
  tips: string[];
  checklistExtra?: { clothing?: string[]; kids?: string[]; other?: string[] };
}

export async function generateTravel(input: TravelInput): Promise<EngineResult<TravelDraft>> {
  const local = generateTravelLocal(input);
  const d = local.data;

  const travelers = input.travelers ?? [];
  const travelerDesc = travelers.length
    ? travelers.map((t) => `${t.name}(${t.role === "child" ? "儿童" : t.role === "parent" ? "长辈" : "成人"}${t.age ? ` ${t.age}岁` : ""})`).join("、")
    : "1 位成人";

  const env = await callAI<Parameters<typeof TRAVEL_ITINERARY.build>[0], LLMTravel>(TRAVEL_ITINERARY, {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    days: d.days,
    travelers: travelerDesc,
    budget: input.budget,
    preferences: input.preferences ?? [],
    pace: input.pace ?? "balanced",
    skeleton: d.itinerary.days.map((x) => `D${x.day} ${x.title}：${x.activities.join("、")}`).join("\n"),
  });
  if (!env?.result?.days?.length) return { ...local, degraded: true };

  // 天数必须与本地骨架一致，多余的截断、缺的用本地补
  const merged: ItineraryDay[] = d.itinerary.days.map((skeleton, i) => {
    const ai = env.result.days[i];
    if (!ai?.activities?.length) return skeleton;
    return {
      day: skeleton.day,
      title: (ai.title || skeleton.title).slice(0, 10),
      activities: ai.activities.slice(0, 6),
      area: ai.area ?? skeleton.area,
      note: ai.note ?? skeleton.note,
    };
  });

  const extra = env.result.checklistExtra ?? {};
  const addAll = (base: ChecklistItem[], names?: string[]): ChecklistItem[] => {
    if (!names?.length) return base;
    const seen = new Set(base.map((b) => b.name));
    return [...base, ...names.filter((n) => !seen.has(n)).map((name) => ({ name, done: false }))];
  };

  return ok<TravelDraft>(
    {
      ...d,
      itinerary: { days: merged, tips: env.result.tips?.length ? env.result.tips : d.itinerary.tips },
      checklist: {
        ...d.checklist,
        clothing: addAll(d.checklist.clothing, extra.clothing),
        kids: addAll(d.checklist.kids, extra.kids),
        other: addAll(d.checklist.other, extra.other),
      },
      warnings: d.warnings.filter((w) => !w.includes("不在内置资料库")),
    },
    { version: TRAVEL_VERSION, confidence: 0.85, reasons: [...local.reasons, ...env.reasoning.slice(0, 2)], source: "hybrid" }
  );
}

/** 生成结果 → 可写库的 TravelPlan（字段与现有 UI 完全兼容） */
export function toTravelPlan(draft: TravelDraft, input: TravelInput, userId: string): Omit<TravelPlan, "id"> {
  return {
    user_id: userId,
    destination: draft.destination,
    start_date: input.startDate,
    end_date: input.endDate,
    status: "planning",
    itinerary: draft.itinerary as Record<string, unknown>,
    checklist: draft.checklist as unknown as Record<string, unknown>,
    budget: input.budget,
    notes: draft.itinerary.tips.join("；"),
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------
// 归一化 —— 数据库里的 itinerary / checklist 是 JSON 列，可能是 null、
// 可能只有一半字段（用户刚建计划还没生成行程）。mock 数据永远是完整的，
// 所以这些空值只有接了真实数据库才会暴露。以下三个函数负责兜住。
// ---------------------------------------------------------------

const EMPTY_CHECKLIST: TravelChecklist = { documents: [], clothing: [], kids: [], other: [] };

/** 任何形状的输入都转成完整的 TravelChecklist，缺的分组补空数组 */
export function normalizeChecklist(input: unknown): TravelChecklist {
  if (!input || typeof input !== "object") return { ...EMPTY_CHECKLIST };
  const src = input as Record<string, unknown>;
  const pick = (k: keyof TravelChecklist): ChecklistItem[] => {
    const v = src[k];
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
      .map((x) => ({ name: String(x.name ?? ""), done: Boolean(x.done) }))
      .filter((x) => x.name);
  };
  return { documents: pick("documents"), clothing: pick("clothing"), kids: pick("kids"), other: pick("other") };
}

/** 同上，兜住 itinerary 为 null / 缺 days / days 不是数组的情况 */
export function normalizeItinerary(input: unknown): { days: ItineraryDay[]; tips: string[] } {
  if (!input || typeof input !== "object") return { days: [], tips: [] };
  const src = input as Record<string, unknown>;
  const days = Array.isArray(src.days)
    ? src.days
        .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
        .map((d, i) => ({
          day: typeof d.day === "number" ? d.day : i + 1,
          title: String(d.title ?? `第${i + 1}天`),
          activities: Array.isArray(d.activities) ? d.activities.map(String) : [],
          area: typeof d.area === "string" ? d.area : undefined,
          note: typeof d.note === "string" ? d.note : undefined,
        }))
    : [];
  const tips = Array.isArray(src.tips) ? src.tips.map(String) : [];
  return { days, tips };
}

/**
 * 清单完成度，供 UI 上的「准备进度」条使用。
 * 入参放宽到 unknown —— 组件拿到的是数据库 JSON 列，形状不保证。
 */
export function checklistProgress(checklist: unknown): { done: number; total: number; pct: number } {
  const c = normalizeChecklist(checklist);
  const all = [...c.documents, ...c.clothing, ...c.kids, ...c.other];
  const done = all.filter((i) => i.done).length;
  return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
}

/**
 * 从计划列表里挑出「即将出行」的那一个。
 * 组件原来用 items[0] 撞运气 —— 数据库不保证顺序，撞到哪条算哪条。
 * 规则：优先最近的一次未来行程；全是过去的行程就取最近结束的那次。
 */
export function pickUpcomingTrip<T extends { start_date: string; end_date?: string }>(
  plans: T[],
  now = new Date()
): T | undefined {
  if (!plans?.length) return undefined;
  const today = now.toISOString().slice(0, 10);
  const future = plans
    .filter((p) => (p.end_date ?? p.start_date) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (future.length) return future[0];
  return [...plans].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}
