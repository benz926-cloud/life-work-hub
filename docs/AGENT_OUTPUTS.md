# AGENT_OUTPUTS — 卡片数据契约

三方共享的 `agent_outputs` 表结构和 detail JSONB 形状约定。

## 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | 主键，自动生成 |
| `user_id` | uuid → profiles.id | 所属用户 |
| `kind` | text | 卡片类型：brief / approval / message / report / task / content |
| `source` | text | 数据来源：feishu / email / oa / bitable / xiaohongshu / manual |
| `title` | text | 卡片标题 |
| `summary` | text | 一句话结论，卡片正面显示 |
| `detail` | jsonb | 结构化内容，形状由 kind 决定（见下方约定） |
| `severity` | text | urgent / attention / info |
| `action_url` | text | 点进去跳回原始位置（飞书链接/邮件链接等） |
| `status` | text | new / read / done / dismissed |
| `external_id` | text | 原系统唯一 ID，用于 upsert 去重 |
| `occurred_at` | timestamptz | 事件发生时间 |
| `created_at` | timestamptz | 写入时间 |
| `updated_at` | timestamptz | 最后修改时间 |

## Detail 形状约定

### kind = "brief" — 邮件要点

```jsonc
{
  "from": "sender@example.com",       // 发件人
  "needs_reply": true,                // 是否需要回复
  "deadline": "2026-08-05",           // 可选，回复截止日期
  "key_points": [                     // 提取的关键要点
    "合同续签条款有变更",
    "要求本周内回复"
  ]
}
```

### kind = "approval" — OA 审批

```jsonc
{
  "applicant": "张伟",
  "amount": 2800,                     // 可选，金额
  "reason": "出差差旅费",
  "due_date": "2026-08-06",           // 可选，审批截止日期
  "ai_suggestion": "建议通过。金额在标准内，附件齐全。",
  "ai_concerns": [                    // 可选，风险点
    "发票日期与出差单差 2 天"
  ]
}
```

### kind = "message" — 飞书消息 / 群聊

```jsonc
{
  "chat_name": "产线智能化项目群",
  "sender": "李明",
  "mentioned_me": true,               // 是否被 @
  "unread_count": 12,                 // 未读消息数
  "key_points": [                     // 提取的关键信息
    "3号线改造方案需要你确认",
    "预算超了 8%"
  ],
  "needs_reply": true                 // 是否需要回复
}
```

### kind = "report" — 汇报 / 任务检查

```jsonc
{
  "period": "2026-W32",               // 统计周期
  "due_date": "2026-08-08",           // 截止日期
  "pending": [                        // 未完成项
    {
      "who": "王芳",
      "what": "Q3 产能报表",
      "overdue_days": 2
    }
  ],
  "completed_count": 5,               // 已完成数
  "total_count": 8                    // 总数
}
```

## Severity 判定规则

| 级别 | 触发条件 | 示例 |
|------|---------|------|
| **urgent** | 今明两天到期、群里被 @ 且未回、24h 内 deadline | 审批明天截止、被老板 @ 未回 |
| **attention** | 本周内要处理、有人逾期 | 周五到期、团队成员逾期 2 天 |
| **info** | 其余 | 一般通知、已完成的历史记录 |

## 写入规范

- **必须用 upsert**，`onConflict: ['user_id', 'source', 'external_id']`
- 有 `external_id` 的来源（邮件 Message-ID、飞书消息 ID、审批单号）必须填
- 没有 `external_id` 的来源（如手动汇总的 report），不填 external_id，每次产生新行
- **宁缺毋滥**：没有数据的来源就不写。编造的信息会毁掉整块可信度

## 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-04 | 初版：4 种 kind（brief/approval/message/report），3 级 severity |
