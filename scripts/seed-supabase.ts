#!/usr/bin/env npx tsx
/**
 * ================================================================
 * Supabase 播种脚本 —— 为 email 对应的用户填充演示数据
 * ================================================================
 *
 * 用法:
 *   export SUPABASE_URL=https://xxx.supabase.co
 *   export SUPABASE_SERVICE_KEY=eyJh...          # service_role key
 *   export SEED_EMAIL=your@email.com
 *
 *   npm i --no-save tsx
 *   npx tsx scripts/seed-supabase.ts --dry-run   # 预演
 *   npx tsx scripts/seed-supabase.ts             # 执行
 *
 * 幂等: 检查数据是否已存在，存在则跳过。
 * 清库重播: --force 标志（先删后插）。
 * ================================================================
 */

import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SEED_EMAIL = process.env.SEED_EMAIL;

// ================================================================
// 主流程
// ================================================================
async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY || !SEED_EMAIL) {
    console.error("❌ 缺少环境变量: SUPABASE_URL, SUPABASE_SERVICE_KEY, SEED_EMAIL");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🔍 查找用户: ${SEED_EMAIL}`);
  const { data: users } = await admin.auth.admin.listUsers();
  const u = (users as any)?.users?.find((x: any) => x.email === SEED_EMAIL);
  if (!u) {
    console.error("❌ 用户不存在。请先在应用中注册账号。");
    process.exit(1);
  }
  const user_id = u.id;
  console.log(`✅ 用户 ID: ${user_id}`);

  if (DRY) console.log("\n⚠️  DRY RUN 模式，不会实际写入。\n");
  if (FORCE) console.log("\n⚠️  FORCE 模式，将先删除已有数据再插入。\n");

  const db: any = dryWrapper(admin as any, DRY);

  // ---- profiles ----
  await ensureExists(db, "profiles", "id", user_id, async () => {
    console.log("  → profiles");
    return db.from("profiles").upsert(
      { id: user_id, email: SEED_EMAIL, name: "我自己" },
      { onConflict: "id" }
    );
  });

  // ---- family_members ----
  const fmIds: Record<string, string> = {};
  for (const fm of FAMILY_MEMBERS) {
    const key = `family_members.${fm.name}`;
    await ensureExistsBy(db, "family_members", "user_id", "name", [user_id, fm.name], async () => {
      console.log(`  → family_members: ${fm.name}`);
      const { data } = await db.from("family_members").insert({ user_id, ...fm }).select("id").single();
      if (data) fmIds[fm.name] = data.id;
      return { data, error: null };
    });
    if (!fmIds[fm.name]) {
      const { data: existing } = await admin
        .from("family_members")
        .select("id")
        .eq("user_id", user_id)
        .eq("name", fm.name)
        .single();
      if (existing) fmIds[fm.name] = existing.id;
    }
  }

  // ---- child_growth_records (依赖 family_members) ----
  for (const cg of CHILD_GROWTH) {
    const fmId = fmIds[cg.family_member_name];
    if (!fmId) continue;
    const key = `child_growth.${cg.family_member_name}.${cg.date}`;
    await ensureExistsBy(db, "child_growth_records", "family_member_id", "date", [fmId, cg.date], async () => {
      console.log(`  → child_growth: ${cg.family_member_name} ${cg.date}`);
      const { family_member_name, ...rest } = cg;
      return db.from("child_growth_records").insert({ family_member_id: fmId, ...rest });
    });
  }

  // ---- health_records ----
  for (const hr of HEALTH_RECORDS) {
    const key = `health.${hr.date}`;
    await ensureExistsBy(db, "health_records", "user_id", "date", [user_id, hr.date], async () => {
      console.log(`  → health_records: ${hr.date}`);
      return db.from("health_records").insert({ user_id, ...hr });
    });
  }

  // ---- inbox_items ----
  for (const item of INBOX_ITEMS) {
    const key = `inbox.${item.content.slice(0, 20)}`;
    await ensureExistsBy(db, "inbox_items", "user_id", "content", [user_id, item.content], async () => {
      console.log(`  → inbox: ${item.content.slice(0, 25)}`);
      return db.from("inbox_items").insert({ user_id, ...item });
    });
  }

  // ---- wardrobe_items ----
  const wiIds: Record<string, string> = {};
  for (const wi of WARDROBE) {
    const key = `wardrobe.${wi.name}`;
    await ensureExistsBy(db, "wardrobe_items", "user_id", "name", [user_id, wi.name], async () => {
      console.log(`  → wardrobe: ${wi.name}`);
      const { data } = await db.from("wardrobe_items").insert({ user_id, ...wi }).select("id").single();
      if (data) wiIds[wi.name] = data.id;
      return { data, error: null };
    });
    if (!wiIds[wi.name]) {
      const { data } = await admin.from("wardrobe_items")
        .select("id").eq("user_id", user_id).eq("name", wi.name).single();
      if (data) wiIds[wi.name] = data.id;
    }
  }

  // ---- outfits (依赖 wardrobe_items) ----
  for (const o of OUTFITS) {
    const key = `outfit.${o.date}`;
    await ensureExistsBy(db, "outfits", "user_id", "date", [user_id, o.date], async () => {
      console.log(`  → outfit: ${o.date} ${o.weather || ""}`);
      return db.from("outfits").insert({ user_id, ...o });
    });
  }

  // ---- finance_records ----
  for (const fr of FINANCE_RECORDS) {
    const key = `finance.${fr.date}.${fr.description}`;
    await ensureExistsBy(
      db, "finance_records", "user_id", "description",
      [user_id, fr.description],
      async () => db.from("finance_records").insert({ user_id, ...fr })
    );
  }

  // ---- savings_goals ----
  for (const sg of SAVINGS_GOALS) {
    await ensureExistsBy(db, "savings_goals", "user_id", "name", [user_id, sg.name], async () => {
      console.log(`  → savings: ${sg.name}`);
      return db.from("savings_goals").insert({ user_id, ...sg });
    });
  }

  // ---- checkin_habits ----
  const habitIds: Record<string, string> = {};
  for (const h of CHECKIN_HABITS) {
    await ensureExistsBy(db, "checkin_habits", "user_id", "name", [user_id, h.name], async () => {
      console.log(`  → habit: ${h.name}`);
      const { data } = await db.from("checkin_habits").insert({ user_id, ...h }).select("id").single();
      if (data) habitIds[h.name] = data.id;
      return { data, error: null };
    });
    if (!habitIds[h.name]) {
      const { data } = await admin.from("checkin_habits")
        .select("id").eq("user_id", user_id).eq("name", h.name).single();
      if (data) habitIds[h.name] = data.id;
    }
  }

  // ---- checkin_records (依赖 checkin_habits) ----
  for (const cr of CHECKIN_RECORDS) {
    const hId = habitIds[cr.habit_name];
    if (!hId) continue;
    const key = `checkin.${cr.habit_name}.${cr.date}`;
    await ensureExistsBy(db, "checkin_records", "user_id", "date", [user_id, cr.date], async () => {
      const { habit_name, ...rest } = cr;
      return db.from("checkin_records").insert({ user_id, habit_id: hId, ...rest });
    });
  }

  // ---- approvals ----
  for (const a of APPROVALS) {
    await ensureExistsBy(db, "approvals", "user_id", "title", [user_id, a.title], async () => {
      console.log(`  → approval: ${a.title}`);
      return db.from("approvals").insert({ user_id, ...a });
    });
  }

  // ---- alerts ----
  for (const a of ALERTS) {
    await ensureExistsBy(db, "alerts", "user_id", "title", [user_id, a.title], async () => {
      console.log(`  → alert: ${a.title}`);
      return db.from("alerts").insert({ user_id, ...a });
    });
  }

  // ---- work_tasks ----
  for (const wt of WORK_TASKS) {
    await ensureExistsBy(db, "work_tasks", "user_id", "title", [user_id, wt.title], async () => {
      console.log(`  → work_task: ${wt.title}`);
      return db.from("work_tasks").insert({ user_id, ...wt });
    });
  }

  // ---- kpi_reports ----
  for (const kpi of KPI_REPORTS) {
    await ensureExistsBy(db, "kpi_reports", "user_id", "name", [user_id, kpi.name], async () => {
      console.log(`  → kpi: ${kpi.name}`);
      return db.from("kpi_reports").insert({ user_id, ...kpi });
    });
  }

  // ---- content_feeds ----
  const feedIds: Record<string, string> = {};
  for (const cf of CONTENT_FEEDS) {
    await ensureExistsBy(db, "content_feeds", "user_id", "url", [user_id, cf.url], async () => {
      console.log(`  → content_feed: ${cf.title.slice(0, 25)}`);
      const { data } = await db.from("content_feeds").insert({ user_id, ...cf }).select("id").single();
      if (data) feedIds[cf.title] = data.id;
      return { data, error: null };
    });
    if (!feedIds[cf.title]) {
      const { data } = await admin.from("content_feeds")
        .select("id").eq("user_id", user_id).eq("url", cf.url).single();
      if (data) feedIds[cf.title] = data.id;
    }
  }

  // ---- saved_contents & knowledge_items (依赖 content_feeds) ----
  for (const sc of SAVED_CONTENTS) {
    const fId = feedIds[sc.feed_title];
    if (!fId) continue;
    await ensureExistsBy(db, "saved_contents", "user_id", "feed_id", [user_id, fId], async () => {
      console.log(`  → saved: ${sc.feed_title.slice(0, 25)}`);
      return db.from("saved_contents").insert({
        user_id, feed_id: fId, category: sc.category, notes: sc.notes,
      });
    });
  }

  for (const ki of KNOWLEDGE_ITEMS) {
    await ensureExistsBy(db, "knowledge_items", "user_id", "title", [user_id, ki.title], async () => {
      console.log(`  → knowledge: ${ki.title}`);
      return db.from("knowledge_items").insert({ user_id, ...ki });
    });
  }

  // ---- subscription_rules ----
  for (const sr of SUBSCRIPTION_RULES) {
    await ensureExistsBy(
      db, "subscription_rules", "user_id", "category",
      [user_id, sr.category],
      async () => db.from("subscription_rules").insert({ user_id, ...sr })
    );
  }

  // ---- travel_plans ----
  for (const tp of TRAVEL_PLANS) {
    await ensureExistsBy(db, "travel_plans", "user_id", "destination", [user_id, tp.destination], async () => {
      console.log(`  → travel: ${tp.destination}`);
      return db.from("travel_plans").insert({ user_id, ...tp });
    });
  }

  // ---- system_integrations ----
  for (const si of SYSTEM_INTEGRATIONS) {
    await ensureExistsBy(db, "system_integrations", "user_id", "name", [user_id, si.name], async () => {
      console.log(`  → integration: ${si.name}`);
      return db.from("system_integrations").insert({ user_id, ...si });
    });
  }

  const label = DRY ? "DRY RUN 完成（未写入）" : "播种完成";
  console.log(`\n✅ ${label}`);
}

// ================================================================
// 工具函数
// ================================================================
function dryWrapper(client: ReturnType<typeof createClient>, dry: boolean) {
  if (!dry) return client;
  // 返回一个模拟 from() 的对象，所有操作只 log 不执行
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "from") {
        return (table: string) => ({
          upsert: (...args: any[]) => ({ then: (cb: any) => cb?.({ data: null, error: null }) }),
          insert: (...args: any[]) =>
            ({ select: () => ({ single: () => ({ then: (cb: any) => cb?.({ data: null, error: null }) }) }) }),
          select: (...args: any[]) =>
            ({ eq: () => ({ single: () => ({ then: (cb: any) => cb?.({ data: { id: "dry" }, error: null }) }) }) }),
          delete: () => ({ eq: () => ({ then: (cb: any) => cb?.({ error: null }) }) }),
        });
      }
      return (target as any)[prop];
    },
  }) as any;
}

async function ensureExists(
  db: any, table: string, pkCol: string, pkVal: string,
  insert: () => Promise<any>
) {
  const { data: existing } = await db.from(table).select(pkCol).eq(pkCol, pkVal).maybeSingle();
  if (existing) return;
  if (DRY) { console.log(`  [DRY] INSERT ${table}`); return; }
  await insert();
}

async function ensureExistsBy(
  db: any, table: string, col1: string, col2: string,
  vals: [string, string],
  insert: () => Promise<any>
) {
  const { data: existing } = await db
    .from(table)
    .select(col1)
    .eq(col1, vals[0])
    .eq(col2, vals[1])
    .maybeSingle();
  if (existing) return;
  if (DRY) { console.log(`  [DRY] INSERT ${table}`); return; }
  await insert();
}

// ================================================================
// 演示数据
// ================================================================

const FAMILY_MEMBERS = [
  { name: "我自己", role: "self" as const, age: 35, health_conditions: [] },
  { name: "妻子", role: "spouse" as const, age: 34, health_conditions: [] },
  { name: "小宇", role: "child" as const, age: 8, health_conditions: [] },
  { name: "母亲", role: "parent" as const, age: 62, health_conditions: ["高血压"] },
];

const CHILD_GROWTH = [
  { family_member_name: "小宇", date: "2026-06-01", height_cm: 128, weight_kg: 27, subject_scores: { 语文: 92, 数学: 95, 英语: 88 } },
  { family_member_name: "小宇", date: "2026-07-01", height_cm: 129, weight_kg: 27.5, subject_scores: { 语文: 90, 数学: 97, 英语: 90 } },
  { family_member_name: "小宇", date: "2026-08-01", height_cm: 130, weight_kg: 28, subject_scores: { 语文: 91, 数学: 96, 英语: 92 } },
];

const HEALTH_RECORDS = [
  { date: "2026-07-28", steps: 8234, sleep_hours: 7.2, heart_rate: 72, weight: 72.5, source: "apple_health" as const },
  { date: "2026-07-29", steps: 10231, sleep_hours: 6.8, heart_rate: 70, weight: 72.3, source: "apple_health" as const },
  { date: "2026-07-30", steps: 6543, sleep_hours: 7.5, heart_rate: 73, weight: 72.5, source: "apple_health" as const },
  { date: "2026-07-31", steps: 11890, sleep_hours: 7.0, heart_rate: 68, weight: 72.2, source: "apple_health" as const },
  { date: "2026-08-01", steps: 5500, sleep_hours: 8.1, heart_rate: 71, weight: 72.4, source: "manual" as const },
  { date: "2026-08-02", steps: 9800, sleep_hours: 7.3, heart_rate: 69, weight: 72.2, source: "apple_health" as const },
];

const INBOX_ITEMS = [
  { content: "周末带小宇去科技馆", category: "task" as const, priority: "high" as const, status: "pending" as const },
  { content: "买一双跑步鞋 Nike Pegasus", category: "shopping" as const, priority: "medium" as const, status: "pending" as const },
  { content: "怎么用 Notion 搭建家庭知识库？", category: "inspiration" as const, priority: "low" as const, status: "pending" as const },
  { content: "报名下半年的 PMP 考试", category: "task" as const, priority: "medium" as const, status: "completed" as const },
  { content: "想做一个自动记账的 AI 工具", category: "inspiration" as const, priority: "low" as const, status: "pending" as const },
];

const WARDROBE = [
  { name: "白衬衫", type: "top" as const, color: "white", season: ["spring", "summer", "autumn"], style: ["business", "casual"], brand: "UNIQLO" },
  { name: "黑色休闲裤", type: "bottom" as const, color: "black", season: ["spring", "autumn", "winter"], style: ["casual", "business"] },
  { name: "深蓝牛仔裤", type: "bottom" as const, color: "navy", season: ["spring", "autumn", "winter"], style: ["casual"] },
  { name: "灰色西装外套", type: "outerwear" as const, color: "gray", season: ["autumn", "winter", "spring"], style: ["business", "formal"] },
  { name: "白色运动鞋", type: "shoes" as const, color: "white", season: ["spring", "summer", "autumn"], style: ["casual", "sport"], brand: "Nike" },
  { name: "棕色皮鞋", type: "shoes" as const, color: "brown", season: ["spring", "autumn", "winter"], style: ["business", "formal"] },
  { name: "浅蓝Polo衫", type: "top" as const, color: "lightblue", season: ["summer"], style: ["casual", "business"] },
  { name: "黑色羽绒服", type: "outerwear" as const, color: "black", season: ["winter"], style: ["casual"] },
];

const OUTFITS = [
  { date: "2026-08-01", weather: "晴", temperature: 33, rating: 4, notes: "今天很热，浅色搭配清爽" },
  { date: "2026-08-02", weather: "多云", temperature: 29, rating: 4, notes: "" },
  { date: "2026-07-30", weather: "小雨", temperature: 26, rating: 3, notes: "带了伞但忘穿防水鞋" },
];

const FINANCE_RECORDS = [
  { type: "income" as const, amount: 25000, category: "other" as const, description: "7月工资", date: "2026-07-31" },
  { type: "expense" as const, amount: 3800, category: "housing" as const, description: "房贷", date: "2026-08-01" },
  { type: "expense" as const, amount: 156.5, category: "food" as const, description: "超市买菜", date: "2026-08-01" },
  { type: "expense" as const, amount: 89, category: "transport" as const, description: "加油", date: "2026-08-01" },
  { type: "expense" as const, amount: 424, category: "shopping" as const, description: "小宇的书包+文具", date: "2026-08-02" },
  { type: "expense" as const, amount: 2400, category: "education" as const, description: "小宇英语班续费", date: "2026-08-02" },
  { type: "expense" as const, amount: 218, category: "food" as const, description: "周末家庭聚餐", date: "2026-08-02" },
  { type: "expense" as const, amount: 68, category: "entertainment" as const, description: "视频会员月费", date: "2026-08-01" },
  { type: "expense" as const, amount: 350, category: "health" as const, description: "母亲降压药", date: "2026-08-01" },
  { type: "expense" as const, amount: 120, category: "food" as const, description: "外卖午餐", date: "2026-08-02" },
];

const SAVINGS_GOALS = [
  { name: "年底旅游基金", target_amount: 50000, current_amount: 32000, deadline: "2026-12-31" },
  { name: "紧急备用金", target_amount: 100000, current_amount: 60000 },
  { name: "小宇教育基金", target_amount: 200000, current_amount: 85000, deadline: "2028-09-01" },
];

const CHECKIN_HABITS = [
  { name: "晨跑", category: "fitness" as const, source: "keep" as const, target_days_per_week: 4 },
  { name: "英语学习", category: "learning" as const, source: "duolingo" as const, target_days_per_week: 5 },
  { name: "早睡", category: "health" as const, source: "manual" as const, target_days_per_week: 7 },
  { name: "代码复习", category: "learning" as const, source: "manual" as const, target_days_per_week: 3 },
];

const CHECKIN_RECORDS = [
  { habit_name: "晨跑", date: "2026-07-29", completed: true, notes: "5公里" },
  { habit_name: "晨跑", date: "2026-07-30", completed: false, notes: "下雨" },
  { habit_name: "晨跑", date: "2026-07-31", completed: true, notes: "3公里" },
  { habit_name: "晨跑", date: "2026-08-01", completed: true, notes: "5公里" },
  { habit_name: "晨跑", date: "2026-08-02", completed: false, notes: "" },
  { habit_name: "英语学习", date: "2026-07-29", completed: true },
  { habit_name: "英语学习", date: "2026-07-30", completed: true },
  { habit_name: "英语学习", date: "2026-07-31", completed: true },
  { habit_name: "英语学习", date: "2026-08-01", completed: false },
  { habit_name: "英语学习", date: "2026-08-02", completed: true },
  { habit_name: "早睡", date: "2026-08-01", completed: true, notes: "23:00" },
  { habit_name: "早睡", date: "2026-08-02", completed: false, notes: "加班到凌晨" },
];

const APPROVALS = [
  { title: "Q3 差旅费用报销", applicant: "张三", source: "feishu" as const, status: "pending" as const, amount: 4560, reason: "北京出差3天", due_date: "2026-08-05" },
  { title: "服务器扩容申请", applicant: "李四", source: "feishu" as const, status: "pending" as const, amount: 12000, reason: "Q3 流量预估增长", due_date: "2026-08-10" },
  { title: "新人入职设备申请", applicant: "王五", source: "other" as const, status: "approved" as const, reason: "新招开发工程师", due_date: "2026-08-01" },
];

const ALERTS = [
  { title: "生产环境 CPU 使用率超 85%", description: "生产集群 node-3 CPU 持续高位，建议扩容", level: "warning" as const, source: "system" as const, resolved: false },
  { title: "SSL 证书将于 7 天后过期", description: "api.example.com 证书 2026-08-10 到期", level: "critical" as const, source: "system" as const, resolved: false },
  { title: "月末财务报表未提交", description: "7月财务报告截止日期已过", level: "info" as const, source: "feishu" as const, resolved: false },
];

const WORK_TASKS = [
  { title: "完成 Q3 OKR 初稿", status: "in_progress" as const, priority: "urgent" as const, assignee: "自己", due_date: "2026-08-05" },
  { title: "新人 onboarding 文档", status: "todo" as const, priority: "normal" as const, assignee: "自己", due_date: "2026-08-10" },
  { title: "代码 review: PR #234", status: "review" as const, priority: "normal" as const, assignee: "张三", due_date: "2026-08-03" },
  { title: "技术选型调研报告", status: "todo" as const, priority: "low" as const, assignee: "李四" },
];

const KPI_REPORTS = [
  { name: "月活用户", value: 125000, unit: "人", trend: "up" as const, change_percent: 8.5, period: "monthly" as const, source: "manual" },
  { name: "用户留存率", value: 72, unit: "%", trend: "stable" as const, change_percent: 0.3, period: "monthly" as const, source: "manual" },
  { name: "平均响应时间", value: 235, unit: "ms", trend: "down" as const, change_percent: -12, period: "weekly" as const, source: "manual" },
  { name: "Bug 修复率", value: 94, unit: "%", trend: "up" as const, change_percent: 3, period: "weekly" as const, source: "manual" },
];

const CONTENT_FEEDS = [
  { title: "2026下半年最值得学的 5 个技术栈", url: "https://www.bilibili.com/video/example1", platform: "bilibili" as const, author: "技术胖", likes: 3200, comments: 156, published_at: "2026-07-28T10:00:00Z", fetched_at: "2026-08-01T08:00:00Z" },
  { title: "北京周边 3 个冷门亲子露营地", url: "https://www.xiaohongshu.com/explore/example2", platform: "xiaohongshu" as const, author: "遛娃小能手", likes: 8900, comments: 234, published_at: "2026-07-25T14:00:00Z", fetched_at: "2026-08-01T08:00:00Z" },
  { title: "Building AI Agents with TypeScript", url: "https://www.youtube.com/watch?v=example3", platform: "youtube" as const, author: "Fireship", likes: 45000, comments: 890, published_at: "2026-07-20T16:00:00Z", fetched_at: "2026-08-01T08:00:00Z" },
  { title: "打工人必备的 10 款效率工具", url: "https://www.bilibili.com/video/example4", platform: "bilibili" as const, author: "工具大师", likes: 15000, comments: 567, published_at: "2026-07-30T08:00:00Z", fetched_at: "2026-08-01T08:00:00Z" },
  { title: "孩子的数学思维怎么培养", url: "https://www.xiaohongshu.com/explore/example5", platform: "xiaohongshu" as const, author: "教育观察员", likes: 12000, comments: 432, published_at: "2026-07-22T09:00:00Z", fetched_at: "2026-08-01T08:00:00Z" },
];

const SAVED_CONTENTS = [
  { feed_title: "2026下半年最值得学的 5 个技术栈", category: "knowledge" as const, notes: "Next.js, Rust, AI Agent, Supabase, Tailwind" },
  { feed_title: "北京周边 3 个冷门亲子露营地", category: "travel" as const, notes: "国庆可以考虑" },
  { feed_title: "孩子的数学思维怎么培养", category: "knowledge" as const, notes: "给小宇用" },
];

const KNOWLEDGE_ITEMS = [
  {
    type: "action_plan" as const,
    title: "下半年学习路线图",
    content: { steps: ["Next.js 深入", "Rust 基础", "AI Agent 框架对比", "Supabase RLS 策略优化"] },
  },
  {
    type: "checklist" as const,
    title: "亲子露营准备清单",
    content: { items: ["帐篷", "睡袋", "防蚊喷雾", "急救包", "零食", "桌游"] },
  },
];

const SUBSCRIPTION_RULES = [
  { platform: "bilibili" as const, category: "knowledge" as const, keywords: ["前端", "全栈", "AI", "TypeScript"], active: true },
  { platform: "xiaohongshu" as const, category: "travel" as const, keywords: ["亲子", "周末", "北京", "自驾"], active: true },
  { platform: "youtube" as const, category: "knowledge" as const, keywords: ["AI Agent", "software architecture"], active: true },
];

const TRAVEL_PLANS = [
  {
    destination: "北京·怀柔",
    start_date: "2026-09-15",
    end_date: "2026-09-17",
    status: "planning" as const,
    budget: 3000,
    notes: "中秋三天，带家人去怀柔，爬慕田峪长城 + 红螺寺",
    itinerary: { days: [{ day: 1, spots: ["慕田峪长城"], area: "怀柔" }, { day: 2, spots: ["红螺寺", "雁栖湖"], area: "怀柔" }, { day: 3, spots: [] }], tips: ["提前预订民宿", "带登山鞋"] },
    checklist: { 证件: ["身份证"], 衣物: ["运动鞋", "薄外套"], 其他: ["防晒霜", "水壶", "充电宝"] },
  },
];

const SYSTEM_INTEGRATIONS = [
  { name: "feishu" as const, connected: true, last_sync_at: "2026-08-02T20:00:00Z", settings: { auto_sync: true } },
  { name: "apple_health" as const, connected: true, last_sync_at: "2026-08-02T07:00:00Z", settings: {} },
  { name: "keep" as const, connected: true, last_sync_at: "2026-08-02T06:30:00Z", settings: {} },
];

// ================================================================
main().catch((err) => {
  console.error("❌ 脚本异常:", err);
  process.exit(1);
});
