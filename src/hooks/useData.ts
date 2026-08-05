"use client";

// ================================================================
// 数据层 —— 组件与 Supabase 之间的唯一通道
// ----------------------------------------------------------------
// 给 Codex 的约定：组件不再 import mock-data，改用这里的具名 hook。
// 每个 hook 返回同一个 Collection<T> 结构，接入方式完全一致。
//
// 三条设计原则：
// 1. 未配置 Supabase / 未登录 → 自动回落到 mock 数据，页面照常可用
//    （和 AI 管线同一套哲学：本地兜底，不白屏）。
// 2. 已登录 → 只显示真实数据。空表就是空态，不会"删光了 mock 又冒出来"。
// 3. 写操作一律乐观更新：先改本地、再发请求、失败回滚。
//    勾一个行李清单不该等 300ms 网络往返。
// ================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  useInbox, useApprovals, useAlerts, useWorkTasks, useKPIReports,
  useFamilyMembers, useHealthRecords, useChildGrowth, useCheckinHabits,
  useCheckinRecords, useFinance, useSavingsGoals, useWardrobe, useOutfits,
  useTravelPlans, useContentFeeds, useSubscriptionRules, useIntegrations, useAgentOutputs,
  type ListOptions,
} from "./useSupabase";
import {
  mockInboxItems, mockApprovals, mockAlerts, mockWorkTasks, mockKPIs,
  mockFamilyMembers, mockHealthRecords, mockGrowthRecords, mockHabits,
  mockCheckins, mockFinanceRecords, mockSavingsGoals, mockWardrobeItems,
  mockOutfits, mockTravelPlans, mockContentFeeds, mockSubscriptionRules, mockIntegrations,
} from "@/lib/mock-data";
import type {
  InboxItem, Approval, Alert, WorkTask, KPIReport, FamilyMember, HealthRecord,
  ChildGrowthRecord, CheckinHabit, CheckinRecord, FinanceRecord, SavingsGoal,
  WardrobeItem, Outfit, TravelPlan, ContentFeed, SubscriptionRule, SystemIntegration, AgentOutput,
} from "@/types";

export type DataSource = "supabase" | "mock";

