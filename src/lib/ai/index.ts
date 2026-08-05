// ================================================================
// AI 管线统一出口
// UI 层只从这里 import，引擎内部实现可以随时替换。
// ================================================================

export * from "./types";
export * from "./prompts";
export { callAI, isAIEnabled, setAIEnabled, clearAICache, extractJSON } from "./client";

// 1. 收件箱意图解析
export { parseIntent, parseIntentLocal, toInboxItem, parseChineseDate, parseAmount, inferPriority, INTENT_VERSION } from "./intent";
export type { IntentResult, IntentEntities } from "./intent";

// 2. 内容评分
export { rankContent, rankContentLocal, scoreContent, diversify, inferCategory, CONTENT_VERSION } from "./content";
export type { ScoredContent, UserContext, RankOptions, Verdict } from "./content";

// 3. 穿搭推荐
export { recommendOutfits, recommendOutfitsLocal, toOutfit, seasonOf, planSlots, warmthOf, resolveColor, pairColorScore, OUTFIT_VERSION } from "./outfit";
export type { OutfitCandidate, OutfitContext, Occasion } from "./outfit";

// 4. 理财分析
export { analyzeFinance, analyzeFinanceWithAI, categorizeTransaction, reclassify, CATEGORY_ZH, FINANCE_VERSION } from "./finance";
export type { FinanceAnalysis, CategoryStat, Anomaly, GoalProjection, AnalyzeOptions, CategoryGuess } from "./finance";

// 5. 孩子成长
export { analyzeGrowth, analyzeGrowthWithAI, GROWTH_DISCLAIMER, GROWTH_VERSION } from "./growth";
export type { GrowthReport, MetricTrend, SubjectTrend, VisionTrend } from "./growth";

// 8. 工作驾驶舱
export { buildCockpit, sortOutputs, cardSubtitle, normalizeBrief, normalizeApproval, normalizeMessage, normalizeReport, COCKPIT_VERSION } from "./cockpit";
export type { CockpitView, CockpitSection, CockpitOptions, BriefDetail, ApprovalDetail, MessageDetail, ReportDetail } from "./cockpit";

// 7. 主动建议聚合
export { buildSuggestions, SUGGESTIONS_VERSION } from "./suggestions";
export type { SuggestionInput } from "./suggestions";

// 6. 旅行攻略
export { generateTravel, generateTravelLocal, toTravelPlan, checklistProgress, normalizeChecklist, normalizeItinerary, pickUpcomingTrip, DESTINATIONS, TRAVEL_VERSION } from "./travel";
export type { TravelDraft, TravelInput, ItineraryDay, TravelChecklist, ChecklistItem, Pace } from "./travel";
