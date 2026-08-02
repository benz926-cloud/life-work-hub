"use client";

import type { ReactNode } from "react";
import {
  LayoutDashboard, Inbox, Radio, FileCheck, BarChart3, Bell, CheckSquare, Heart,
  GraduationCap, Plane, Shirt, Wallet, Target, Settings, ChevronLeft,
} from "lucide-react";
import { SIDEBAR_NAV, type NavSection } from "@/lib/navigation";

interface NavItem { id: string; label: string; icon: string; isNew?: boolean; badge?: number; }
const iconMap: Record<string, ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={18} />, Inbox: <Inbox size={18} />, Radio: <Radio size={18} />, FileCheck: <FileCheck size={18} />,
  BarChart3: <BarChart3 size={18} />, Bell: <Bell size={18} />, CheckSquare: <CheckSquare size={18} />, Heart: <Heart size={18} />,
  GraduationCap: <GraduationCap size={18} />, Plane: <Plane size={18} />, Shirt: <Shirt size={18} />, Wallet: <Wallet size={18} />,
  Target: <Target size={18} />, Settings: <Settings size={18} />,
};
const sectionLabels: Record<NavSection, string> = { core: "核心", work: "工作", family: "家庭", life: "生活", system: "系统" };

export default function Sidebar({ activeView, onNavigate, collapsed, onToggle }: { activeView: string; onNavigate: (view: string) => void; collapsed: boolean; onToggle: () => void; }) {
  return (
    <aside className="safe-top safe-bottom flex h-full flex-col overflow-hidden bg-white/95 backdrop-blur-xl dark:bg-slate-950/95">
      <div className={`flex h-14 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-800 ${collapsed ? "justify-center px-2" : "gap-3"}`}>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-600 to-teal-600 text-sm font-bold text-white shadow-sm">L</div>
        <span className={`overflow-hidden whitespace-nowrap text-sm font-semibold text-slate-900 transition-all duration-300 dark:text-white ${collapsed ? "w-0 opacity-0" : "w-32 opacity-100"}`}>Life Work Hub</span>
      </div>
      <nav aria-label="主导航" className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-4">
          {(Object.entries(SIDEBAR_NAV) as [NavSection, typeof SIDEBAR_NAV[NavSection]][]).map(([section, items]) => (
            <div key={section}>
              <div className={`mb-1 h-4 overflow-hidden px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 transition-all duration-300 dark:text-slate-500 ${collapsed ? "opacity-0" : "opacity-100"}`}>{sectionLabels[section]}</div>
              {items.map((item) => {
                const navItem = item as NavItem;
                const selected = activeView === navItem.id;
                return <button key={navItem.id} onClick={() => onNavigate(navItem.id)} title={collapsed ? navItem.label : undefined} aria-current={selected ? "page" : undefined} className={`group relative mb-0.5 flex w-full items-center rounded-xl py-2 text-sm transition-all duration-200 ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${selected ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"}`}>
                  <span className="shrink-0">{iconMap[navItem.icon]}</span>
                  <span className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>{navItem.label}</span>
                  {!collapsed && navItem.isNew && <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">NEW</span>}
                  {!collapsed && Boolean(navItem.badge) && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{navItem.badge}</span>}
                  {collapsed && <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">{navItem.label}</span>}
                </button>;
              })}
            </div>
          ))}
        </div>
      </nav>
      <button onClick={onToggle} className="hidden h-11 shrink-0 items-center justify-center border-t border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-800 lg:flex dark:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200" aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}>
        <ChevronLeft size={17} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </aside>
  );
}
