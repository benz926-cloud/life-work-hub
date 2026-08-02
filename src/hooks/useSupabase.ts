"use client";

import { useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
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
function useTable<T>(tableName: string) {
  const ready = isSupabaseConfigured();

  const list = useCallback(async (userId?: string): Promise<T[]> => {
    if (!ready) return [];
    const q = supabase.from(tableName).select("*");
    if (userId) q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) { console.error(`[DB] ${tableName}.list:`, error); return []; }
    return (data as T[]) ?? [];
  }, [tableName, ready]);

  const getById = useCallback(async (id: string): Promise<T | null> => {
    if (!ready) return null;
    const { data, error } = await supabase.from(tableName).select("*").eq("id", id).single();
    if (error) { console.error(`[DB] ${tableName}.get:`, error); return null; }
    return data as T;
  }, [tableName, ready]);

  const insert = useCallback(async (record: Partial<T>): Promise<T | null> => {
    if (!ready) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.from(tableName).insert(record as any).select().single();
    if (error) { console.error(`[DB] ${tableName}.insert:`, error); return null; }
    return data as T;
  }, [tableName, ready]);

  const update = useCallback(async (id: string, updates: Partial<T>): Promise<T | null> => {
    if (!ready) return null;
    const { data, error } = await supabase.from(tableName).update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) { console.error(`[DB] ${tableName}.update:`, error); return null; }
    return data as T;
  }, [tableName, ready]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (!ready) return false;
    const { error } = await supabase.from(tableName).delete().eq("id", id);
    return !error;
  }, [tableName, ready]);

  return { ready, list, getById, insert, update, remove };
}

// ================================================================
// Typed hooks for each entity
// ================================================================
export function useInbox() { return useTable<InboxItem>("inbox_items"); }
export function useApprovals() { return useTable<Approval>("approvals"); }
export function useAlerts() { return useTable<Alert>("alerts"); }
export function useWorkTasks() { return useTable<WorkTask>("work_tasks"); }
export function useKPIReports() { return useTable<KPIReport>("kpi_reports"); }
export function useFamilyMembers() { return useTable<FamilyMember>("family_members"); }
export function useHealthRecords() { return useTable<HealthRecord>("health_records"); }
export function useChildGrowth() { return useTable<ChildGrowthRecord>("child_growth_records"); }
export function useCheckinHabits() { return useTable<CheckinHabit>("checkin_habits"); }
export function useCheckinRecords() { return useTable<CheckinRecord>("checkin_records"); }
export function useFinance() { return useTable<FinanceRecord>("finance_records"); }
export function useSavingsGoals() { return useTable<SavingsGoal>("savings_goals"); }
export function useWardrobe() { return useTable<WardrobeItem>("wardrobe_items"); }
export function useOutfits() { return useTable<Outfit>("outfits"); }
export function useTravelPlans() { return useTable<TravelPlan>("travel_plans"); }
export function useContentFeeds() { return useTable<ContentFeed>("content_feeds"); }
export function useSavedContents() { return useTable<SavedContent>("saved_contents"); }
export function useKnowledgeItems() { return useTable<KnowledgeItem>("knowledge_items"); }
export function useSubscriptionRules() { return useTable<SubscriptionRule>("subscription_rules"); }
