"use client";

import { ChevronDown, Sparkles, TriangleAlert } from "lucide-react";

export function AITrust({ source, degraded, reasons, className = "" }: { source: "local" | "llm" | "hybrid"; degraded?: boolean; reasons: string[]; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    {source === "hybrid" && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><Sparkles size={12} />AI 增强</span>}
    {degraded && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><TriangleAlert size={12} />AI 暂不可用，已用本地规则</span>}
    {reasons.length > 0 && <details className="group text-xs text-slate-500 dark:text-slate-400"><summary className="flex cursor-pointer list-none items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200">为什么这么推荐 <ChevronDown size={13} className="transition-transform group-open:rotate-180" /></summary><ul className="mt-2 max-w-xl space-y-1 rounded-xl bg-slate-50 p-2.5 leading-5 dark:bg-slate-800/80">{reasons.slice(0, 4).map((reason) => <li key={reason}>• {reason}</li>)}</ul></details>}
  </div>;
}
