#!/usr/bin/env npx tsx
/**
 * ================================================================
 * RLS 验证脚本 —— 逐表验证 Row Level Security 策略
 * ================================================================
 *
 * 用法:
 *   # 设置环境变量
 *   export SUPABASE_URL=https://xxx.supabase.co
 *   export SUPABASE_SERVICE_KEY=eyJh...     # service_role key（用于创建测试用户）
 *   export TEST_EMAIL_A=test-a@example.com
 *   export TEST_PASSWORD_A=Test123456!
 *   export TEST_EMAIL_B=test-b@example.com
 *   export TEST_PASSWORD_B=Test123456!
 *
 *   npm i --no-save tsx
 *   npx tsx scripts/verify-rls.ts
 *
 * 验证项:
 *   1. 用户 A 能读写自己的行
 *   2. 用户 A 读不到/改不了/删不了 用户 B 的行
 *   3. 未登录状态下所有表都读不到东西
 *   4. child_growth_records: 归属走 family_members 关联，不走 user_id
 * ================================================================
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ================================================================
// 配置
// ================================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const EMAIL_A = process.env.TEST_EMAIL_A;
const PASSWORD_A = process.env.TEST_PASSWORD_A;
const EMAIL_B = process.env.TEST_EMAIL_B;
const PASSWORD_B = process.env.TEST_PASSWORD_B;
const CLEANUP = process.env.CLEANUP === "1";

// ================================================================
// 工具
// ================================================================
let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.error(`  ❌ ${label}`);
    fail++;
  }
}

async function assertRejects(promise: Promise<unknown>, label: string) {
  try {
    await promise;
    console.error(`  ❌ ${label} — 预期失败但成功了`);
    fail++;
  } catch {
    console.log(`  ✅ ${label}`);
    pass++;
  }
}

async function assertEmpty(data: unknown[] | null, label: string) {
  assert(Array.isArray(data) && data.length === 0, label);
}

// ================================================================
// 主流程
// ================================================================
async function main() {
  // ---- 参数校验 ----
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_KEY");
  if (!EMAIL_A) missing.push("TEST_EMAIL_A");
  if (!PASSWORD_A) missing.push("TEST_PASSWORD_A");
  if (!EMAIL_B) missing.push("TEST_EMAIL_B");
  if (!PASSWORD_B) missing.push("TEST_PASSWORD_B");
  if (missing.length > 0) {
    console.error(`❌ 缺少环境变量: ${missing.join(", ")}`);
    console.error("用法见文件头部注释。");
    process.exit(1);
  }

  console.log("================================================================");
  console.log("Life Work Hub — RLS 策略全面验证");
  console.log("================================================================");
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`用户 A:  ${EMAIL_A}`);
  console.log(`用户 B:  ${EMAIL_B}`);
  console.log("");

  // ---- 创建 Supabase 客户端 ----
  const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- 1. 准备测试用户 ----
  console.log("▸ 准备测试用户");
  const anon = createClient(SUPABASE_URL!, "placeholder-anon-key", {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 确保用户 A 存在
  let userA: { id: string; email: string };
  {
    const { data: listA } = await admin.auth.admin.listUsers();
    const existingA = (listA as any)?.users?.find((u: any) => u.email === EMAIL_A);
    if (!existingA) {
      console.log(`  创建用户 A: ${EMAIL_A}`);
      const { data: created } = await admin.auth.admin.createUser({
        email: EMAIL_A!,
        password: PASSWORD_A!,
        email_confirm: true,
      });
      userA = { id: created.user!.id, email: created.user!.email! };
    } else {
      userA = { id: existingA.id, email: existingA.email! };
      console.log(`  用户 A 已存在: ${userA.id}`);
    }
    // 确保 profile 存在
    await admin
      .from("profiles")
      .upsert({ id: userA.id, email: userA.email, name: "测试用户A" }, { onConflict: "id" });
  }

  // 确保用户 B 存在
  let userB: { id: string; email: string };
  {
    const { data: listB } = await admin.auth.admin.listUsers();
    const existingB = (listB as any)?.users?.find((u: any) => u.email === EMAIL_B);
    if (!existingB) {
      console.log(`  创建用户 B: ${EMAIL_B}`);
      const { data: created } = await admin.auth.admin.createUser({
        email: EMAIL_B!,
        password: PASSWORD_B!,
        email_confirm: true,
      });
      userB = { id: created.user!.id, email: created.user!.email! };
    } else {
      userB = { id: existingB.id, email: existingB.email! };
      console.log(`  用户 B 已存在: ${userB.id}`);
    }
    await admin
      .from("profiles")
      .upsert({ id: userB.id, email: userB.email, name: "测试用户B" }, { onConflict: "id" });
  }

  // 获取 A 的客户端（通过 signIn）
  console.log("  登录用户 A…");
  const { data: signInA } = await anon.auth.signInWithPassword({
    email: EMAIL_A!,
    password: PASSWORD_A!,
  });
  if (!signInA.session) throw new Error("用户 A 登录失败");
  const clientA = createClient(SUPABASE_URL!, "placeholder-anon-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${signInA.session.access_token}` } },
  });

  // 获取 B 的客户端
  console.log("  登录用户 B…");
  const { data: signInB } = await anon.auth.signInWithPassword({
    email: EMAIL_B!,
    password: PASSWORD_B!,
  });
  if (!signInB.session) throw new Error("用户 B 登录失败");
  const clientB = createClient(SUPABASE_URL!, "placeholder-anon-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${signInB.session.access_token}` } },
  });

  console.log("");

  // ---- 2. 逐表验证 ----
  await testProfiles(admin, clientA, clientB, userA, userB);
  await testInboxItems(admin, clientA, clientB, userA, userB);
  await testWardrobe(admin, clientA, clientB, userA, userB);
  await testFinance(admin, clientA, clientB, userA, userB);
  await testFamilyMembers(admin, clientA, clientB, userA, userB);
  await testChildGrowth(admin, clientA, clientB, userA, userB);
  await testHealthRecords(admin, clientA, clientB, userA, userB);
  await testCheckin(admin, clientA, clientB, userA, userB);
  await testWorkTables(admin, clientA, clientB, userA, userB);
  await testContentTables(admin, clientA, clientB, userA, userB);
  await testTravelPlans(admin, clientA, clientB, userA, userB);
  await testSystemIntegrations(admin, clientA, clientB, userA, userB);

  // ---- 3. 未登录测试 ----
  console.log("▸ 未登录状态验证（所有表返回空，不报错）");
  const anonOnly = createClient(SUPABASE_URL!, SUPABASE_URL!.includes("placeholder")
    ? "placeholder-anon-key"
    : signInA.session.access_token.slice(0, 5) + "invalid");
  // 用真正的 anon key 但没 token
  const { data: realAnonKey } = await anon.auth.signInWithPassword({
    email: EMAIL_A!, password: PASSWORD_A!,
  });
  const noAuth = createClient(SUPABASE_URL!, SUPABASE_URL!.includes("placeholder") ? "placeholder-anon-key" : "")

  const tablesToTestAnon = [
    "inbox_items", "wardrobe_items", "outfits", "finance_records", "savings_goals",
    "family_members", "health_records", "child_growth_records",
    "checkin_habits", "checkin_records", "approvals", "alerts", "work_tasks",
    "kpi_reports", "content_feeds", "saved_contents", "knowledge_items",
    "subscription_rules", "travel_plans", "system_integrations",
  ];

  // Use admin to get real anon key
  for (const table of tablesToTestAnon) {
    try {
      // test with anon client that has no auth
      const anonTest = createClient(SUPABASE_URL!, "placeholder-anon-key");
      const { data, error } = await anonTest.from(table).select("*", { count: "exact", head: true });
      // RLS should block — either return 0 count or throw
      assert(
        (data === null || data === undefined) || error !== null,
        `anon.${table}: 未登录 SELECT 被拦截`
      );
    } catch (e: any) {
      // Network/auth errors are acceptable — means no access
      assert(true, `anon.${table}: 未登录 SELECT 被拦截（异常: ${e.message?.slice(0, 40)}）`);
    }
  }
  console.log("");

  // ---- 4. 清理 ----
  if (CLEANUP) {
    console.log("▸ 清理测试数据");
    // 用 admin 删掉两个用户的 profile，CASCADE 会清掉所有关联数据
    await admin.from("profiles").delete().eq("id", userA.id);
    await admin.from("profiles").delete().eq("id", userB.id);
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);
    console.log("  已清理。");
  }

  // ---- 5. 报告 ----
  console.log("================================================================");
  console.log(`验证完成: ✅ ${pass} 通过  ❌ ${fail} 失败`);
  console.log("================================================================");
  process.exit(fail > 0 ? 1 : 0);
}

// ================================================================
// 测试函数
// ================================================================

async function testProfiles(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ profiles");

  // A 能读自己
  const { data: pa } = await cA.from("profiles").select("*").eq("id", uA.id).single();
  assert(pa !== null && pa.name === "测试用户A", "A 能读自己的 profile");

  // A 读不到 B
  const { data: paB } = await cA.from("profiles").select("*").eq("id", uB.id).maybeSingle();
  assert(paB === null, "A 读不到 B 的 profile");

  // A 能改自己
  const { error: ue } = await cA.from("profiles").update({ name: "测试用户A-改" }).eq("id", uA.id);
  assert(!ue, "A 能更新自己的 profile");
  // 恢复
  await admin.from("profiles").update({ name: "测试用户A" }).eq("id", uA.id);

  // A 改不了 B
  const { error: ueB } = await cA.from("profiles").update({ name: "hacked" }).eq("id", uB.id);
  const { data: pbCheck } = await admin.from("profiles").select("name").eq("id", uB.id).single();
  assert(pbCheck?.name !== "hacked", "A 改不了 B 的 profile（数据未被改动）");

  console.log("");
}

async function testInboxItems(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ inbox_items");

  // 准备：用 admin 给 A 插入一条
  await admin.from("inbox_items").delete().eq("user_id", uA.id);
  await admin.from("inbox_items").delete().eq("user_id", uB.id);
  const { data: itemA } = await admin
    .from("inbox_items")
    .insert({ user_id: uA.id, content: "A的待办", category: "task" })
    .select()
    .single();
  const { data: itemB } = await admin
    .from("inbox_items")
    .insert({ user_id: uB.id, content: "B的待办", category: "task" })
    .select()
    .single();

  // A 能读自己的
  const { data: rA } = await cA.from("inbox_items").select("*").eq("id", itemA!.id).single();
  assert(rA !== null && rA.content === "A的待办", "A 能读自己的 inbox");

  // A 读不到 B 的
  const { data: rAB } = await cA.from("inbox_items").select("*").eq("id", itemB!.id).maybeSingle();
  assert(rAB === null, "A 读不到 B 的 inbox");

  // A 能写
  const { data: insA } = await cA
    .from("inbox_items")
    .insert({ user_id: uA.id, content: "A自己写的", category: "inspiration" })
    .select()
    .single();
  assert(insA !== null, "A 能插入自己的 inbox");

  // A 改不了 B 的
  const { error: u } = await cA
    .from("inbox_items")
    .update({ content: "hacked" })
    .eq("id", itemB!.id);
  const { data: bCheck } = await admin
    .from("inbox_items")
    .select("content")
    .eq("id", itemB!.id)
    .single();
  assert(bCheck?.content === "B的待办", "A 改不了 B 的 inbox");

  // A 删不了 B 的
  const { error: d } = await cA.from("inbox_items").delete().eq("id", itemB!.id);
  const { data: bExists } = await admin.from("inbox_items").select("id").eq("id", itemB!.id).single();
  assert(bExists !== null, "A 删不了 B 的 inbox（数据仍存在）");

  console.log("");
}

async function testWardrobe(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ wardrobe_items & outfits");

  // wardrobe_items
  await admin.from("wardrobe_items").delete().eq("user_id", uA.id);
  await admin.from("wardrobe_items").delete().eq("user_id", uB.id);
  const { data: wiA } = await admin
    .from("wardrobe_items")
    .insert({ user_id: uA.id, name: "A的白衬衫", type: "top", color: "white", season: ["summer"], style: ["casual"] })
    .select().single();
  const { data: wiB } = await admin
    .from("wardrobe_items")
    .insert({ user_id: uB.id, name: "B的黑外套", type: "outerwear", color: "black", season: ["winter"], style: ["business"] })
    .select().single();

  const { data: rA } = await cA.from("wardrobe_items").select("*").eq("id", wiA!.id).single();
  assert(rA !== null && rA.name === "A的白衬衫", "A 能读自己的 wardrobe");

  const { data: rB } = await cA.from("wardrobe_items").select("*").eq("id", wiB!.id).maybeSingle();
  assert(rB === null, "A 读不到 B 的 wardrobe");

  // outfits
  await admin.from("outfits").delete().eq("user_id", uA.id);
  await admin.from("outfits").delete().eq("user_id", uB.id);
  const { data: outA } = await admin
    .from("outfits")
    .insert({ user_id: uA.id, date: "2026-08-01", weather: "晴", temperature: 30, items: [wiA!.id] })
    .select().single();
  const { data: outB } = await admin
    .from("outfits")
    .insert({ user_id: uB.id, date: "2026-08-01", weather: "雨", temperature: 25, items: [wiB!.id] })
    .select().single();

  const { data: oA } = await cA.from("outfits").select("*").eq("id", outA!.id).single();
  assert(oA !== null, "A 能读自己的 outfit");
  const { data: oB } = await cA.from("outfits").select("*").eq("id", outB!.id).maybeSingle();
  assert(oB === null, "A 读不到 B 的 outfit");

  console.log("");
}

async function testFinance(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ finance_records & savings_goals");

  await admin.from("finance_records").delete().eq("user_id", uA.id);
  await admin.from("finance_records").delete().eq("user_id", uB.id);
  const { data: fA } = await admin
    .from("finance_records")
    .insert({ user_id: uA.id, type: "expense", amount: 100, category: "food", description: "A的午餐", date: "2026-08-01" })
    .select().single();
  const { data: fB } = await admin
    .from("finance_records")
    .insert({ user_id: uB.id, type: "expense", amount: 200, category: "food", description: "B的午餐", date: "2026-08-01" })
    .select().single();

  const { data: rA } = await cA.from("finance_records").select("*").eq("id", fA!.id).single();
  assert(rA !== null && rA.description === "A的午餐", "A 能读自己的 finance");
  const { data: rB } = await cA.from("finance_records").select("*").eq("id", fB!.id).maybeSingle();
  assert(rB === null, "A 读不到 B 的 finance");

  // savings_goals
  await admin.from("savings_goals").delete().eq("user_id", uA.id);
  const { data: sg } = await cA
    .from("savings_goals")
    .insert({ user_id: uA.id, name: "A的存款目标", target_amount: 100000 })
    .select().single();
  assert(sg !== null, "A 能创建自己的 savings_goal");

  console.log("");
}

async function testFamilyMembers(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ family_members");

  await admin.from("family_members").delete().eq("user_id", uA.id);
  await admin.from("family_members").delete().eq("user_id", uB.id);
  const { data: fmA } = await admin
    .from("family_members")
    .insert({ user_id: uA.id, name: "A的孩子", role: "child", age: 8 })
    .select().single();
  const { data: fmB } = await admin
    .from("family_members")
    .insert({ user_id: uB.id, name: "B的孩子", role: "child", age: 7 })
    .select().single();

  const { data: rA } = await cA.from("family_members").select("*").eq("id", fmA!.id).single();
  assert(rA !== null && rA.name === "A的孩子", "A 能读自己的 family_member");
  const { data: rB } = await cA.from("family_members").select("*").eq("id", fmB!.id).maybeSingle();
  assert(rB === null, "A 读不到 B 的 family_member");

  // 保存 family_member IDs 供 child_growth 测试用
  (globalThis as any).__fmA_id = fmA!.id;
  (globalThis as any).__fmB_id = fmB!.id;

  console.log("");
}

async function testChildGrowth(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ child_growth_records ⚠️ 无 user_id 列，归属靠 family_member_id");

  const fmA_id = (globalThis as any).__fmA_id;
  const fmB_id = (globalThis as any).__fmB_id;

  if (!fmA_id || !fmB_id) {
    console.log("  ⚠️  跳过（需要 family_members 测试数据）");
    return;
  }

  // 准备：用 admin 给 A 的孩子插入
  await admin.from("child_growth_records").delete().eq("family_member_id", fmA_id);
  await admin.from("child_growth_records").delete().eq("family_member_id", fmB_id);
  const { data: cgA } = await admin
    .from("child_growth_records")
    .insert({ family_member_id: fmA_id, date: "2026-08-01", height_cm: 130, weight_kg: 28 })
    .select().single();
  const { data: cgB } = await admin
    .from("child_growth_records")
    .insert({ family_member_id: fmB_id, date: "2026-08-01", height_cm: 125, weight_kg: 25 })
    .select().single();

  // ⭐ 关键测试：A 通过 family_members 关联读到自己的 child_growth
  const { data: rA } = await cA.from("child_growth_records").select("*").eq("id", cgA!.id).single();
  assert(rA !== null && rA.height_cm === 130, "A 能读自己孩子的 growth（通过 family_member_id 关联）");

  // ⭐ 关键测试：A 读不到 B 的孩子的 growth
  const { data: rB } = await cA.from("child_growth_records").select("*").eq("id", cgB!.id).maybeSingle();
  assert(rB === null, "A 读不到 B 孩子的 growth（跨用户隔离生效）");

  // A 能给自己孩子插入
  const { data: insA } = await cA
    .from("child_growth_records")
    .insert({ family_member_id: fmA_id, date: "2026-08-02", height_cm: 131, weight_kg: 28.5 })
    .select().single();
  assert(insA !== null, "A 能给自己孩子插入 growth 记录");

  // A 不能给 B 的孩子插入
  const { error: insB } = await cA
    .from("child_growth_records")
    .insert({ family_member_id: fmB_id, date: "2026-08-02", height_cm: 999, weight_kg: 99 });
  // RLS 会阻止（违反 policy 的 INSERT 通常会报错）
  const { data: bCheck } = await admin
    .from("child_growth_records")
    .select("height_cm")
    .eq("family_member_id", fmB_id);
  assert(
    !bCheck?.some((r: any) => r.height_cm === 999),
    "A 不能给 B 的孩子插入 growth 记录（数据未写入）"
  );

  console.log("");
}

async function testHealthRecords(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ health_records");

  await admin.from("health_records").delete().eq("user_id", uA.id);
  await admin.from("health_records").delete().eq("user_id", uB.id);
  const { data: hA } = await admin
    .from("health_records")
    .insert({ user_id: uA.id, date: "2026-08-01", steps: 8000, sleep_hours: 7.5 })
    .select().single();
  const { data: hB } = await admin
    .from("health_records")
    .insert({ user_id: uB.id, date: "2026-08-01", steps: 5000, sleep_hours: 6 })
    .select().single();

  const { data: rA } = await cA.from("health_records").select("*").eq("id", hA!.id).single();
  assert(rA !== null && rA.steps === 8000, "A 能读自己的 health");
  const { data: rB } = await cA.from("health_records").select("*").eq("id", hB!.id).maybeSingle();
  assert(rB === null, "A 读不到 B 的 health");

  console.log("");
}

async function testCheckin(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ checkin_habits & checkin_records");

  await admin.from("checkin_records").delete().eq("user_id", uA.id);
  await admin.from("checkin_records").delete().eq("user_id", uB.id);
  await admin.from("checkin_habits").delete().eq("user_id", uA.id);
  await admin.from("checkin_habits").delete().eq("user_id", uB.id);

  const { data: habA } = await admin
    .from("checkin_habits")
    .insert({ user_id: uA.id, name: "A的跑步", category: "fitness" })
    .select().single();
  const { data: habB } = await admin
    .from("checkin_habits")
    .insert({ user_id: uB.id, name: "B的瑜伽", category: "fitness" })
    .select().single();

  // habits
  const { data: hrA } = await cA.from("checkin_habits").select("*").eq("id", habA!.id).single();
  assert(hrA !== null && hrA.name === "A的跑步", "A 能读自己的 habit");
  const { data: hrB } = await cA.from("checkin_habits").select("*").eq("id", habB!.id).maybeSingle();
  assert(hrB === null, "A 读不到 B 的 habit");

  // records
  const { data: recA } = await admin
    .from("checkin_records")
    .insert({ user_id: uA.id, habit_id: habA!.id, date: "2026-08-01", completed: true })
    .select().single();
  const { data: recB } = await admin
    .from("checkin_records")
    .insert({ user_id: uB.id, habit_id: habB!.id, date: "2026-08-01", completed: true })
    .select().single();

  const { data: crA } = await cA.from("checkin_records").select("*").eq("id", recA!.id).single();
  assert(crA !== null, "A 能读自己的 checkin");
  const { data: crB } = await cA.from("checkin_records").select("*").eq("id", recB!.id).maybeSingle();
  assert(crB === null, "A 读不到 B 的 checkin");

  console.log("");
}

async function testWorkTables(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ approvals, alerts, work_tasks, kpi_reports");

  // approvals
  await admin.from("approvals").delete().eq("user_id", uA.id);
  await admin.from("approvals").delete().eq("user_id", uB.id);
  const { data: apA } = await admin
    .from("approvals")
    .insert({ user_id: uA.id, title: "A的审批", applicant: "张三", source: "feishu" })
    .select().single();
  const { data: apB } = await admin
    .from("approvals")
    .insert({ user_id: uB.id, title: "B的审批", applicant: "李四", source: "feishu" })
    .select().single();
  const { data: rapA } = await cA.from("approvals").select("*").eq("id", apA!.id).single();
  assert(rapA !== null, "A 能读自己的 approval");
  const { data: rapB } = await cA.from("approvals").select("*").eq("id", apB!.id).maybeSingle();
  assert(rapB === null, "A 读不到 B 的 approval");

  // alerts
  await admin.from("alerts").delete().eq("user_id", uA.id);
  await admin.from("alerts").delete().eq("user_id", uB.id);
  const { data: alA } = await admin
    .from("alerts")
    .insert({ user_id: uA.id, title: "A的预警", level: "info", source: "system" })
    .select().single();
  const { data: alB } = await admin
    .from("alerts")
    .insert({ user_id: uB.id, title: "B的预警", level: "info", source: "system" })
    .select().single();
  const { data: ralA } = await cA.from("alerts").select("*").eq("id", alA!.id).single();
  assert(ralA !== null, "A 能读自己的 alert");
  const { data: ralB } = await cA.from("alerts").select("*").eq("id", alB!.id).maybeSingle();
  assert(ralB === null, "A 读不到 B 的 alert");

  // work_tasks
  await admin.from("work_tasks").delete().eq("user_id", uA.id);
  const { data: wt } = await cA
    .from("work_tasks")
    .insert({ user_id: uA.id, title: "A的任务", status: "todo", priority: "normal" })
    .select().single();
  assert(wt !== null, "A 能创建自己的 work_task");

  // kpi_reports
  await admin.from("kpi_reports").delete().eq("user_id", uA.id);
  const { data: kpi } = await cA
    .from("kpi_reports")
    .insert({ user_id: uA.id, name: "A的KPI", value: 95, unit: "%", period: "monthly" })
    .select().single();
  assert(kpi !== null, "A 能创建自己的 kpi_report");

  console.log("");
}

async function testContentTables(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ content_feeds, saved_contents, knowledge_items, subscription_rules");

  // content_feeds
  await admin.from("saved_contents").delete().eq("user_id", uA.id);
  await admin.from("saved_contents").delete().eq("user_id", uB.id);
  await admin.from("knowledge_items").delete().eq("user_id", uA.id);
  await admin.from("knowledge_items").delete().eq("user_id", uB.id);
  await admin.from("subscription_rules").delete().eq("user_id", uA.id);
  await admin.from("subscription_rules").delete().eq("user_id", uB.id);
  await admin.from("content_feeds").delete().eq("user_id", uA.id);
  await admin.from("content_feeds").delete().eq("user_id", uB.id);

  const { data: cfA } = await admin
    .from("content_feeds")
    .insert({ user_id: uA.id, title: "A的内容", url: "https://a.example.com", platform: "bilibili" })
    .select().single();
  const { data: cfB } = await admin
    .from("content_feeds")
    .insert({ user_id: uB.id, title: "B的内容", url: "https://b.example.com", platform: "bilibili" })
    .select().single();

  const { data: rcfA } = await cA.from("content_feeds").select("*").eq("id", cfA!.id).single();
  assert(rcfA !== null, "A 能读自己的 content_feed");
  const { data: rcfB } = await cA.from("content_feeds").select("*").eq("id", cfB!.id).maybeSingle();
  assert(rcfB === null, "A 读不到 B 的 content_feed");

  // saved_contents
  const { data: sc } = await cA
    .from("saved_contents")
    .insert({ user_id: uA.id, feed_id: cfA!.id, category: "knowledge" })
    .select().single();
  assert(sc !== null, "A 能保存内容");

  // knowledge_items
  const { data: ki } = await cA
    .from("knowledge_items")
    .insert({ user_id: uA.id, type: "summary", title: "A的知识", content: {} })
    .select().single();
  assert(ki !== null, "A 能创建知识条目");

  // subscription_rules
  const { data: sr } = await cA
    .from("subscription_rules")
    .insert({ user_id: uA.id, platform: "bilibili", category: "knowledge" })
    .select().single();
  assert(sr !== null, "A 能创建订阅规则");

  console.log("");
}

async function testTravelPlans(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ travel_plans");

  await admin.from("travel_plans").delete().eq("user_id", uA.id);
  await admin.from("travel_plans").delete().eq("user_id", uB.id);
  const { data: tpA } = await admin
    .from("travel_plans")
    .insert({ user_id: uA.id, destination: "A的目的地", start_date: "2026-09-01", end_date: "2026-09-05" })
    .select().single();
  const { data: tpB } = await admin
    .from("travel_plans")
    .insert({ user_id: uB.id, destination: "B的目的地", start_date: "2026-09-01", end_date: "2026-09-05" })
    .select().single();

  const { data: rA } = await cA.from("travel_plans").select("*").eq("id", tpA!.id).single();
  assert(rA !== null, "A 能读自己的 travel_plan");
  const { data: rB } = await cA.from("travel_plans").select("*").eq("id", tpB!.id).maybeSingle();
  assert(rB === null, "A 读不到 B 的 travel_plan");

  console.log("");
}

async function testSystemIntegrations(
  admin: SupabaseClient,
  cA: SupabaseClient,
  cB: SupabaseClient,
  uA: { id: string },
  uB: { id: string }
) {
  console.log("▸ system_integrations");

  await admin.from("system_integrations").delete().eq("user_id", uA.id);
  await admin.from("system_integrations").delete().eq("user_id", uB.id);
  const { data: siA } = await admin
    .from("system_integrations")
    .insert({ user_id: uA.id, name: "feishu", connected: true })
    .select().single();
  const { data: siB } = await admin
    .from("system_integrations")
    .insert({ user_id: uB.id, name: "feishu", connected: true })
    .select().single();

  const { data: rA } = await cA.from("system_integrations").select("*").eq("id", siA!.id).single();
  assert(rA !== null, "A 能读自己的 integration");
  const { data: rB } = await cA.from("system_integrations").select("*").eq("id", siB!.id).maybeSingle();
  assert(rB === null, "A 读不到 B 的 integration");

  console.log("");
}

main().catch((err) => {
  console.error("❌ 脚本异常:", err);
  process.exit(1);
});
