"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, Menu, Moon, RefreshCw, Sun, User } from "lucide-react";
import Sidebar from "./Sidebar";
import OverviewPage from "@/components/overview/OverviewPage";
import InboxPage from "@/components/inbox/InboxPage";
import WorkApprovals from "@/components/work/WorkApprovals";
import WorkReports from "@/components/work/WorkReports";
import WorkAlerts from "@/components/work/WorkAlerts";
import WorkTasks from "@/components/work/WorkTasks";
import FamilyHealth from "@/components/family/FamilyHealth";
import ChildGrowth from "@/components/family/ChildGrowth";
import TravelPlan from "@/components/family/TravelPlan";
import WardrobePage from "@/components/wardrobe/WardrobePage";
import FinancePage from "@/components/finance/FinancePage";
import CheckinsPage from "@/components/health/CheckinsPage";
import ContentHub from "@/components/content/ContentHub";
import SettingsPage from "@/components/shared/SettingsPage";

type ThemeMode = "system" | "light" | "dark";
type TouchStart = { x: number; y: number; scrollTop: number };

export default function AppShell() {
  const [activeView, setActiveView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem("lwh-theme");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const touchStart = useRef<TouchStart | null>(null);
  const { user, loading, signOut, supabaseReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && supabaseReady && !user) {
      const next = window.location.pathname !== "/" ? window.location.pathname : "";
      router.replace(next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login");
    }
  }, [loading, user, supabaseReady, router]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const cycleTheme = () => setTheme((current) => {
    const next: ThemeMode = current === "system" ? "light" : current === "light" ? "dark" : "system";
    window.localStorage.setItem("lwh-theme", next);
    return next;
  });
  const navigate = (view: string) => { setActiveView(view); setSidebarOpen(false); mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); };
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    window.setTimeout(() => { setRefreshing(false); setPullDistance(0); }, 650);
  };
  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("input, textarea, select, button, [data-no-gesture]")) return;
    const point = event.touches[0];
    touchStart.current = { x: point.clientX, y: point.clientY, scrollTop: mainRef.current?.scrollTop ?? 0 };
  };
  const onTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    if (!start || start.scrollTop > 0) return;
    const distance = event.touches[0].clientY - start.y;
    if (distance > 0) setPullDistance(Math.min(distance * 0.42, 72));
  };
  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    if (!start) return;
    const point = event.changedTouches[0];
    const deltaX = point.clientX - start.x;
    if (start.x < 24 && deltaX > 72) setSidebarOpen(true);
    if (sidebarOpen && deltaX < -64) setSidebarOpen(false);
    if (start.x > window.innerWidth - 28 && deltaX < -72 && activeView !== "overview") navigate("overview");
    if (start.scrollTop === 0 && pullDistance >= 52) refresh(); else setPullDistance(0);
    touchStart.current = null;
  };
  const renderPage = () => {
    switch (activeView) {
      case "overview": return <OverviewPage onNavigate={navigate} />;
      case "inbox": return <InboxPage />; case "approvals": return <WorkApprovals />; case "reports": return <WorkReports />;
      case "alerts": return <WorkAlerts />; case "tasks": return <WorkTasks />; case "family-health": return <FamilyHealth />;
      case "child-growth": return <ChildGrowth />; case "travel": return <TravelPlan />; case "wardrobe": return <WardrobePage />;
      case "finance": return <FinancePage />; case "checkins": return <CheckinsPage />; case "content": return <ContentHub />;
      case "settings": return <SettingsPage />; default: return <OverviewPage onNavigate={navigate} />;
    }
  };
  if (loading) return <div className="grid h-dvh place-items-center bg-slate-50 dark:bg-slate-950"><div className="text-center"><div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-[3px] border-sky-500 border-t-transparent" /><p className="text-sm text-slate-500">正在打开工作台…</p></div></div>;

  const themeLabel = theme === "system" ? "跟随系统" : theme === "light" ? "浅色模式" : "深色模式";
  return (
    <div className="flex h-dvh overflow-hidden bg-[#f7f8f6] dark:bg-slate-950">
      <div className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 shadow-2xl transition-[transform,width] duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none dark:border-slate-800 ${sidebarCollapsed ? "lg:w-[72px]" : "lg:w-64"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar activeView={activeView} onNavigate={navigate} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      </div>
      {sidebarOpen && <button type="button" aria-label="关闭导航" className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[1px] lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <main ref={mainRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="relative flex-1 overflow-y-auto overscroll-y-contain">
        <div className="pointer-events-none sticky top-0 z-30 h-0"><div className="pull-indicator absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-b-xl bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400" style={{ opacity: pullDistance ? 1 : 0, transform: `translate(-50%, ${pullDistance - 52}px)` }}><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{refreshing ? "正在刷新" : pullDistance >= 52 ? "松开刷新" : "下拉刷新"}</div></div>
        <header className="safe-top sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/78 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/78">
          <div className="flex min-w-0 items-center gap-1">
            <button data-no-gesture type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-900" onClick={() => setSidebarOpen(true)} aria-label="打开导航"><Menu size={20} /></button>
            {activeView !== "overview" && <button data-no-gesture type="button" onClick={() => navigate("overview")} className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 sm:flex dark:text-slate-400 dark:hover:bg-slate-900"><ChevronLeft size={15} />返回总览</button>}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button data-no-gesture type="button" onClick={cycleTheme} title={themeLabel} aria-label={`切换外观，当前${themeLabel}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100">{theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}</button>
            {supabaseReady && user ? <><div className="hidden items-center gap-2 text-sm sm:flex"><div className="grid h-7 w-7 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"><User size={14} /></div><span className="max-w-28 truncate font-medium text-slate-700 dark:text-slate-200">{user.user_metadata?.name || user.email?.split("@")[0]}</span></div><button data-no-gesture onClick={signOut} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300" title="退出登录"><LogOut size={15} /><span className="hidden sm:inline">退出</span></button></> : <span className="hidden text-xs text-slate-400 sm:inline">Mock 数据模式</span>}
          </div>
        </header>
        <div className="safe-bottom mx-auto max-w-[1600px] p-4 pb-8 lg:p-6">{renderPage()}</div>
      </main>
    </div>
  );
}
