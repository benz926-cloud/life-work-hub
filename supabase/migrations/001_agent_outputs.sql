-- ============================================================
-- Migration 001: agent_outputs table
-- Purpose: 通用卡片表 — WorkBuddy 把飞书/邮箱/OA 等结果写入，
--          应用只读不写，凭证留在本机。
-- Run: Supabase Dashboard → SQL Editor → paste & run
-- ============================================================

-- 1. Create table
create table if not exists agent_outputs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade not null,
  kind        text not null,        -- brief | approval | message | report | task | content
  source      text not null,        -- feishu | email | oa | bitable | xiaohongshu | manual
  title       text not null,
  summary     text,                 -- 一句话结论，卡片正面显示
  detail      jsonb,                -- 结构化内容，形状由 kind 决定
  severity    text not null default 'info',   -- urgent | attention | info
  action_url  text,                 -- 点进去跳回原始位置
  status      text not null default 'new',    -- new | read | done | dismissed
  external_id text,                 -- 原系统的唯一 id，用于去重
  occurred_at timestamptz,          -- 事件发生时间，不是抓取时间
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Indexes
-- 主查询：某用户某类卡片按事件时间排列
create index if not exists idx_agent_outputs_user_kind
  on agent_outputs(user_id, kind, occurred_at desc);

-- 状态过滤
create index if not exists idx_agent_outputs_status
  on agent_outputs(user_id, status);

-- 去重：同一来源的同一外部 ID 只保留一行
-- 只对有 external_id 的行生效（NULL 不会冲突）
create unique index if not exists idx_agent_outputs_dedup
  on agent_outputs(user_id, source, external_id)
  where external_id is not null;

-- 3. RLS — 照抄现有表的写法
alter table agent_outputs enable row level security;

-- SELECT: 只看自己的
create policy "Users can view own agent_outputs"
  on agent_outputs for select
  using (auth.uid() = user_id);

-- INSERT: 只能插入自己的
create policy "Users can insert own agent_outputs"
  on agent_outputs for insert
  with check (auth.uid() = user_id);

-- UPDATE: 只能改自己的
create policy "Users can update own agent_outputs"
  on agent_outputs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: 只能删自己的
create policy "Users can delete own agent_outputs"
  on agent_outputs for delete
  using (auth.uid() = user_id);

-- 4. Updated-at trigger
create or replace function update_agent_outputs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_agent_outputs_updated_at
  before update on agent_outputs
  for each row execute function update_agent_outputs_updated_at();
