"use client";

import { useCallback } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  InboxItem,
  Approval,
  Alert,
  WorkTask,
  KPIReport,
  FamilyMember,
  HealthRecord,
  ChildGrowthRecord,
  CheckinHabit,
  CheckinRecord,
  FinanceRecord,
  SavingsGoal,
  WardrobeItem,
  Outfit,
  TravelPlan,
  ContentFeed,
  SavedContent,
  KnowledgeItem,
  SubscriptionRule,
} from "@/types";

// ================================================================
// Generic CRUD hook — wraps Supabase queries with fallback
// ================================================================
export interface ListOptions {
  /** 归属列，默认 user_id。child_growth_records 用 family_member_id */
  scopeColumn?: string;
  /** 排序。不传的话 PostgREST 不保证顺序，UI 每次刷新排列都可能变 */
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
}

function useTable<T>(tableName: string, defaults: ListOptions = {}) {
  const ready = isSupabaseConfigured();
  const { scopeColumn: defScope, orderBy: defOrder, limit: defLimit } = defaults;

  const list = useCallback(async (scopeValue?: string, opts: ListOptions = {}): Promise<T[]> => {
    if (!ready) return [];
    const scopeColumn = opts.scopeColumn ?? defScope ?? "user_id";
    const orderBy = opts.orderBy ?? defOrder;
    const limit = opts.limit ?? defLimit;

    let q = getSupabase().from(tableName).select("*");
    if (scopeValue) q = q.eq(scopeColumn, scopeValue);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? false });
    if (limit) q = q.limit(limit);

    const { data, error } = await q;
    if (error) { console.error(`[DB] ${tableName}.list:`, error); throw new Error(error.message); }
    return (data as T[]) ?? [];
  }, [tableName, ready, defScope, defOrder, defLimit]);

  const getById = useCallback(async (id: string): Promise<T | null> => {
    if (!ready) return null;
    const { data, error } = await getSupabase().from(tableName).select("*").eq("id", id).single();
    if (error) { console.error(`[DB] ${tableName}.get:`, error); return null; }
    return data as T;
  }, [tableName, ready]);

  const insert = useCallback(async (record: Partial<T>): Promise<T | null> => {
    if (!ready) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await getSupabase().from(tableName).insert(record as any).select().single();
    if (error) { console.error(`[DB] ${tableName}.insert:`, error); return null; }
    return data as T;
  }, [tableName, ready]);

  const update = useCallback(async (id: string, updates: Partial<T>): Promise<T | null> => {
    if (!ready) return null;
    const { data, error } = await getSupabase().from(tableName).update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) { console.error(`[DB] ${tableName}.update:`, error); return null; }
    return data as T;
  }, [tableName, ready]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (!ready) return false;
    const { error } = await getSupabase().from(tableName).delete().eq("id", id);
    return !error;
  }, [tableName, ready]);

  return { ready, list, getById, insert, update, remove };
}

// ================================================================
// Typed hooks for each entity
// ================================================================
export function useInbox() { return useTable<InboxItem>("inbox_items", { orderBy: { column: "created_at" } }); }
export function useApprovals() { return useTable<Approval>("approvals"); }
export function useAlerts() { return useTable<Alert>("alerts"); }
export function useWorkTasks() { return useTable<WorkTask>("work_tasks", { orderBy: { column: "created_at" } }); }
export function useKPIReports() { return useTable<KPIReport>("kpi_reports"); }
export function useFamilyMembers() { return useTable<FamilyMember>("family_members"); }
export function useHealthRecords() { return useTable<HealthRecord>("health_records", { orderBy: { column: "date" } }); }
/** 注意：这张表的归属列是 family_member_id，不是 user_id */
export function useChildGrowth() { return useTable<ChildGrowthRecord>("child_growth_records", { scopeColumn: "family_member_id", orderBy: { column: "date", ascending: true } }); }
export function useCheckinHabits() { return useTable<CheckinHabit>("checkin_habits"); }
export function useCheckinRecords() { return useTable<CheckinRecord>("checkin_records", { orderBy: { column: "date" } }); }
export function useFinance() { return useTable<FinanceRecord>("finance_records", { orderBy: { column: "date" } }); }
export function useSavingsGoals() { return useTable<SavingsGoal>("savings_goals"); }
export function useWardrobe() { return useTable<WardrobeItem>("wardrobe_items"); }
export function useOutfits() { return useTable<Outfit>("outfits", { orderBy: { column: "date" } }); }
export function useTravelPlans() { return useTable<TravelPlan>("travel_plans"); }
export function useContentFeeds() { return useTable<ContentFeed>("content_feeds", { orderBy: { column: "published_at" } }); }
export function useSavedContents() { return useTable<SavedContent>("saved_contents"); }
export function useKnowledgeItems() { return useTable<KnowledgeItem>("knowledge_items"); }
export function useSubscriptionRules() { return useTable<SubscriptionRule>("subscription_rules"); }