/** 所有数据 hook 的统一返回结构 */
export interface Collection<T extends { id: string }> {
  items: T[];
  loading: boolean;
  error: string | null;
  /** mock = 演示数据（未配置数据库或未登录）；supabase = 真实数据 */
  source: DataSource;
  /** true 表示这是演示数据，UI 应给出提示，且写操作不会持久化 */
  isDemo: boolean;
  refresh: () => Promise<void>;
  create: (input: Partial<T>) => Promise<T | null>;
  update: (id: string, patch: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
}

type Table<T> = ReturnType<typeof useInbox> extends infer R
  ? R extends { list: unknown } ? {
      ready: boolean;
      list: (scopeValue?: string, opts?: ListOptions) => Promise<T[]>;
      insert: (record: Partial<T>) => Promise<T | null>;
      update: (id: string, updates: Partial<T>) => Promise<T | null>;
      remove: (id: string) => Promise<boolean>;
    } : never
  : never;

interface CollectionOptions<T> {
  /** 未配置数据库或未登录时展示的演示数据 */
  mock: T[];
  /** 归属值。默认取当前登录用户 id；child_growth_records 传 family_member_id */
  scopeValue?: string;
  /** 传 false 可跳过自动加载（比如依赖的 id 还没拿到） */
  enabled?: boolean;
}

function useCollection<T extends { id: string }>(
  table: Table<T>,
  options: CollectionOptions<T>
): Collection<T> {
  const { user } = useAuth();
  const { mock, scopeValue, enabled = true } = options;

  const configured = isSupabaseConfigured();
  const scope = scopeValue ?? user?.id;
  // 只有"配置好 + 已登录 + 有归属值 + 未被禁用"时才走真实数据
  const live = configured && Boolean(user) && Boolean(scope) && enabled;

  // 演示数据不进 state，直接在渲染时派生 —— 少一条 setState 路径，也不会
  // 出现「切换登录状态时 state 里还留着上一份数据」。
  const [remote, setRemote] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const items = useMemo<T[]>(() => (live ? (remote ?? []) : mock), [live, remote, mock]);

  const load = useCallback(async () => {
    if (!live || !scope) return;
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await table.list(scope);
      if (my === reqId.current) setRemote(rows); // 丢弃过期响应，避免竞态
    } catch (e) {
      if (my === reqId.current) setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (my === reqId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, scope, table.list]);

  // 挂载即拉数据。这是 set-state-in-effect 规则的典型例外：
  // 「订阅外部数据源」本就是 effect 的正当用途，setState 发生在 await 之后，
  // 竞态由 reqId 兜住（切换归属值时旧响应被丢弃），不会产生级联渲染。
  // 若日后引入 SWR / TanStack Query，这段应整体替换掉，届时可移除本豁免。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // ---- 写操作：乐观更新 + 失败回滚 ----
  const create = useCallback(async (input: Partial<T>): Promise<T | null> => {
    const temp = { ...input, id: `tmp-${Date.now()}`, user_id: user?.id ?? "" } as unknown as T;
    if (!live) return temp; // 演示模式：不持久化，也不假装写成功
    const before = remote ?? [];
    setRemote([temp, ...before]);
    const saved = await table.insert({ ...input, user_id: user?.id } as Partial<T>);
    if (!saved) { setRemote(before); setError("保存失败，已回滚"); return null; }
    setRemote((cur) => (cur ?? []).map((x) => (x.id === temp.id ? saved : x)));
    return saved;
  }, [remote, live, table, user?.id]);

  const update = useCallback(async (id: string, patch: Partial<T>): Promise<T | null> => {
    if (!live) return patch as T; // 演示模式：不持久化，也不假装写成功
    const before = remote ?? [];
    setRemote(before.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const saved = await table.update(id, patch);
    if (!saved) { setRemote(before); setError("更新失败，已回滚"); return null; }
    setRemote((cur) => (cur ?? []).map((x) => (x.id === id ? saved : x)));
    return saved;
  }, [remote, live, table]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (!live) return true;
    const before = remote ?? [];
    setRemote(before.filter((x) => x.id !== id));
    const okDelete = await table.remove(id);
    if (!okDelete) { setRemote(before); setError("删除失败，已回滚"); return false; }
    return true;
  }, [remote, live, table]);

  return useMemo(() => ({
    items,
    loading,
    error,
    source: live ? "supabase" : "mock",
    isDemo: !live,
    refresh: load,
    create,
    update,
    remove,
  }), [items, loading, error, live, load, create, update, remove]);
}

// ================================================================
// 具名 hook —— 组件直接用这些，不要自己拼 useCollection
// ================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useInboxData() { return useCollection<InboxItem>(useInbox() as any, { mock: mockInboxItems }); }
export function useApprovalsData() { return useCollection<Approval>(useApprovals() as any, { mock: mockApprovals }); }
export function useAlertsData() { return useCollection<Alert>(useAlerts() as any, { mock: mockAlerts }); }
export function useWorkTasksData() { return useCollection<WorkTask>(useWorkTasks() as any, { mock: mockWorkTasks }); }
export function useKPIData() { return useCollection<KPIReport>(useKPIReports() as any, { mock: mockKPIs }); }
export function useFamilyMembersData() { return useCollection<FamilyMember>(useFamilyMembers() as any, { mock: mockFamilyMembers }); }
export function useHealthData() { return useCollection<HealthRecord>(useHealthRecords() as any, { mock: mockHealthRecords }); }
export function useCheckinHabitsData() { return useCollection<CheckinHabit>(useCheckinHabits() as any, { mock: mockHabits }); }
export function useCheckinRecordsData() { return useCollection<CheckinRecord>(useCheckinRecords() as any, { mock: mockCheckins }); }
export function useFinanceData() { return useCollection<FinanceRecord>(useFinance() as any, { mock: mockFinanceRecords }); }
export function useSavingsGoalsData() { return useCollection<SavingsGoal>(useSavingsGoals() as any, { mock: mockSavingsGoals }); }
export function useWardrobeData() { return useCollection<WardrobeItem>(useWardrobe() as any, { mock: mockWardrobeItems }); }
export function useOutfitsData() { return useCollection<Outfit>(useOutfits() as any, { mock: mockOutfits }); }
export function useTravelPlansData() { return useCollection<TravelPlan>(useTravelPlans() as any, { mock: mockTravelPlans }); }
export function useContentFeedsData() { return useCollection<ContentFeed>(useContentFeeds() as any, { mock: mockContentFeeds }); }
export function useSubscriptionRulesData() { return useCollection<SubscriptionRule>(useSubscriptionRules() as any, { mock: mockSubscriptionRules }); }
/**
 * 工作驾驶舱的卡片数据。没有 mock —— 这张表天生就是空的（WorkBuddy 没跑就没数据），
 * 空态是正常状态而不是异常，不该拿假数据糊上去。
 */
export function useAgentOutputsData() { return useCollection<AgentOutput>(useAgentOutputs() as any, { mock: [] }); }
export function useSystemIntegrationsData() { return useCollection<SystemIntegration>(useIntegrations() as any, { mock: mockIntegrations }); }

/**
 * 孩子成长记录：这张表的归属列是 family_member_id，不是 user_id。
 * 必须传孩子的 id；拿不到 id 时会停在演示数据上而不是查出别人的记录。
 */
export function useChildGrowthData(familyMemberId?: string) {
  return useCollection<ChildGrowthRecord>(useChildGrowth() as any, {
    mock: mockGrowthRecords,
    scopeValue: familyMemberId,
    enabled: Boolean(familyMemberId),
  });
}
