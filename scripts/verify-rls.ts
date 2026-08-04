#!/usr/bin/env npx tsx
/**
 * ================================================================
 * RLS 隔离验证 —— 回答一个问题：别人能不能看到我的数据
 * ================================================================
 *
 * 方法论（上一版错在这里，重写时务必守住）：
 *
 *  1. 隔离检查必须走 **anon key + 各自的登录会话**。
 *     service_role 的定义就是绕过 RLS，拿它测 RLS 等于拿万能钥匙测门锁。
 *     本脚本里 service_role 只做两件事：建/删测试账号、代 B 种一行数据
 *     （因为如果 RLS 是对的，A 本来就写不进 B 的行）。
 *
 *  2. **绝不 catch 异常然后判通过**。上一版用 `catch { assert(true) }`，
 *     结果假 key 抛异常也算"拦截成功"，20 张表全绿。异常一律显式失败，
 *     宁可报错也不给假阳性。
 *
 * 用法：
 *   export SUPABASE_URL=https://xxx.supabase.co
 *   export SUPABASE_ANON_KEY=eyJh...            # Settings → API → anon public
 *   export SUPABASE_SERVICE_KEY=eyJh...         # Settings → API → service_role
 *   export TEST_EMAIL_A=... TEST_PASSWORD_A=...
 *   export TEST_EMAIL_B=... TEST_PASSWORD_B=...
 *   npx tsx scripts/verify-rls.ts [--cleanup]
 *
 * ⚠️ service_role key 不受 RLS 限制，泄露等于整库裸奔。
 *    只在本地 shell 里 export 或写进 .env.local（已被 .gitignore 挡住），
 *    不要贴进任何聊天窗口、不要提交、不要进 CI。
 * ================================================================
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_KEY ?? "";
const A_MAIL = process.env.TEST_EMAIL_A ?? "";
const A_PASS = process.env.TEST_PASSWORD_A ?? "";
const B_MAIL = process.env.TEST_EMAIL_B ?? "";
const B_PASS = process.env.TEST_PASSWORD_B ?? "";
const CLEANUP = process.argv.includes("--cleanup");

const missing = Object.entries({
  SUPABASE_URL: URL_, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_KEY: SERVICE,
  TEST_EMAIL_A: A_MAIL, TEST_PASSWORD_A: A_PASS, TEST_EMAIL_B: B_MAIL, TEST_PASSWORD_B: B_PASS,
}).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("缺少环境变量：" + missing.join(", "));
  process.exit(1);
}
if (ANON === SERVICE) {
  console.error("ANON_KEY 和 SERVICE_KEY 相同 —— 那样测不出任何东西，请检查。");
  process.exit(1);
}

let pass = 0, fail = 0;
const results: { table: string; check: string; ok: boolean; note: string }[] = [];

function record(table: string, check: string, ok: boolean, note = "") {
  results.push({ table, check, ok, note });
  if (ok) { pass++; console.log(`    ✅ ${check}`); }
  else { fail++; console.log(`    ❌ ${check}${note ? "　" + note : ""}`); }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

// ================================================================
// 每张表：归属列 + 一行最小样本
// ================================================================
const TABLES: { name: string; scope: string; row: (uid: string) => Row }[] = [
  { name: "inbox_items", scope: "user_id", row: (u) => ({ user_id: u, content: "RLS 测试", category: "task", status: "pending", priority: "low" }) },
  { name: "wardrobe_items", scope: "user_id", row: (u) => ({ user_id: u, name: "RLS 测试衣物", type: "top", color: "white", season: ["summer"], style: ["casual"] }) },
  { name: "finance_records", scope: "user_id", row: (u) => ({ user_id: u, type: "expense", amount: 1, category: "other", description: "RLS 测试", date: "2026-01-01" }) },
  { name: "savings_goals", scope: "user_id", row: (u) => ({ user_id: u, name: "RLS 测试目标", target_amount: 100, current_amount: 0 }) },
  { name: "family_members", scope: "user_id", row: (u) => ({ user_id: u, name: "RLS 测试成员", role: "self" }) },
  { name: "health_records", scope: "user_id", row: (u) => ({ user_id: u, date: "2026-01-01", steps: 1, source: "manual" }) },
  { name: "checkin_habits", scope: "user_id", row: (u) => ({ user_id: u, name: "RLS 测试习惯", category: "other", active: true }) },
  { name: "approvals", scope: "user_id", row: (u) => ({ user_id: u, title: "RLS 测试审批", applicant: "t", source: "other", status: "pending" }) },
  { name: "alerts", scope: "user_id", row: (u) => ({ user_id: u, title: "RLS 测试预警", description: "t", level: "info", source: "system", resolved: false }) },
  { name: "work_tasks", scope: "user_id", row: (u) => ({ user_id: u, title: "RLS 测试任务", status: "todo", priority: "low" }) },
  { name: "kpi_reports", scope: "user_id", row: (u) => ({ user_id: u, name: "RLS 测试指标", value: 1, unit: "个", trend: "stable", period: "daily", source: "t" }) },
  { name: "content_feeds", scope: "user_id", row: (u) => ({ user_id: u, title: "RLS 测试内容", url: "", platform: "bilibili", author: "t", published_at: "2026-01-01T00:00:00Z", fetched_at: "2026-01-01T00:00:00Z" }) },
  { name: "subscription_rules", scope: "user_id", row: (u) => ({ user_id: u, platform: "bilibili", category: "other", keywords: ["t"], active: true }) },
  { name: "travel_plans", scope: "user_id", row: (u) => ({ user_id: u, destination: "RLS 测试目的地", start_date: "2026-01-01", end_date: "2026-01-02", status: "planning" }) },
  { name: "system_integrations", scope: "user_id", row: (u) => ({ user_id: u, name: "feishu", connected: false }) },
];

async function main() {
  console.log("================================================================");
  console.log("RLS 隔离验证");
  console.log(`Supabase: ${URL_}`);
  console.log(`anon key: ${ANON.slice(0, 12)}…（长度 ${ANON.length}）`);
  console.log("================================================================\n");

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- 准备两个测试账号 ----
  console.log("▸ 准备测试账号");
  const ensureUser = async (email: string, password: string) => {
    const { data: list, error } = await admin.auth.admin.listUsers();
    if (error) throw new Error(`listUsers 失败：${error.message}`);
    const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) { console.log(`  已存在 ${email}`); return found.id; }
    const { data, error: e2 } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (e2 || !data.user) throw new Error(`创建 ${email} 失败：${e2?.message}`);
    console.log(`  已创建 ${email}`);
    return data.user.id;
  };
  const uidA = await ensureUser(A_MAIL, A_PASS);
  const uidB = await ensureUser(B_MAIL, B_PASS);

  // profiles 行（外键依赖）
  for (const [id, mail, name] of [[uidA, A_MAIL, "测试A"], [uidB, B_MAIL, "测试B"]] as const) {
    const { error } = await admin.from("profiles").upsert({ id, email: mail, name }, { onConflict: "id" });
    if (error) console.log(`  ! profiles upsert 警告：${error.message}`);
  }

  // ---- 用真实 anon key 登录，拿到两个受 RLS 约束的 client ----
  console.log("\n▸ 用 anon key 登录（这一步失败说明 anon key 不对）");
  const signIn = async (email: string, password: string): Promise<SupabaseClient> => {
    const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(`${email} 登录失败：${error?.message ?? "无会话"}`);
    console.log(`  ✅ ${email} 已登录`);
    return c;
  };
  const cA = await signIn(A_MAIL, A_PASS);
  const cB = await signIn(B_MAIL, B_PASS);
  const cAnon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- 7 项检查，主表与依赖表共用 ----
  const runChecks = async (name: string, scope: string, rowAId: string, rowBId: string) => {
    // ① A 能读到自己的行
    {
      const { data, error } = await cA.from(name).select("*").eq("id", rowAId);
      record(name, "A 能读自己的行", !error && (data?.length ?? 0) === 1, error?.message ?? "");
    }
    // ② A 读不到 B 的行 —— 最关键的一条
    {
      const { data, error } = await cA.from(name).select("*").eq("id", rowBId);
      record(name, "A 读不到 B 的行", !error && (data?.length ?? 0) === 0,
        error ? error.message : (data?.length ? `⚠️ 泄露了 ${data.length} 行` : ""));
    }
    // ③ A 全表扫描时也看不到 B
    {
      const { data, error } = await cA.from(name).select(scope);
      const leaked = (data ?? []).filter((r: Row) => r[scope] && r[scope] !== uidA).length;
      record(name, "A 全表扫描无越权行", !error && leaked === 0,
        error ? error.message : (leaked ? `⚠️ 混入 ${leaked} 行他人数据` : ""));
    }
    // ④ A 改不了 B 的行
    {
      const { data, error } = await cA.from(name).update({ [scope]: uidA }).eq("id", rowBId).select();
      record(name, "A 改不了 B 的行", Boolean(error) || (data?.length ?? 0) === 0,
        !error && data?.length ? "⚠️ 越权写入成功" : "");
    }
    // ⑤ A 删不了 B 的行
    {
      const { data, error } = await cA.from(name).delete().eq("id", rowBId).select();
      record(name, "A 删不了 B 的行", Boolean(error) || (data?.length ?? 0) === 0,
        !error && data?.length ? "⚠️ 越权删除成功" : "");
    }
    // ⑥ 未登录读不到任何行
    {
      const { data, error } = await cAnon.from(name).select("id").limit(5);
      record(name, "未登录读不到数据", Boolean(error) || (data?.length ?? 0) === 0,
        !error && data?.length ? `⚠️ 匿名读到 ${data.length} 行` : "");
    }
    // ⑦ B 侧对称抽查
    {
      const { data, error } = await cB.from(name).select("*").eq("id", rowAId);
      record(name, "B 读不到 A 的行", !error && (data?.length ?? 0) === 0, error?.message ?? "");
    }
  };

  // ---- 逐表验证 ----
  const planted: { table: string; id: string }[] = [];
  for (const t of TABLES) {
    console.log(`\n▸ ${t.name}`);

    // 用 service_role 代 A、代 B 各种一行（A 本来就不该能写 B 的行）
    const { data: rowA, error: eA } = await admin.from(t.name).insert(t.row(uidA)).select().single();
    const { data: rowB, error: eB } = await admin.from(t.name).insert(t.row(uidB)).select().single();
    if (eA || eB || !rowA || !rowB) {
      record(t.name, "种子数据准备", false, `${eA?.message ?? ""}${eB?.message ?? ""}`.slice(0, 80));
      continue;
    }
    planted.push({ table: t.name, id: rowA.id }, { table: t.name, id: rowB.id });

    await runChecks(t.name, t.scope, rowA.id, rowB.id);
  }

  // ---- child_growth_records：归属靠 family_member_id，单独测 ----
  console.log("\n▸ child_growth_records（归属列是 family_member_id，最容易写漏策略）");
  {
    const { data: mA } = await admin.from("family_members").insert({ user_id: uidA, name: "娃A", role: "child" }).select().single();
    const { data: mB } = await admin.from("family_members").insert({ user_id: uidB, name: "娃B", role: "child" }).select().single();
    if (!mA || !mB) {
      record("child_growth_records", "种子数据准备", false, "family_members 插入失败");
    } else {
      const { data: gA } = await admin.from("child_growth_records").insert({ family_member_id: mA.id, date: "2026-01-01", height_cm: 100 }).select().single();
      const { data: gB } = await admin.from("child_growth_records").insert({ family_member_id: mB.id, date: "2026-01-01", height_cm: 100 }).select().single();
      if (gA && gB) {
        const r1 = await cA.from("child_growth_records").select("*").eq("id", gA.id);
        record("child_growth_records", "A 能读自己孩子的记录", !r1.error && (r1.data?.length ?? 0) === 1, r1.error?.message ?? "");
        const r2 = await cA.from("child_growth_records").select("*").eq("id", gB.id);
        record("child_growth_records", "A 读不到 B 孩子的记录", !r2.error && (r2.data?.length ?? 0) === 0,
          r2.data?.length ? "⚠️ 泄露（策略很可能漏了关联判断）" : "");
        const r3 = await cAnon.from("child_growth_records").select("id").limit(5);
        record("child_growth_records", "未登录读不到数据", Boolean(r3.error) || (r3.data?.length ?? 0) === 0, "");
      }
    }
  }

  // ---- 依赖表：需要先建父行，恰恰因为麻烦最容易漏策略 ----
  console.log("\n▸ 依赖表（有外键，需先建父行）");

  // profiles：存邮箱和姓名，是最敏感的一张，行在建账号时已 upsert
  {
    console.log("\n▸ profiles");
    const r1 = await cA.from("profiles").select("*").eq("id", uidA);
    record("profiles", "A 能读自己的资料", !r1.error && (r1.data?.length ?? 0) === 1, r1.error?.message ?? "");
    const r2 = await cA.from("profiles").select("*").eq("id", uidB);
    record("profiles", "A 读不到 B 的资料", !r2.error && (r2.data?.length ?? 0) === 0,
      r2.data?.length ? "⚠️ 泄露了他人邮箱与姓名" : "");
    const r3 = await cA.from("profiles").select("id");
    const leaked = (r3.data ?? []).filter((r: Row) => r.id !== uidA).length;
    record("profiles", "A 全表扫描无越权行", !r3.error && leaked === 0, leaked ? `⚠️ 混入 ${leaked} 行` : "");
    const r4 = await cA.from("profiles").update({ name: "hacked" }).eq("id", uidB).select();
    record("profiles", "A 改不了 B 的资料", Boolean(r4.error) || (r4.data?.length ?? 0) === 0,
      !r4.error && r4.data?.length ? "⚠️ 越权写入成功" : "");
    const r5 = await cAnon.from("profiles").select("id").limit(5);
    record("profiles", "未登录读不到资料", Boolean(r5.error) || (r5.data?.length ?? 0) === 0,
      !r5.error && r5.data?.length ? `⚠️ 匿名读到 ${r5.data.length} 行` : "");
  }

  // 其余四张依赖表：先用 admin 建父行，再走同一套 7 项检查
  const dependent: { name: string; scope: string; make: (uid: string) => Promise<Row | null> }[] = [
    {
      name: "outfits", scope: "user_id",
      make: async (uid) => {
        const { data: w } = await admin.from("wardrobe_items")
          .insert({ user_id: uid, name: "RLS 父级衣物", type: "top", color: "white", season: ["summer"], style: ["casual"] })
          .select().single();
        if (!w) return null;
        const { data } = await admin.from("outfits")
          .insert({ user_id: uid, date: "2026-01-01", items: [w.id] }).select().single();
        return data;
      },
    },
    {
      name: "checkin_records", scope: "user_id",
      make: async (uid) => {
        const { data: h } = await admin.from("checkin_habits")
          .insert({ user_id: uid, name: "RLS 父级习惯", category: "other", active: true }).select().single();
        if (!h) return null;
        const { data } = await admin.from("checkin_records")
          .insert({ user_id: uid, habit_id: h.id, date: "2026-01-01", completed: true }).select().single();
        return data;
      },
    },
    {
      name: "saved_contents", scope: "user_id",
      make: async (uid) => {
        const { data: f } = await admin.from("content_feeds")
          .insert({ user_id: uid, title: "RLS 父级内容", url: "", platform: "bilibili", author: "t",
                    published_at: "2026-01-01T00:00:00Z", fetched_at: "2026-01-01T00:00:00Z" }).select().single();
        if (!f) return null;
        const { data } = await admin.from("saved_contents")
          .insert({ user_id: uid, feed_id: f.id, category: "other", converted_to_knowledge: false }).select().single();
        return data;
      },
    },
    {
      name: "knowledge_items", scope: "user_id",
      make: async (uid) => {
        const { data } = await admin.from("knowledge_items")
          .insert({ user_id: uid, type: "summary", title: "RLS 测试知识", content: { points: [] } }).select().single();
        return data;
      },
    },
  ];

  for (const d of dependent) {
    console.log(`\n▸ ${d.name}`);
    const rowA = await d.make(uidA);
    const rowB = await d.make(uidB);
    if (!rowA || !rowB) { record(d.name, "种子数据准备", false, "父行或本行插入失败"); continue; }
    planted.push({ table: d.name, id: rowA.id }, { table: d.name, id: rowB.id });
    await runChecks(d.name, d.scope, rowA.id, rowB.id);
  }

  // ---- 汇总 ----
  console.log("\n================================================================");
  console.log(`通过 ${pass}　失败 ${fail}`);
  if (fail > 0) {
    console.log("\n失败明细：");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ❌ ${r.table} → ${r.check}　${r.note}`));
    console.log("\n⚠️ 有失败项就不要上线。RLS 漏一张表，那张表的数据对所有登录用户都是公开的。");
  } else {
    console.log("✅ 全部通过。建议把本次输出存进 docs/RLS_VERIFICATION.md 作为审计痕迹。");
  }

  // ---- 清理 ----
  if (CLEANUP) {
    console.log("\n▸ 清理测试数据");
    for (const p of planted) await admin.from(p.table).delete().eq("id", p.id);
    await admin.from("family_members").delete().eq("user_id", uidA).like("name", "娃%");
    await admin.from("family_members").delete().eq("user_id", uidB).like("name", "娃%");
    console.log("  已删除本次插入的测试行（测试账号保留，如需删除请到 Supabase 后台）");
  } else {
    console.log("\n提示：加 --cleanup 可自动删除本次插入的测试数据");
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("\n执行中断：", e.message); process.exit(1); });
