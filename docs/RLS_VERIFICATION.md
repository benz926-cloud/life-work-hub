# RLS 隔离验证报告

> **日期**：2026-08-04
> **Supabase**：czgstjicmvtkdsjpdoni.supabase.co
> **验证脚本**：`scripts/verify-rls.ts`（commit `695bedc`）
> **测试账号**：rlstest-a2@benz.test / rlstest-b2@benz.test（由脚本用 admin API 自动创建）

## 结果：✅ 141 / 141 全部通过

覆盖 schema 全部 **21 张表**。

## 方法论

隔离检查全部走 **anon key + 各自的登录会话**。`service_role` 仅用于两件事：
创建测试账号、代 B 种一行数据（因为如果 RLS 正确，A 本来就写不进 B 的行）。

> 这一点是关键。`service_role` 的定义就是绕过 RLS，用它做隔离检查等于拿万能钥匙
> 测门锁，结果必然全绿且毫无意义。脚本启动时会校验 anon key ≠ service key，
> 相同则直接拒绝执行。

脚本不吞异常——每项检查显式判定，任一失败即 `exit 1`。

## 检查维度

标准 7 项（15 张主表 + 4 张依赖表）：

1. A 能读自己的行
2. **A 读不到 B 的行**（核心隔离）
3. A 全表扫描无越权行
4. A 改不了 B 的行
5. A 删不了 B 的行
6. **未登录读不到数据**（防公开泄露）
7. B 读不到 A 的行（对称验证）

## 逐表结果

| 分类 | 表 | 检查数 | 结果 |
|---|---|---|---|
| 主表 | inbox_items / wardrobe_items / finance_records / savings_goals / family_members / health_records / checkin_habits / approvals / alerts / work_tasks / kpi_reports / content_feeds / subscription_rules / travel_plans / system_integrations | 15 × 7 = 105 | ✅ |
| 依赖表 | outfits / checkin_records / saved_contents / knowledge_items | 4 × 7 = 28 | ✅ |
| 用户资料 | profiles | 5 | ✅ |
| 关联归属 | child_growth_records | 3 | ✅ |
| **合计** | **21 张表** | **141** | **✅ 0 失败** |

## 两张需要特别说明的表

**`profiles`** —— 存邮箱和姓名，是全库最敏感的一张。策略写错会导致所有登录用户
都能拉到全部用户的联系方式。已验证 A 读不到 B 的资料、也改不了。

**`child_growth_records`** —— 这张表**没有 `user_id` 列**，归属靠
`family_member_id → family_members.user_id` 两级关联判断，是最容易写漏策略的一张。
已验证 A 能读自己孩子的记录、读不到 B 孩子的记录。

## 已知边界

- 本次验证的是**当前 schema 的策略状态**。今后新增表或修改策略后必须重跑。
- 测试数据未清理（可用 `--cleanup` 删除）。测试账号 `rlstest-a2@` / `rlstest-b2@`
  仍在 Supabase 中，上线前建议手动删除。
- 未覆盖：Storage buckets（项目目前未使用）、Realtime 订阅通道的权限。

## 复现

```bash
set -a && source .env.local && set +a
npx tsx scripts/verify-rls.ts
```

需要 `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` /
`TEST_EMAIL_A|B` / `TEST_PASSWORD_A|B`。service_role key 不进仓库、不进 CI。
