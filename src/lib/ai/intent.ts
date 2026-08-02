// ================================================================
// 任务 1：AI 收件箱意图解析引擎
// ----------------------------------------------------------------
// 四层管线（越往后成本越高，前面能定就不往后走）：
//   L0 显式前缀   —— UI 快捷 chip 注入的「添加任务：」等，直接命中
//   L1 加权词典   —— 中文关键词 + 正则模式打分，得出四类得分
//   L2 实体抽取   —— 日期 / 金额 / 数量 / 人名 / 标签，用于优先级与后续动作
//   L3 LLM 复核   —— 仅在"模糊"时触发（top1 与 top2 差距过小 / 总分过低）
// 目标：90% 的输入在 L1+L2 就能定，且 0 延迟、0 成本。
// ================================================================

import type { InboxCategory, InboxItem } from "@/types";
import { INBOX_INTENT } from "./prompts";
import { callAI } from "./client";
import { ok, clamp01, type EngineResult } from "./types";

export const INTENT_VERSION = "1.0.0";

export interface IntentEntities {
  /** ISO yyyy-mm-dd */
  dueDate?: string;
  /** 原始时间表述，如「下周一」 */
  dueDateRaw?: string;
  amount?: number;
  quantity?: number;
  people: string[];
  tags: string[];
}

export interface IntentResult {
  category: InboxCategory;
  priority: InboxItem["priority"];
  /** 归一化短标题（去掉前缀、截断） */
  title: string;
  /** 去掉快捷前缀后的正文 */
  normalizedContent: string;
  scores: Record<InboxCategory, number>;
  entities: IntentEntities;
  suggestedActions: string[];
  /** 规则层判定模糊，建议交给 LLM */
  ambiguous: boolean;
}

// ---------------------------------------------------------------
// L0：UI 快捷前缀
// ---------------------------------------------------------------
const PREFIX_MAP: { re: RegExp; category: InboxCategory }[] = [
  { re: /^(添加任务|新建任务|任务)[:：]\s*/, category: "task" },
  { re: /^(想买|要买|购物)[:：]\s*/, category: "shopping" },
  { re: /^(记录一个灵感|灵感|想法)[:：]\s*/, category: "inspiration" },
  { re: /^(帮我调研|帮我|AI)[:：]\s*/, category: "ai_processing" },
];

// ---------------------------------------------------------------
// L1：加权词典
// 权重设计：3 = 强判别词（几乎单独可定类）；2 = 中等；1 = 弱信号
// ---------------------------------------------------------------
type Lexicon = { w: number; words: string[] }[];

const LEX: Record<InboxCategory, Lexicon> = {
  ai_processing: [
    { w: 3, words: ["帮我调研", "帮我查", "帮我整理", "帮我分析", "帮我对比", "帮我写", "帮我生成", "帮我总结", "帮我找", "帮我规划", "帮我安排"] },
    { w: 3, words: ["调研", "对比一下", "整理一份", "生成一份", "写一份", "写一篇", "出个方案", "做个方案"] },
    { w: 2, words: ["分析", "总结", "梳理", "汇总", "搜一下", "查一下", "了解一下", "推荐几个", "有哪些"] },
    { w: 1, words: ["方案", "报告", "清单", "攻略"] },
  ],
  shopping: [
    { w: 3, words: ["想买", "要买", "买一", "买个", "买双", "买台", "买瓶", "入手", "下单", "剁手", "种草"] },
    { w: 2, words: ["购买", "采购", "补货", "囤", "加购", "购物车"] },
    { w: 1, words: ["多少钱", "性价比", "哪个牌子", "旗舰店", "优惠", "券"] },
  ],
  task: [
    { w: 3, words: ["要完成", "需要完成", "记得", "别忘", "务必", "截止", "deadline", "提交", "上交"] },
    { w: 2, words: ["准备", "安排", "预约", "联系", "确认", "跟进", "开会", "汇报", "报销", "办理", "缴", "交费", "接送", "打印", "签字", "回复"] },
    { w: 1, words: ["任务", "待办", "计划", "做完", "处理"] },
  ],
  inspiration: [
    { w: 3, words: ["如果做", "有个想法", "突然想到", "灵感", "idea", "感觉可以", "或许可以", "值得思考"] },
    { w: 2, words: ["关注", "留意", "有意思", "不错的思路", "值得研究", "以后可以"] },
    { w: 1, words: ["也许", "可能", "思考", "启发", "观点"] },
  ],
};

