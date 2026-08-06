/**
 * Seed real OA approval data into agent_outputs
 * Data source: Feishu Approval (北森 HR integrated via Feishu)
 *
 * Usage: source .env.local && npx tsx scripts/seed-oa-approvals.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const USER_ID = '7b8eab6a-d5fe-4ae1-8fe4-0e1fbeaf3d32';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// ── Approval records (from real Feishu approval tasks query 2026-08-06) ──

const approvals = [
  // 1. PENDING — urgent (needs action today)
  {
    user_id: USER_ID,
    kind: 'approval',
    source: 'feishu',
    title: '薪资填报任务流程审批 — 郭翱铨',
    summary: '待审批：2026年7月活动激励薪资填报，发起人郭翱铨',
    detail: {
      applicant: '郭翱铨',
      reason: '薪资填报活动 2026年7月活动激励',
      ai_suggestion: '建议查阅薪资明细后审批。北森系统薪资类审批通常需要核对激励方案与人员名单。',
      ai_concerns: ['需确认激励金额是否在预算范围内', '需确认人员名单与考勤数据一致']
    },
    severity: 'urgent',
    action_url: 'https://www.feishu.cn/approval/BCFCA8A9-E2A0-48FD-B830-3771A97B803F',
    status: 'new',
    external_id: 'BCFCA8A9-E2A0-48FD-B830-3771A97B803F',
    occurred_at: '2026-08-06T00:00:00+08:00',
  },

  // 2. COMPLETED — attention (33-day leave is significant)
  {
    user_id: USER_ID,
    kind: 'approval',
    source: 'feishu',
    title: '事假申请审批通过 — 曾世庚 33天',
    summary: '已通过：曾世庚事假33天（08/05~09/06），需关注岗位交接',
    detail: {
      applicant: '曾世庚',
      reason: '事假 33天（2026/08/05 上半天 ~ 2026/09/06 下半天）',
      ai_suggestion: '已审批通过。33天长假建议确认岗位交接安排和期间联系人。',
      ai_concerns: ['长假期间工作交接是否已落实', '是否需安排代岗人员']
    },
    severity: 'attention',
    action_url: 'https://www.feishu.cn/approval/B49CFC79-81A7-441B-AAF1-2CBFEFE4264C',
    status: 'done',
    external_id: 'B49CFC79-81A7-441B-AAF1-2CBFEFE4264C',
    occurred_at: '2026-08-05T00:00:00+08:00',
  },

  // 3. COMPLETED — info (routine business trip)
  {
    user_id: USER_ID,
    kind: 'approval',
    source: 'feishu',
    title: '出差申请审批通过 — 程乃良 1天',
    summary: '已通过：程乃良出差1天，拜访山东墨龙石油机械洽谈业务',
    detail: {
      applicant: '程乃良',
      reason: '出差1天（2026/08/05），拜访山东墨龙石油机械股份有限公司洽谈业务',
      ai_suggestion: '已审批通过。常规出差审批。',
    },
    severity: 'info',
    action_url: 'https://www.feishu.cn/approval/D4CC4BF5-6993-4D5A-AC6D-D4EF330CD292',
    status: 'done',
    external_id: 'D4CC4BF5-6993-4D5A-AC6D-D4EF330CD292',
    occurred_at: '2026-08-05T00:00:00+08:00',
  },

  // 4. COMPLETED — info (对标学习)
  {
    user_id: USER_ID,
    kind: 'approval',
    source: 'feishu',
    title: '出差申请审批通过 — 裴丹扬 2天',
    summary: '已通过：裴丹扬出差2天，苏州汇川对标学习',
    detail: {
      applicant: '裴丹扬',
      reason: '出差2天（2026/08/03~08/04），苏州汇川对标学习',
      ai_suggestion: '已审批通过。对标学习类出差，建议关注学习成果汇报。',
    },
    severity: 'info',
    action_url: 'https://www.feishu.cn/approval/A5DEFA42-17A4-4C23-8628-FE95C8B77DDC',
    status: 'done',
    external_id: 'A5DEFA42-17A4-4C23-8628-FE95C8B77DDC',
    occurred_at: '2026-08-03T00:00:00+08:00',
  },

  // 5. COMPLETED — info (routine)
  {
    user_id: USER_ID,
    kind: 'approval',
    source: 'feishu',
    title: '调休申请审批通过 — 王建伟 0.5天',
    summary: '已通过：王建伟调休0.5天（08/01下午）',
    detail: {
      applicant: '王建伟',
      reason: '调休0.5天（2026/08/01 下半天）',
      ai_suggestion: '已审批通过。常规调休。',
    },
    severity: 'info',
    action_url: 'https://www.feishu.cn/approval/E7B9664A-F2D6-48D4-94D1-C7EF25DA3FA6',
    status: 'done',
    external_id: 'E7B9664A-F2D6-48D4-94D1-C7EF25DA3FA6',
    occurred_at: '2026-08-01T00:00:00+08:00',
  },

  // 6. COMPLETED — info (org adjustment)
  {
    user_id: USER_ID,
    kind: 'approval',
    source: 'feishu',
    title: '组织调整审批通过 — 张萍萍（镔鑫集团）',
    summary: '已通过：江苏省镔鑫钢铁集团有限公司组织调整申请',
    detail: {
      applicant: '张萍萍',
      reason: '江苏省镔鑫钢铁集团有限公司的组织调整申请（2026-07-27）',
      ai_suggestion: '已审批通过。组织架构调整，建议关注后续人事变动落实。',
    },
    severity: 'info',
    action_url: 'https://www.feishu.cn/approval/B78F953E-E321-4BF4-9F6D-8F1DBC777245',
    status: 'done',
    external_id: 'B78F953E-E321-4BF4-9F6D-8F1DBC777245',
    occurred_at: '2026-07-27T00:00:00+08:00',
  },

  // 7. COMPLETED — info (Offer)
  {
    user_id: USER_ID,
    kind: 'approval',
    source: 'feishu',
    title: 'Offer审批通过 — 吴俊隆',
    summary: '已通过：栖梧冯友源提交的吴俊隆Offer审批申请',
    detail: {
      applicant: '栖梧冯友源',
      reason: '吴俊隆的Offer审批申请',
      ai_suggestion: '已审批通过。招聘Offer类审批，建议跟进入职流程。',
    },
    severity: 'info',
    action_url: 'https://www.feishu.cn/approval/D460554F-19AB-4F29-9687-282EC3073FEA',
    status: 'done',
    external_id: 'D460554F-19AB-4F29-9687-282EC3073FEA',
    occurred_at: '2026-07-30T00:00:00+08:00',
  },
];

// ── Insert via Supabase REST API with upsert (dedup on external_id) ──

async function main() {
  console.log(`\n=== Seeding ${approvals.length} OA approval records ===\n`);

  const url = `${SUPABASE_URL}/rest/v1/agent_outputs`;
  const headers: Record<string, string> = {
    'apikey': SERVICE_KEY!,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation',
  };

  // PostgREST auto-detects conflicts via the unique index idx_agent_outputs_dedup
  const insertUrl = url;

  const res = await fetch(insertUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(approvals),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`INSERT FAILED (${res.status}): ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`✅ Inserted/updated ${data.length} records`);

  // Verify
  const verifyRes = await fetch(
    `${url}?select=kind,source,severity,title,status&order=created_at.desc`,
    { headers: { 'apikey': SERVICE_KEY!, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  );
  const allRows = await verifyRes.json();
  const approvalRows = allRows.filter((r: any) => r.kind === 'approval');
  console.log(`\n=== agent_outputs approval records (${approvalRows.length} total) ===`);
  for (const r of approvalRows) {
    console.log(`  [${r.severity.padEnd(10)}] [${r.source.padEnd(8)}] [${r.status.padEnd(10)}] ${r.title}`);
  }

  // Summary by severity
  const bySev: Record<string, number> = {};
  for (const r of approvalRows) {
    bySev[r.severity] = (bySev[r.severity] || 0) + 1;
  }
  console.log(`\n=== Severity breakdown ===`);
  for (const [sev, cnt] of Object.entries(bySev)) {
    console.log(`  ${sev}: ${cnt}`);
  }

  // Full table summary
  console.log(`\n=== Full agent_outputs table (${allRows.length} total) ===`);
  const byKind: Record<string, number> = {};
  for (const r of allRows) {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  }
  for (const [k, cnt] of Object.entries(byKind)) {
    console.log(`  ${k}: ${cnt}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
