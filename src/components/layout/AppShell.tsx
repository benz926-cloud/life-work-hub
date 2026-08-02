"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { LogOut, User, Menu } from "lucide-react";
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

export default function AppShell() {
  const [activeView, setActiveView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, signOut, supabaseReady } = useAuth();

  const renderPage = () => {
    switch (activeView) {
      case "overview":
        return <OverviewPage onNavigate={setActiveView} />;
      case "inbox":
        return <InboxPage />;
      case "approvals":
        return <WorkApprovals />;
      case "reports":
        return <WorkReports />;
      case "alerts":
        return <WorkAlerts />;
      case "tasks":
        return <WorkTasks />;
      case "family-health":
        return <FamilyHealth />;
      case "child-growth":
        return <ChildGrowth />;
      case "travel":
        return <TravelPlan />;
      case "wardrobe":
        return <WardrobePage />;
      case "finance":
        return <FinancePage />;
      case "checkins":
        return <CheckinsPage />;
      case "content":
        return <ContentHub />;
      case "settings":
        return <SettingsPage />;
      default:
        return <OverviewPage onNavigate={setActiveView} />;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-60 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar activeView={activeView} onNavigate={(v) => { setActiveView(v); setSidebarOpen(false); }} />
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-0 overflow-y-auto relative">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
          <button
            className="lg:hidden p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          {/* User section */}
          <div className="flex items-center gap-3">
            {supabaseReady && user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <User size={14} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {user.user_metadata?.name || user.email?.split("@")[0]}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="退出登录"
                >
                  <LogOut size={15} />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-400">Mock 数据模式</span>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