/** 结构性正则加分：比单词更强的信号 */
const PATTERNS: { re: RegExp; category: InboxCategory; w: number }[] = [
  { re: /帮我.{0,6}(调研|查|找|整理|分析|对比|写|生成|规划|安排|总结)/, category: "ai_processing", w: 4 },
  { re: /(买|入手).{0,10}(鞋|衣|机|包|本|书|车|水|药|奶|米|卡|票)/, category: "shopping", w: 3 },
  { re: /(下周|本周|明天|后天|今天|周[一二三四五六日天])[^。？]{0,12}(要|需要|准备|开|交|去|完成|提交)/, category: "task", w: 3 },
  { re: /^如果|^假如|^要是/, category: "inspiration", w: 2 },
  { re: /[?？]$/, category: "ai_processing", w: 1 },
];

const CATEGORIES: InboxCategory[] = ["task", "shopping", "inspiration", "ai_processing"];

// ---------------------------------------------------------------
// L2：实体抽取
// ---------------------------------------------------------------

const WEEKDAY: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };

function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 中文相对/绝对日期解析。命中返回 { iso, raw }，否则 null */
export function parseChineseDate(text: string, now = new Date()): { iso: string; raw: string } | null {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };

  // 绝对日期：8月5日 / 8/5 / 2026-08-05
  let m = text.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (m) return { iso: toISO(new Date(+m[1], +m[2] - 1, +m[3])), raw: m[0] };
  m = text.match(/(\d{1,2})[月/](\d{1,2})[日号]?/);
  if (m) {
    const mo = +m[1] - 1;
    const day = +m[2];
    let y = now.getFullYear();
    const cand = new Date(y, mo, day);
    if (cand.getTime() < base.getTime() - 86400000 * 30) y += 1; // 明显过期则认为是明年
    return { iso: toISO(new Date(y, mo, day)), raw: m[0] };
  }

  // 相对日：今天/明天/后天/大后天
  for (const [k, v] of [["大后天", 3], ["后天", 2], ["明天", 1], ["今天", 0], ["今晚", 0]] as const) {
    if (text.includes(k)) return { iso: toISO(shift(v)), raw: k };
  }

  // N天后 / N天内
  m = text.match(/(\d{1,2})\s*天(后|内)/);
  if (m) return { iso: toISO(shift(+m[1])), raw: m[0] };

  // 周X / 下周X / 下下周X
  m = text.match(/(下下周|下周|本周|这周)?周([一二三四五六日天])/);
  if (m) {
    const target = WEEKDAY[m[2]];
    const cur = base.getDay();
    const scope = m[1];
    // 以「本周一」为锚点计算，避免周日/周一跨周歧义
    const mondayOffset = (cur === 0 ? -6 : 1 - cur); // 本周一相对今天的偏移
    const inWeek = (target === 0 ? 6 : target - 1); // 周一=0 ... 周日=6
    let delta: number;
    if (scope === "下周") delta = mondayOffset + 7 + inWeek;
    else if (scope === "下下周") delta = mondayOffset + 14 + inWeek;
    else if (scope === "本周" || scope === "这周") delta = mondayOffset + inWeek;
    else {
      delta = (target - cur + 7) % 7;
      if (delta === 0) delta = 7; // 光说「周三」且今天就是周三 → 下一个周三
    }
    return { iso: toISO(shift(delta)), raw: m[0] };
  }

  if (/下个?月/.test(text)) {
    const d = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
    return { iso: toISO(d), raw: "下个月" };
  }
  return null;
}

/** 金额：¥2800 / 2800元 / 2.8万 */
export function parseAmount(text: string): number | undefined {
  let m = text.match(/(?:¥|￥|RMB)\s*([\d,]+(?:\.\d+)?)/);
  if (m) return Number(m[1].replace(/,/g, ""));
  m = text.match(/([\d,]+(?:\.\d+)?)\s*(万元|万|元|块|块钱)/);
  if (m) {
    const n = Number(m[1].replace(/,/g, ""));
    return m[2].startsWith("万") ? n * 10000 : n;
  }
  return undefined;
}

function parseQuantity(text: string): number | undefined {
  const m = text.match(/([一二两三四五六七八九十\d]+)\s*(双|个|台|件|瓶|盒|本|张|套|包|袋|条)/);
  if (!m) return undefined;
  const cn: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return cn[m[1]] ?? Number(m[1]) ?? undefined;
}

