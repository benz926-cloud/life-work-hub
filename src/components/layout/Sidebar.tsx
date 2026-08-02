"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Inbox,
  Radio,
  FileCheck,
  BarChart3,
  Bell,
  CheckSquare,
  Heart,
  GraduationCap,
  Plane,
  Shirt,
  Wallet,
  Target,
  Settings,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { SIDEBAR_NAV, type NavSection } from "@/lib/navigation";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  isNew?: boolean;
  badge?: number;
}

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={18} />,
  Inbox: <Inbox size={18} />,
  Radio: <Radio size={18} />,
  FileCheck: <FileCheck size={18} />,
  BarChart3: <BarChart3 size={18} />,
  Bell: <Bell size={18} />,
  CheckSquare: <CheckSquare size={18} />,
  Heart: <Heart size={18} />,
  GraduationCap: <GraduationCap size={18} />,
  Plane: <Plane size={18} />,
  Shirt: <Shirt size={18} />,
  Wallet: <Wallet size={18} />,
  Target: <Target size={18} />,
  Settings: <Settings size={18} />,
};

const sectionLabels: Record<NavSection, string> = {
  core: "核心",
  work: "工作",
  family: "家庭",
  life: "生活",
  system: "系统",
};

export default function Sidebar({
  activeView,
  onNavigate,
}: {
  activeView: string;
  onNavigate: (view: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on navigation
  const handleNavigate = (view: string) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700"
      >
        <Menu size={20} />
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transition-all duration-200 flex flex-col
          ${collapsed ? "w-16" : "w-60"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            L
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              Life Work Hub
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {(Object.entries(SIDEBAR_NAV) as [NavSection, typeof SIDEBAR_NAV[NavSection]][]).map(
            ([section, items]) => (
              <div key={section}>
                {!collapsed && (
                  <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {sectionLabels[section]}
                  </div>
                )}
                {items.map((item) => {
                  const navItem = item as NavItem;
                  return (
                  <button
                    key={navItem.id}
                    onClick={() => handleNavigate(navItem.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5
                      ${
                        activeView === navItem.id
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }
                      ${collapsed ? "justify-center px-2" : ""}
                    `}
                    title={collapsed ? navItem.label : undefined}
                  >
                    <span className="flex-shrink-0">{iconMap[navItem.icon]}</span>
                    {!collapsed && (
                      <span className="flex-1 text-left truncate">{navItem.label}</span>
                    )}
                    {!collapsed && navItem.isNew && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                        NEW
                      </span>
                    )}
                    {!collapsed && navItem.badge && navItem.badge > 0 && (
                      <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">
                        {navItem.badge}
                      </span>
                    )}
                  </button>
                  );
                })}
              </div>
            )
          )}
        </nav>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ChevronLeft
            size={16}
            className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </aside>
    </>
  );
}
