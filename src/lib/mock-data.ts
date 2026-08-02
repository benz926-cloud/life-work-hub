import type {
  InboxItem,
  WardrobeItem,
  FinanceRecord,
  HealthRecord,
  FamilyMember,
  CheckinHabit,
  CheckinRecord,
  Approval,
  Alert,
  WorkTask,
  KPIReport,
  ContentFeed,
  SavedContent,
  KnowledgeItem,
  SubscriptionRule,
  TravelPlan,
  SystemIntegration,
  ChildGrowthRecord,
  Outfit,
  SavingsGoal,
} from "@/types";

// ===== AI Inbox =====
export const mockInboxItems: InboxItem[] = [
  {
    id: "i1",
    content: "准备下周一部门汇报PPT，需要Q2数据",
    category: "task",
    status: "pending",
    priority: "high",
    user_id: "",
    created_at: "2026-08-02T09:00:00Z",
    updated_at: "2026-08-02T09:00:00Z",
  },
  {
    id: "i2",
    content: "买一双跑步鞋，Nike Pegasus或者亚瑟士",
    category: "shopping",
    status: "pending",
    priority: "medium",
    user_id: "",
    created_at: "2026-08-02T08:30:00Z",
    updated_at: "2026-08-02T08:30:00Z",
  },
  {
    id: "i3",
    content: "如果做一个AI穿搭App，核心功能应该是衣柜数字化+智能匹配",
    category: "inspiration",
    status: "pending",
    priority: "low",
    user_id: "",
    created_at: "2026-08-01T22:00:00Z",
    updated_at: "2026-08-01T22:00:00Z",
  },
  {
    id: "i4",
    content: "帮我调研大理5天4晚亲子游行程",
    category: "ai_processing",
    status: "completed",
    priority: "medium",
    user_id: "",
    ai_result: JSON.stringify({
      days: [
        { day: 1, title: "抵达大理", activities: ["接机入住", "大理古城漫步", "人民路夜市"] },
        { day: 2, title: "洱海环游", activities: ["洱海骑行", "喜洲古镇", "双廊日落"] },
        { day: 3, title: "苍山徒步", activities: ["索道上山", "洗马潭", "寂照庵斋饭"] },
        { day: 4, title: "沙溪古镇", activities: ["沙溪古镇", "茶马古道", "周五集市"] },
        { day: 5, title: "返程", activities: ["扎染体验", "购买伴手礼", "送机"] },
      ],
      tips: ["早晚温差大带外套", "防晒必备", "提前订洱海边民宿"],
    }),
    created_at: "2026-08-01T18:00:00Z",
    updated_at: "2026-08-02T08:00:00Z",
  },
  {
    id: "i5",
    content: "朵朵秋季开学需要准备的学习用品清单",
    category: "task",
    status: "pending",
    priority: "high",
    user_id: "",
    created_at: "2026-08-02T07:30:00Z",
    updated_at: "2026-08-02T07:30:00Z",
  },
  {
    id: "i6",
    content: "关注Sora视频生成技术最新进展",
    category: "inspiration",
    status: "pending",
    priority: "low",
    user_id: "",
    created_at: "2026-08-01T20:00:00Z",
    updated_at: "2026-08-01T20:00:00Z",
  },
];

// ===== Family Members =====
export const mockFamilyMembers: FamilyMember[] = [
  {
    id: "fm1",
    name: "林涛",
    role: "self",
    age: 35,
    user_id: "",
    health_conditions: [],
    created_at: "",
  },
  {
    id: "fm2",
    name: "小雅",
    role: "spouse",
    age: 33,
    user_id: "",
    health_conditions: [],
    created_at: "",
  },
  {
    id: "fm3",
    name: "朵朵",
    role: "child",
    age: 7,
    user_id: "",
    health_conditions: [],
    created_at: "",
  },
  {
    id: "fm4",
    name: "林爸爸",
    role: "parent",
    age: 68,
    user_id: "",
    health_conditions: ["高血压"],
    created_at: "",
  },
];