/** 已知家庭成员/常见同事称谓，避免误抽人名 */
const KNOWN_PEOPLE = ["朵朵", "小雅", "爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆", "老婆", "老公"];

function extractPeople(text: string): string[] {
  const hits = KNOWN_PEOPLE.filter((p) => text.includes(p));
  // 「张伟」这类两三字姓名 + 职务动词
  const m = text.match(/([一-龥]{2,3})(经理|主管|总监|老师|医生|同学)/g);
  if (m) hits.push(...m);
  return Array.from(new Set(hits));
}

const TAG_DICT: [RegExp, string][] = [
  [/汇报|PPT|会议|开会|述职/, "工作"],
  [/朵朵|孩子|学校|开学|作业|钢琴|幼儿园/, "孩子"],
  [/爸爸|妈妈|血压|药|体检|医院/, "家人健康"],
  [/旅行|行程|大理|机票|酒店|出游/, "旅行"],
  [/跑步|健身|运动|Keep/i, "运动"],
  [/英语|学习|阅读|课程/, "学习"],
  [/报销|预算|房贷|理财|存钱/, "财务"],
  [/AI|模型|编程|技术|Sora/i, "科技"],
];

function extractTags(text: string): string[] {
  return TAG_DICT.filter(([re]) => re.test(text)).map(([, t]) => t).slice(0, 3);
}

// ---------------------------------------------------------------
// 优先级推断
// ---------------------------------------------------------------
const URGENT_RE = /紧急|马上|立刻|立即|尽快|今天|今晚|务必|催|加急|deadline/i;
const LOW_RE = /有空|以后|将来|哪天|不着急|随便看看|留意|关注/;

export function inferPriority(
  text: string,
  category: InboxCategory,
  dueISO: string | undefined,
  now = new Date()
): InboxItem["priority"] {
  if (URGENT_RE.test(text)) return "high";
  if (dueISO) {
    const days = Math.ceil((new Date(dueISO + "T00:00:00").getTime() - now.getTime()) / 86400000);
    if (days <= 2) return "high";
    if (days <= 7) return "medium";
  }
  if (LOW_RE.test(text)) return "low";
  if (category === "inspiration") return "low";
  if (category === "task") return "medium";
  return "medium";
}

// ---------------------------------------------------------------
// 下一步动作建议（规则版）
// ---------------------------------------------------------------
function suggestActions(category: InboxCategory, e: IntentEntities, text: string): string[] {
  const out: string[] = [];
  switch (category) {
    case "task":
      out.push(e.dueDate ? `设 ${e.dueDate} 到期提醒` : "补一个截止日期");
      if (e.people.length) out.push(`同步给 ${e.people[0]}`);
      out.push("拆成 2~3 个子步骤");
      break;
    case "shopping":
      out.push("加入购物清单");
      if (!e.amount) out.push("设定预算上限");
      else out.push(`记 ${e.amount} 元到弹性支出`);
      if (/鞋|衣|裤|外套/.test(text)) out.push("检查衣柜是否已有同类");
      break;
    case "inspiration":
      out.push("归档到灵感库");
      if (e.tags.length) out.push(`打标签「${e.tags[0]}」`);
      out.push("一周后回顾是否仍成立");
      break;
    case "ai_processing":
      out.push("交给 AI 生成初稿");
      out.push("确认输出格式与深度");
      break;
  }
  return out.slice(0, 3);
}

