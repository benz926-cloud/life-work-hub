/**
 * 把 mock-data 播种成某个账号的初始数据。
 *
 * 用法（在项目根目录）：
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... SEED_EMAIL=you@example.com \
 *   npx tsx scripts/seed-supabase.ts [--dry-run] [--force]
 *
 * - 需要 service_role key（绕过 RLS 才能代写他人行），**只在本地跑，别进前端、别进 CI**
 * - 默认幂等：目标账号已有数据时直接退出，避免重复播种；要覆盖加 --force
 * - 播种顺序重要：family_members 必须先于 child_growth_records，
 *   wardrobe_items 必须先于 outfits（outfits.items 存的是衣物 id）
 */
import { createClient } from "@supabase/supabase-js";
import {
  mockInboxItems, mockApprovals, mockAlerts, mockWorkTasks, mockKPIs,
  mockFamilyMembers, mockHealthRecords, mockGrowthRecords, mockHabits,
  mockCheckins, mockFinanceRecords, mockSavingsGoals, mockWardrobeItems,
  mockOutfits, mockTravelPlans, mockContentFeeds, mockSubscriptionRules,
  mockIntegrations,
} from "../src/lib/mock-data";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const EMAIL = process.env.SEED_EMAIL ?? "";
const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

if (!URL || !KEY || !EMAIL) {
  console.error("缺少环境变量：SUPABASE_URL / SUPABASE_SERVICE_KEY / SEED_EMAIL");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

/** 去掉 mock 里的假 id 和空 user_id，交给数据库生成 */
function clean(rows: Row[], userId: string): Row[] {
  return rows.map((r) => {
    const { id, created_at, updated_at, ...rest } = r;
    void id; void created_at; void updated_at;
    return { ...rest, user_id: userId };
  });
}

async function insert(table: string, rows: Row[]): Promise<Row[]> {
  if (!rows.length) return [];
  if (DRY) { console.log(`  [dry-run] ${table}: 将插入 ${rows.length} 行`); return []; }
  const { data, error } = await db.from(table).insert(rows).select();
  if (error) { console.error(`  ✗ ${table}: ${error.message}`); return []; }
  console.log(`  ✓ ${table}: ${data?.length ?? 0} 行`);
  return data ?? [];
}

async function main() {
  // 1. 找到目标账号
  const { data: list, error } = await db.auth.admin.listUsers();
  if (error) { console.error("读取用户列表失败：", error.message); process.exit(1); }
  const user = list.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (!user) { console.error(`找不到账号 ${EMAIL}，请先在应用里注册`); process.exit(1); }
  console.log(`目标账号：${EMAIL}  (${user.id})`);

  // 2. 幂等检查
  const { count } = await db.from("inbox_items").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) > 0 && !FORCE) {
    console.log(`该账号已有 ${count} 条收件箱记录，跳过播种。要覆盖请加 --force`);
    return;
  }

  const uid = user.id;
  console.log(DRY ? "\n[dry-run] 不会真正写入\n" : "\n开始播种\n");

  // 3. 无依赖的表
  await insert("inbox_items", clean(mockInboxItems, uid));
  await insert("approvals", clean(mockApprovals, uid));
  await insert("alerts", clean(mockAlerts, uid));
  await insert("work_tasks", clean(mockWorkTasks, uid));
  await insert("kpi_reports", clean(mockKPIs, uid));
  await insert("finance_records", clean(mockFinanceRecords, uid));
  await insert("savings_goals", clean(mockSavingsGoals, uid));
  await insert("travel_plans", clean(mockTravelPlans, uid));
  await insert("content_feeds", clean(mockContentFeeds, uid));
  await insert("subscription_rules", clean(mockSubscriptionRules, uid));
  await insert("system_integrations", clean(mockIntegrations, uid));

  // 4. 有依赖：家庭成员 → 健康记录 / 成长记录
  const members = await insert("family_members", clean(mockFamilyMembers, uid));
  const memberIdByName = new Map(members.map((m) => [m.name as string, m.id as string]));
  const oldToNewMember = new Map(
    mockFamilyMembers.map((m) => [m.id, memberIdByName.get(m.name)]).filter(([, v]) => v) as [string, string][]
  );

  await insert("health_records", clean(mockHealthRecords, uid).map((r) => ({
    ...r, family_member_id: oldToNewMember.get(r.family_member_id) ?? null,
  })));

  const child = mockFamilyMembers.find((m) => m.role === "child");
  const childId = child ? oldToNewMember.get(child.id) : undefined;
  if (childId) {
    // 这张表没有 user_id 列，归属靠 family_member_id
    const rows = mockGrowthRecords.map(({ id, created_at, ...rest }) => {
      void id; void created_at;
      return { ...rest, family_member_id: childId };
    });
    await insert("child_growth_records", rows);
  } else {
    console.log("  ! 没找到孩子成员，跳过 child_growth_records");
  }

  // 5. 有依赖：衣柜 → 穿搭（outfits.items 存的是衣物 id）
  const wardrobe = await insert("wardrobe_items", clean(mockWardrobeItems, uid));
  const wardrobeIdByName = new Map(wardrobe.map((w) => [w.name as string, w.id as string]));
  const oldToNewItem = new Map(
    mockWardrobeItems.map((w) => [w.id, wardrobeIdByName.get(w.name)]).filter(([, v]) => v) as [string, string][]
  );
  await insert("outfits", clean(mockOutfits, uid).map((o) => ({
    ...o, items: (o.items as string[]).map((i) => oldToNewItem.get(i)).filter(Boolean),
  })));

  // 6. 有依赖：习惯 → 打卡记录
  const habits = await insert("checkin_habits", clean(mockHabits, uid));
  const habitIdByName = new Map(habits.map((h) => [h.name as string, h.id as string]));
  const oldToNewHabit = new Map(
    mockHabits.map((h) => [h.id, habitIdByName.get(h.name)]).filter(([, v]) => v) as [string, string][]
  );
  await insert("checkin_records", clean(mockCheckins, uid).map((c) => ({
    ...c, habit_id: oldToNewHabit.get(c.habit_id) ?? null,
  })));

  console.log(DRY ? "\n[dry-run] 结束" : "\n播种完成");
}

main().catch((e) => { console.error(e); process.exit(1); });
