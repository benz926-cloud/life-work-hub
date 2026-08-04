#!/usr/bin/env node

/**
 * ============================================================
 * seed-agent-outputs.ts — 从飞书拉真实数据写入 agent_outputs
 *
 * Pre-req: agent_outputs 表已建（跑 supabase/migrations/001_agent_outputs.sql）
 * Usage:   source .env.local && npx tsx scripts/seed-agent-outputs.ts
 * ============================================================
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://czgstjicmvtkdsjpdoni.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// air999@qq.com
const USER_ID = "7b8eab6a-d5fe-4ae1-8fe4-0e1fbeaf3d32";

if (!SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY not set. source .env.local first.");
  process.exit(1);
}

// ============================================================
// Helpers
// ============================================================

const headers = {
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "resolution=merge-duplicates", // upsert mode
};

type Output = {
  user_id: string;
  kind: string;       // brief | approval | message | report | task | content
  source: string;     // feishu | email | oa | bitable | xiaohongshu | manual
  title: string;
  summary: string;
  detail: Record<string, unknown>;
  severity: string;   // urgent | attention | info
  action_url?: string;
  status: string;     // new | read | done | dismissed
  external_id?: string;
  occurred_at: string;
};

async function upsert(rows: Output[]): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/agent_outputs`;
  const body = JSON.stringify(rows);
  const resp = await fetch(url, { method: "POST", headers, body });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`  ❌ upsert failed (${resp.status}): ${err.slice(0, 200)}`);
  } else {
    console.log(`  ✅ upserted ${rows.length} row(s)`);
  }
}

// ============================================================
// kind="report" — 任务检查报告
// ============================================================

const reportRows: Output[] = [
  {
    user_id: USER_ID,
    kind: "report",
    source: "feishu",
    title: "Q3 重点任务总览 — 刘立成 OKR/KPI",
    summary: "17 项待办中 1 项已逾期（纳米钙 KR1），钢渣 4 项、降本 5 项推进中",
    detail: {
      period: "2026-Q3",
      total_count: 17,
      completed_count: 0,
      pending: [
        { who: "刘立成", what: "[纳米钙] 招议标资料清单及评分表 KR1", overdue_days: 29 },
        { who: "刘立成", what: "[降本] 上半年降本增效口径问题清单 KR1", overdue_days: 19 },
        { who: "刘立成", what: "[降本] 降本增效统一核算规则与剔重原则 KR2", overdue_days: 3 },
      ],
      categories: [
        { name: "纳米钙项目", total: 5, pending: 5 },
        { name: "钢渣综合利用", total: 4, pending: 4 },
        { name: "降本增效", total: 5, pending: 5 },
        { name: "纪律建设", total: 1, pending: 1 },
        { name: "审计整改", total: 2, pending: 2 },
      ],
    },
    severity: "attention",
    action_url: "https://applink.feishu.cn/client/todo/detail?guid=4835b2b9-d8ca-4ca2-9fb9-3209cb1ccc21",
    status: "new",
    external_id: "feishu-task-summary-q3",
    occurred_at: "2026-08-04T00:00:00+08:00",
  },
  {
    user_id: USER_ID,
    kind: "report",
    source: "feishu",
    title: "已完成任务 — 近 30 天",
    summary: "10 项 P0/P1 任务已完成，覆盖审计、风险、数字化等 6 个领域",
    detail: {
      period: "2026-07",
      total_count: 10,
      completed_count: 10,
      completed: [
        { what: "P0-01 项目全生命周期打通", due: "2026-07-03" },
        { what: "P0-02 修复关键指标口径和接口", due: "2026-07-03" },
        { what: "P0-03 补齐审计整改销号证据", due: "2026-07-05" },
        { what: "P0-04 Q2 OKR逐条补录验收证据", due: "2026-07-01" },
        { what: "P1-05 风险预警补齐关闭动作", due: "2026-07-05" },
        { what: "P1-06 补齐挽损减支证明链", due: "2026-07-05" },
        { what: "P1-07 建立审计建议采纳台账", due: "2026-07-06" },
        { what: "P1-08 补齐监察案件查处闭环证据", due: "2026-07-06" },
        { what: "P1-09 推动数字化平台应用闭环", due: "2026-07-07" },
        { what: "P2-10 人员优化KR补合规资料", due: "2026-07-10" },
      ],
    },
    severity: "info",
    action_url: "https://applink.feishu.cn/client/todo/detail?guid=4835b2b9-d8ca-4ca2-9fb9-3209cb1ccc21",
    status: "new",
    external_id: "feishu-task-completed-jul",
    occurred_at: "2026-08-04T00:00:00+08:00",
  },
];

// ============================================================
// kind="task" — 逾期/近期到期任务
// ============================================================

const taskRows: Output[] = [
  {
    user_id: USER_ID,
    kind: "task",
    source: "feishu",
    title: "⚠️ 逾期 — 纳米钙项目 KR1 招议标资料清单及评分表",
    summary: "截止 7/5，已逾期 29 天",
    detail: {
      assignee: "刘立成",
      category: "纳米钙项目",
      weight: "30%",
      due_date: "2026-07-05",
      overdue_days: 29,
    },
    severity: "urgent",
    action_url: "https://applink.feishu.cn/client/todo/detail?guid=37f1a53e-8ec7-4a65-93d8-fd3808226ff1",
    status: "new",
    external_id: "feishu-task-nano-calcium-kr1",
    occurred_at: "2026-07-05T08:00:00+08:00",
  },
  {
    user_id: USER_ID,
    kind: "task",
    source: "feishu",
    title: "⚠️ 逾期 — 降本增效口径问题清单 KR1",
    summary: "截止 7/15，已逾期 19 天",
    detail: {
      assignee: "刘立成",
      category: "降本增效",
      weight: "35%",
      due_date: "2026-07-15",
      overdue_days: 19,
    },
    severity: "urgent",
    action_url: "https://applink.feishu.cn/client/todo/detail?guid=1443f155-a3c3-4311-af74-b1f1cf003dd3",
    status: "new",
    external_id: "feishu-task-cost-reduction-kr1",
    occurred_at: "2026-07-15T08:00:00+08:00",
  },
  {
    user_id: USER_ID,
    kind: "task",
    source: "feishu",
    title: "📌 本周到期 — 降本增效核算规则 KR2",
    summary: "截止 7/31，已逾期 3 天",
    detail: {
      assignee: "刘立成",
      category: "降本增效",
      weight: "35%",
      due_date: "2026-07-31",
      overdue_days: 3,
    },
    severity: "attention",
    action_url: "https://applink.feishu.cn/client/todo/detail?guid=d68c4be8-1da7-429a-8cd7-dad3695fc5cf",
    status: "new",
    external_id: "feishu-task-cost-reduction-kr2",
    occurred_at: "2026-07-31T08:00:00+08:00",
  },
  {
    user_id: USER_ID,
    kind: "task",
    source: "feishu",
    title: "📋 未完成 — 建立每周五一页纸周汇报机制",
    summary: "截至 7/31，纪律项待启动",
    detail: {
      assignee: "刘立成",
      category: "纪律建设",
      weight: "5%",
      due_date: "2026-07-31",
      overdue_days: 3,
    },
    severity: "attention",
    action_url: "https://applink.feishu.cn/client/todo/detail?guid=715a8aaf-299c-48d8-8e5a-ec3574e73fb8",
    status: "new",
    external_id: "feishu-task-weekly-report",
    occurred_at: "2026-07-31T08:00:00+08:00",
  },
  {
    user_id: USER_ID,
    kind: "task",
    source: "feishu",
    title: "📌 即将到期 — 纳米钙项目 KR2 三家单位技术澄清纪要",
    summary: "截止 7/25，剩余 0 天缓冲",
    detail: {
      assignee: "刘立成",
      category: "纳米钙项目",
      weight: "30%",
      due_date: "2026-07-25",
      overdue_days: 9,
    },
    severity: "attention",
    action_url: "https://applink.feishu.cn/client/todo/detail?guid=12f9173c-ed10-4bfb-a213-d34f82912fa1",
    status: "new",
    external_id: "feishu-task-nano-calcium-kr2",
    occurred_at: "2026-07-25T08:00:00+08:00",
  },
];

// ============================================================
// kind="message" — 飞书群聊消息要点
// ============================================================

const messageRows: Output[] = [
  {
    user_id: USER_ID,
    kind: "message",
    source: "feishu",
    title: "[镔鑫] 备件采购 AI 审批 — 明天上午 8 点讨论",
    summary: "吴明德 @ 李浩：希望在申请环节就用 AI 搞定，明天上午研究",
    detail: {
      chat_name: "镔鑫钢铁集团",
      sender: "吴明德",
      mentioned_me: false,
      unread_count: 48,
      key_points: [
        "EAM系统提报已匹配库存/在途信息，但备件采购条目较多",
        "吴明德希望AI在申请环节就介入，不是事后审核",
        "王伟伟：需要定义'审'的规则交给AI出审批结论",
        "明天上午8点研究具体方案"
      ],
      needs_reply: true,
    },
    severity: "attention",
    action_url: "https://applink.feishu.cn/client/chat/open?openChatId=oc_28ae85b0d7849dab51b5511fd9f95ce3&position=1333",
    status: "new",
    external_id: "feishu-msg-oc28ae-bx-ai-approval",
    occurred_at: "2026-08-03T21:55:00+08:00",
  },
  {
    user_id: USER_ID,
    kind: "message",
    source: "feishu",
    title: "[镔鑫] 育儿假通知 — 本周五前填报",
    summary: "郑晴晴通知：家有三岁以内宝宝请在北森填报家庭成员信息，审核后可生成育儿假额度",
    detail: {
      chat_name: "镔鑫钢铁集团",
      sender: "郑晴晴",
      mentioned_me: false,
      unread_count: 49,
      key_points: [
        "三岁以内宝宝家长需在北森-我的档案-信息变更申请-家庭成员填报",
        "审核通过后生成育儿假额度，一年10天",
        "每年用不完不结转，到三岁自动清零",
        "本周五之前完成填报"
      ],
      needs_reply: false,
    },
    severity: "info",
    action_url: "https://applink.feishu.cn/client/chat/open?openChatId=oc_28ae85b0d7849dab51b5511fd9f95ce3&position=1333",
    status: "new",
    external_id: "feishu-msg-oc28ae-childcare-leave",
    occurred_at: "2026-08-04T09:47:00+08:00",
  },
  {
    user_id: USER_ID,
    kind: "message",
    source: "feishu",
    title: "[镔鑫] AI 审批节点讨论 — 群聊共识",
    summary: "李浩/王伟伟/吴明德讨论 AI 在审批流中的位置：'审'是关键，'看'量太大不起作用",
    detail: {
      chat_name: "镔鑫钢铁集团",
      sender: "李浩",
      mentioned_me: false,
      unread_count: 50,
      key_points: [
        "李浩：可在流程审批中增加AI节点提供数据支撑",
        "吴明德：拉出来'审'是关键，'看'数量级太大不起作用",
        "王伟伟：需要定义规则，让AI出审批结论"
      ],
      needs_reply: false,
    },
    severity: "info",
    action_url: "https://applink.feishu.cn/client/chat/open?openChatId=oc_28ae85b0d7849dab51b5511fd9f95ce3",
    status: "new",
    external_id: "feishu-msg-oc28ae-ai-node-discussion",
    occurred_at: "2026-08-03T22:04:00+08:00",
  },
];

// ============================================================
// kind="approval" — 手工汇总，写真实但没有审批 API 所以标记 source=manual
// ============================================================

const approvalRows: Output[] = [
  {
    user_id: USER_ID,
    kind: "approval",
    source: "manual",
    title: "📝 待跟进 — 审计部整改意见单闭环推进",
    summary: "审计部整改意见单闭环推进，已逾期",
    detail: {
      applicant: "审计部",
      reason: "整改意见单闭环推进",
      due_date: "2026-07-07",
      ai_suggestion: "建议优先处理。逾期近一个月，尽快确认整改方案并闭环。",
      ai_concerns: ["已逾期 28 天，无跟进记录"],
    },
    severity: "urgent",
    action_url: "https://applink.feishu.cn/client/todo/detail?guid=22051ff0-9f84-495b-8860-adc439458433",
    status: "new",
    external_id: "feishu-approval-audit-rectify",
    occurred_at: "2026-07-07T08:00:00+08:00",
  },
];

// ============================================================
// kind="brief" — 邮件（QQ邮箱未认证，暂无数据）
// 注释保留接口，待配置 QQ_EMAIL_ACCOUNT / QQ_EMAIL_AUTH_CODE 后接入
// ============================================================

// ============================================================
// Execute
// ============================================================

async function main() {
  const allRows = [...reportRows, ...taskRows, ...messageRows, ...approvalRows];
  console.log(`\n📊 准备写入 ${allRows.length} 条记录:\n`);
  for (const r of allRows) {
    console.log(`  [${r.kind}] ${r.severity.padEnd(10)} ${r.title.slice(0, 60)}`);
  }
  console.log();

  await upsert(allRows);

  // Summary
  const byKind: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const r of allRows) {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  }
  console.log("\n📈 按 kind:", JSON.stringify(byKind));
  console.log("📈 按 severity:", JSON.stringify(bySeverity));
  console.log("\n✅ Done.\n");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