// ===== Health =====
export const mockHealthRecords: HealthRecord[] = [
  { id: "h1", user_id: "", family_member_id: "fm1", date: "2026-08-02", steps: 8432, sleep_hours: 7.2, heart_rate: 68, calories_burned: 2100, active_minutes: 45, source: "apple_health", created_at: "" },
  { id: "h2", user_id: "", family_member_id: "fm2", date: "2026-08-02", steps: 6210, sleep_hours: 7.8, heart_rate: 72, source: "apple_health", created_at: "" },
  { id: "h3", user_id: "", family_member_id: "fm4", date: "2026-08-02", steps: 3200, blood_pressure_systolic: 145, blood_pressure_diastolic: 92, blood_sugar: 6.2, source: "manual", created_at: "" },
];

// ===== Child Growth =====
export const mockGrowthRecords: ChildGrowthRecord[] = [
  {
    id: "g1",
    family_member_id: "fm3",
    date: "2026-08-01",
    height_cm: 122,
    weight_kg: 23,
    vision_left: 5.1,
    vision_right: 5.1,
    subject_scores: { "语文": 95, "数学": 88, "英语": 92, "钢琴": 3 },
    milestones: ["完成一年级", "钢琴3级备考"],
    created_at: "2026-08-01T08:00:00Z",
  },
  {
    id: "g2",
    family_member_id: "fm3",
    date: "2026-06-01",
    height_cm: 120,
    weight_kg: 22,
    subject_scores: { "语文": 93, "数学": 85, "英语": 90 },
    created_at: "2026-06-01T08:00:00Z",
  },
];

// ===== Checkins =====
export const mockHabits: CheckinHabit[] = [
  { id: "ch1", user_id: "", name: "Keep 晨跑 30min", category: "fitness", source: "keep", target_days_per_week: 5, active: true, created_at: "" },
  { id: "ch2", user_id: "", name: "多邻国英语学习", category: "learning", source: "duolingo", target_days_per_week: 7, active: true, created_at: "" },
  { id: "ch3", user_id: "", name: "贝壳英语单词打卡", category: "learning", source: "beike", target_days_per_week: 5, active: true, created_at: "" },
  { id: "ch4", user_id: "", name: "阅读30分钟", category: "learning", source: "manual", target_days_per_week: 7, active: true, created_at: "" },
];

export const mockCheckins: CheckinRecord[] = [
  { id: "ck1", user_id: "", habit_id: "ch1", date: "2026-08-02", completed: true, created_at: "" },
  { id: "ck2", user_id: "", habit_id: "ch2", date: "2026-08-02", completed: false, created_at: "" },
  { id: "ck3", user_id: "", habit_id: "ch3", date: "2026-08-02", completed: false, created_at: "" },
  { id: "ck4", user_id: "", habit_id: "ch4", date: "2026-08-02", completed: true, created_at: "" },
];