// ---------------------------------------------------------------
// 主函数（同步，纯本地，0 延迟）
// ---------------------------------------------------------------
export function parseIntentLocal(raw: string, now = new Date()): EngineResult<IntentResult> {
  const original = raw.trim();
  let content = original;
  let forced: InboxCategory | null = null;

  for (const { re, category } of PREFIX_MAP) {
    if (re.test(content)) {
      forced = category;
      content = content.replace(re, "").trim();
      break;
    }
  }

  const scores: Record<InboxCategory, number> = { task: 0, shopping: 0, inspiration: 0, ai_processing: 0 };
  const hits: string[] = [];

  for (const cat of CATEGORIES) {
    for (const group of LEX[cat]) {
      for (const w of group.words) {
        if (content.includes(w)) {
          scores[cat] += group.w;
          if (group.w >= 2) hits.push(w);
        }
      }
    }
  }
  for (const p of PATTERNS) {
    if (p.re.test(content)) scores[p.category] += p.w;
  }

  // 实体
  const date = parseChineseDate(content, now);
  const entities: IntentEntities = {
    dueDate: date?.iso,
    dueDateRaw: date?.raw,
    amount: parseAmount(content),
    quantity: parseQuantity(content),
    people: extractPeople(content),
    tags: extractTags(content),
  };
  // 有明确时间点 → task 侧加分（但委托类不受影响）
  if (date && scores.ai_processing < 3) scores.task += 2;
  if (entities.amount && scores.shopping > 0) scores.shopping += 1;

  const ranked = CATEGORIES.map((c) => [c, scores[c]] as const).sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const secondScore = ranked[1][1];

  const category: InboxCategory = forced ?? (topScore === 0 ? "inspiration" : top);
  const ambiguous = !forced && (topScore < 2 || topScore - secondScore <= 1);

  const priority = inferPriority(content, category, entities.dueDate, now);
  const title = content.replace(/\s+/g, " ").slice(0, 14) + (content.length > 14 ? "…" : "");

  const confidence = forced ? 0.98 : clamp01(topScore === 0 ? 0.25 : (topScore - secondScore * 0.5) / 6);

  const reasons: string[] = [];
  if (forced) reasons.push("用户通过快捷入口显式指定了分类");
  else if (hits.length) reasons.push(`命中关键词：${hits.slice(0, 4).join("、")}`);
  else reasons.push("无强信号词，按默认归入灵感");
  if (entities.dueDateRaw) reasons.push(`识别到时间「${entities.dueDateRaw}」→ ${entities.dueDate}`);
  if (entities.amount) reasons.push(`识别到金额 ${entities.amount} 元`);
  if (ambiguous) reasons.push("类别区分度不足，建议交由模型复核");

  return ok<IntentResult>(
    {
      category,
      priority,
      title,
      normalizedContent: content,
      scores,
      entities,
      suggestedActions: suggestActions(category, entities, content),
      ambiguous,
    },
    { version: INTENT_VERSION, confidence, reasons, source: "local" }
  );
}

// ---------------------------------------------------------------
// L3：LLM 复核（仅在模糊时调用；失败自动降级）
// ---------------------------------------------------------------
interface LLMIntent {
  category: InboxCategory;
  priority: InboxItem["priority"];
  title: string;
  dueDate: string | null;
  amount: number | null;
  tags: string[];
  suggestedActions: string[];
}

export async function parseIntent(
  raw: string,
  opts: { now?: Date; forceAI?: boolean } = {}
): Promise<EngineResult<IntentResult>> {
  const now = opts.now ?? new Date();
  const local = parseIntentLocal(raw, now);
  if (!local.data.ambiguous && !opts.forceAI) return local;

  const env = await callAI<Parameters<typeof INBOX_INTENT.build>[0], LLMIntent>(INBOX_INTENT, {
    content: local.data.normalizedContent,
    ruleGuess: { category: local.data.category, scores: local.data.scores },
    now: now.toISOString(),
  });
  if (!env?.result) return { ...local, degraded: local.data.ambiguous };

  const r = env.result;
  const merged: IntentResult = {
    ...local.data,
    category: CATEGORIES.includes(r.category) ? r.category : local.data.category,
    priority: (["high", "medium", "low"] as const).includes(r.priority) ? r.priority : local.data.priority,
    title: r.title?.slice(0, 16) || local.data.title,
    entities: {
      ...local.data.entities,
      dueDate: r.dueDate ?? local.data.entities.dueDate,
      amount: r.amount ?? local.data.entities.amount,
      tags: r.tags?.length ? r.tags.slice(0, 3) : local.data.entities.tags,
    },
    suggestedActions: r.suggestedActions?.length ? r.suggestedActions.slice(0, 3) : local.data.suggestedActions,
    ambiguous: false,
  };

  return ok(merged, {
    version: INTENT_VERSION,
    confidence: 0.9,
    reasons: [...local.reasons, ...env.reasoning.slice(0, 3)],
    source: "hybrid",
  });
}

/** 便捷方法：解析结果 → 可直接 insert 的 InboxItem */
export function toInboxItem(res: IntentResult, userId: string): Omit<InboxItem, "id"> {
  const nowISO = new Date().toISOString();
  return {
    user_id: userId,
    content: res.normalizedContent,
    category: res.category,
    status: "pending",
    priority: res.priority,
    created_at: nowISO,
    updated_at: nowISO,
  };
}
