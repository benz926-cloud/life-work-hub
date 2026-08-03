"use client";

import { AlertCircle, DatabaseZap, RefreshCw } from "lucide-react";

export function DemoBanner({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return <div role="status" className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"><DatabaseZap size={15} />当前为演示数据，登录后可保存</div>;
}

export function DataError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) return null;
  return <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"><span className="flex items-center gap-2"><AlertCircle size={15} />{error}</span><button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={13} />重试</button></div>;
}

export function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"><p>{title}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