// ===== Work =====
export const mockApprovals: Approval[] = [
  { id: "a1", user_id: "", title: "请假审批 - 张伟", applicant: "张伟", source: "feishu", status: "pending", reason: "年假3天", due_date: "2026-08-03", created_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-01T10:00:00Z" },
  { id: "a2", user_id: "", title: "报销审批 - 李明", applicant: "李明", source: "feishu", status: "pending", amount: 2800, reason: "出差差旅费", due_date: "2026-08-02", created_at: "2026-07-31T14:00:00Z", updated_at: "2026-07-31T14:00:00Z" },
  { id: "a3", user_id: "", title: "采购审批 - 王芳", applicant: "王芳", source: "feishu", status: "pending", amount: 15000, reason: "办公设备采购", due_date: "2026-08-04", created_at: "2026-08-01T09:00:00Z", updated_at: "2026-08-01T09:00:00Z" },
  { id: "a4", user_id: "", title: "预算调整审批", applicant: "赵敏", source: "feishu", status: "approved", amount: 50000, reason: "Q3预算调整", created_at: "2026-07-30T11:00:00Z", updated_at: "2026-07-30T16:00:00Z" },
];

export const mockAlerts: Alert[] = [
  { id: "al1", user_id: "", title: "3号产线温度异常", description: "温度超过阈值85°C，当前: 89°C", level: "critical", source: "industry_platform", resolved: false, created_at: "2026-08-02T11:00:00Z" },
  { id: "al2", user_id: "", title: "数据库连接池使用率过高", description: "当前使用率92%，接近上限", level: "critical", source: "system", resolved: false, created_at: "2026-08-02T10:30:00Z" },
  { id: "al3", user_id: "", title: "王伟连续3天未打卡", description: "考勤异常，需确认", level: "warning", source: "feishu", resolved: false, created_at: "2026-08-02T09:00:00Z" },
  { id: "al4", user_id: "", title: "物流车辆延迟", description: "华东线预计延迟2小时", level: "warning", source: "industry_platform", resolved: false, created_at: "2026-08-02T08:00:00Z" },
  { id: "al5", user_id: "", title: "iTalent绩效评估截止提醒", description: "Q3评估截止日期: 8月15日", level: "info", source: "italent", resolved: false, created_at: "2026-08-01T18:00:00Z" },
];

export const mockWorkTasks: WorkTask[] = [
  { id: "wt1", user_id: "", title: "审查Q3产品路线图", status: "todo", priority: "urgent", assignee: "林涛", due_date: "2026-08-05", created_at: "", updated_at: "" },
  { id: "wt2", user_id: "", title: "完成产线智能化改造方案", status: "in_progress", priority: "normal", assignee: "林涛", due_date: "2026-08-10", created_at: "", updated_at: "" },
  { id: "wt3", user_id: "", title: "新员工入职培训材料准备", status: "in_progress", priority: "normal", assignee: "小雅", due_date: "2026-08-08", created_at: "", updated_at: "" },
  { id: "wt4", user_id: "", title: "供应商合同续签审核", status: "review", priority: "normal", assignee: "林涛", due_date: "2026-08-03", created_at: "", updated_at: "" },
  { id: "wt5", user_id: "", title: "上月财务报表汇总", status: "done", priority: "normal", assignee: "林涛", created_at: "", updated_at: "" },
  { id: "wt6", user_id: "", title: "Q3团队OKR设定", status: "done", priority: "normal", assignee: "林涛", created_at: "", updated_at: "" },
  { id: "wt7", user_id: "", title: "紧急：服务器扩容审批", status: "todo", priority: "urgent", assignee: "林涛", due_date: "2026-08-02", created_at: "", updated_at: "" },
];

export const mockKPIs: KPIReport[] = [
  { id: "kp1", user_id: "", name: "产线运行率", value: 96.8, unit: "%", trend: "up", change_percent: 1.2, period: "daily", source: "industry_platform", created_at: "" },
  { id: "kp2", user_id: "", name: "今日产量", value: 12840, unit: "件", trend: "up", change_percent: 3.5, period: "daily", source: "industry_platform", created_at: "" },
  { id: "kp3", user_id: "", name: "良品率", value: 99.2, unit: "%", trend: "stable", change_percent: 0, period: "daily", source: "industry_platform", created_at: "" },
  { id: "kp4", user_id: "", name: "今日能耗", value: 3420, unit: "kWh", trend: "down", change_percent: -5.2, period: "daily", source: "industry_platform", created_at: "" },
];

// ===== Wardrobe =====
export const mockWardrobeItems: WardrobeItem[] = [
  { id: "w1", user_id: "", name: "白色棉质T恤", type: "top", color: "white", season: ["spring", "summer"], style: ["casual"], created_at: "" },
  { id: "w2", user_id: "", name: "深蓝牛仔裤", type: "bottom", color: "navy", season: ["spring", "autumn", "winter"], style: ["casual"], created_at: "" },
  { id: "w3", user_id: "", name: "驼色大衣", type: "outerwear", color: "camel", season: ["autumn", "winter"], style: ["business", "casual"], created_at: "" },
  { id: "w4", user_id: "", name: "黑色西裤", type: "bottom", color: "black", season: ["spring", "autumn", "winter"], style: ["business"], created_at: "" },
  { id: "w5", user_id: "", name: "灰色卫衣", type: "top", color: "gray", season: ["spring", "autumn"], style: ["sport", "casual"], created_at: "" },
  { id: "w6", user_id: "", name: "白色运动鞋", type: "shoes", color: "white", season: ["spring", "summer", "autumn"], style: ["sport", "casual"], created_at: "" },
];

export const mockOutfits: Outfit[] = [
  { id: "o1", user_id: "", date: "2026-08-02", weather: "晴 32°C", temperature: 32, items: ["w1", "w2", "w6"], notes: "今日推荐", created_at: "" },
];

// ===== Finance =====
export const mockFinanceRecords: FinanceRecord[] = [
  { id: "f1", user_id: "", type: "expense", amount: 68, category: "food", description: "午餐外卖", date: "2026-08-01", created_at: "" },
  { id: "f2", user_id: "", type: "expense", amount: 200, category: "transport", description: "加油", date: "2026-08-01", created_at: "" },
  { id: "f3", user_id: "", type: "expense", amount: 520, category: "shopping", description: "朵朵书包文具", date: "2026-08-01", created_at: "" },
  { id: "f4", user_id: "", type: "expense", amount: 89, category: "food", description: "水果蔬菜", date: "2026-07-31", created_at: "" },
  { id: "f5", user_id: "", type: "expense", amount: 3800, category: "housing", description: "8月房贷", date: "2026-08-01", created_at: "" },
  { id: "f6", user_id: "", type: "income", amount: 30000, category: "other", description: "7月工资", date: "2026-07-31", created_at: "" },
];

export const mockSavingsGoals: SavingsGoal[] = [
  { id: "sg1", user_id: "", name: "大理旅行基金", target_amount: 15000, current_amount: 8000, deadline: "2026-08-10", created_at: "" },
  { id: "sg2", user_id: "", name: "应急储备金", target_amount: 50000, current_amount: 35000, created_at: "" },
];

// ===== Content =====
export const mockContentFeeds: ContentFeed[] = [
  { id: "cf1", user_id: "", title: "2024秋冬极简穿搭公式｜一衣多穿太实用了", url: "", platform: "xiaohongshu", author: "穿搭达人Lily", summary: "教你用10件基础款搭出30天不重样的秋冬穿搭", likes: 12500, comments: 830, published_at: "2026-08-01T12:00:00Z", fetched_at: "2026-08-02T10:00:00Z" },
  { id: "cf2", user_id: "", title: "【AI编程实战】用Cursor+Claude一小时搭建完整Web应用", url: "", platform: "bilibili", author: "技术派Leo", summary: "从零开始用AI工具搭建一个完整的任务管理应用", likes: 8500, comments: 1200, published_at: "2026-07-31T20:00:00Z", fetched_at: "2026-08-02T10:00:00Z" },
  { id: "cf3", user_id: "", title: "大理古城周边5个冷门但绝美的小众景点", url: "", platform: "xiaohongshu", author: "旅行日记", summary: "避开人挤人的热门景点，这些小众地才是大理的灵魂", likes: 32000, comments: 2100, published_at: "2026-08-01T08:00:00Z", fetched_at: "2026-08-02T10:00:00Z" },
  { id: "cf4", user_id: "", title: "30天英语口语逆袭计划｜每天15分钟就够了", url: "", platform: "youtube", author: "EnglishWithLucy", summary: "科学规划的30天英语口语提升方案", likes: 45000, comments: 1800, published_at: "2026-07-30T16:00:00Z", fetched_at: "2026-08-02T10:00:00Z" },
  { id: "cf5", user_id: "", title: "成都本地人推荐的10家苍蝇馆子", url: "", platform: "xiaohongshu", author: "吃货小分队", summary: "人均30-50元，成都最地道的美食地图", likes: 28000, comments: 3500, published_at: "2026-07-31T18:00:00Z", fetched_at: "2026-08-02T10:00:00Z" },
  { id: "cf6", user_id: "", title: "高血压患者的饮食黄金法则｜医生推荐", url: "", platform: "xiaohongshu", author: "健康生活家", summary: "内科医生总结的高血压饮食指南，给爸妈收藏", likes: 15000, comments: 920, published_at: "2026-08-01T10:00:00Z", fetched_at: "2026-08-02T10:00:00Z" },
];

export const mockSubscriptionRules: SubscriptionRule[] = [
  { id: "sr1", user_id: "", platform: "xiaohongshu", category: "fashion", keywords: ["穿搭", "极简", "OOTD"], active: true, created_at: "" },
  { id: "sr2", user_id: "", platform: "bilibili", category: "skill", keywords: ["AI", "编程", "效率工具"], active: true, created_at: "" },
  { id: "sr3", user_id: "", platform: "xiaohongshu", category: "travel", keywords: ["旅行攻略", "小众景点", "亲子游"], active: true, created_at: "" },
  { id: "sr4", user_id: "", platform: "youtube", category: "english", keywords: ["English", "英语学习", "口语"], active: true, created_at: "" },
  { id: "sr5", user_id: "", platform: "xiaohongshu", category: "health", keywords: ["健康", "养生", "膳食"], active: true, created_at: "" },
  { id: "sr6", user_id: "", platform: "xiaohongshu", category: "food", keywords: ["美食", "探店", "家常菜"], active: true, created_at: "" },
];

// ===== Travel =====
export const mockTravelPlans: TravelPlan[] = [
  {
    id: "tp1",
    user_id: "",
    destination: "大理",
    start_date: "2026-08-14",
    end_date: "2026-08-18",
    status: "planning",
    budget: 15000,
    itinerary: {
      days: [
        { day: 1, title: "抵达大理", activities: ["接机入住", "大理古城漫步", "人民路夜市"] },
        { day: 2, title: "洱海环游", activities: ["洱海骑行", "喜洲古镇", "双廊日落"] },
        { day: 3, title: "苍山徒步", activities: ["索道上山", "洗马潭", "寂照庵斋饭"] },
        { day: 4, title: "沙溪古镇", activities: ["沙溪古镇", "茶马古道", "周五集市"] },
        { day: 5, title: "返程", activities: ["扎染体验", "购买伴手礼", "送机"] },
      ],
    },
    checklist: {
      documents: [{ name: "身份证", done: true }, { name: "机票确认单", done: true }],
      clothing: [{ name: "轻薄外套", done: false }, { name: "运动鞋", done: true }],
      kids: [{ name: "朵朵防晒霜", done: false }, { name: "儿童墨镜", done: false }],
      other: [{ name: "充电宝", done: true }, { name: "常用药", done: false }],
    },
    notes: "带够现金，部分小店不支持手机支付",
    created_at: "2026-07-28T20:00:00Z",
  },
];

// ===== System Integrations =====
export const mockIntegrations: SystemIntegration[] = [
  { id: "si1", user_id: "", name: "feishu", connected: false, settings: {}, created_at: "" },
  { id: "si2", user_id: "", name: "industry_platform", connected: false, settings: {}, created_at: "" },
  { id: "si3", user_id: "", name: "italent", connected: false, settings: {}, created_at: "" },
  { id: "si4", user_id: "", name: "apple_health", connected: false, settings: {}, created_at: "" },
  { id: "si5", user_id: "", name: "keep", connected: false, settings: {}, created_at: "" },
  { id: "si6", user_id: "", name: "duolingo", connected: false, settings: {}, created_at: "" },
];

// ===== AI Suggestions =====
export interface AISuggestion {
  icon: string;
  title: string;
  detail: string;
  action: string;
}

export const mockAISuggestions: AISuggestion[] = [
  { icon: "💊", title: "爸爸的高血压药", detail: "硝苯地平预计3天后吃完，需要提前购买", action: "添加提醒" },
  { icon: "📚", title: "朵朵钢琴练习", detail: "本周练习时间比上周少40%，周末可以补一下", action: "查看详情" },
  { icon: "✈️", title: "大理旅行准备", detail: "距出发还有12天，行李清单还有5项未完成", action: "查看清单" },
  { icon: "⚠️", title: "3号产线温度异常", detail: "89°C超过85°C阈值，需要立即处理", action: "查看详情" },
];
