export const SIDEBAR_NAV = {
  core: [
    { id: "overview", label: "总览", icon: "LayoutDashboard" },
    { id: "inbox", label: "AI 收件箱", icon: "Inbox" },
    { id: "content", label: "内容聚合", icon: "Radio", isNew: true },
  ],
  work: [
    { id: "approvals", label: "审批中心", icon: "FileCheck" },
    { id: "reports", label: "关键报表", icon: "BarChart3" },
    { id: "alerts", label: "预警监控", icon: "Bell" },
    { id: "tasks", label: "任务跟踪", icon: "CheckSquare" },
  ],
  family: [
    { id: "family-health", label: "家庭健康", icon: "Heart" },
    { id: "child-growth", label: "孩子成长", icon: "GraduationCap" },
    { id: "travel", label: "旅行计划", icon: "Plane" },
  ],
  life: [
    { id: "wardrobe", label: "智能穿搭", icon: "Shirt" },
    { id: "finance", label: "理财管理", icon: "Wallet" },
    { id: "checkins", label: "打卡习惯", icon: "Target" },
  ],
  system: [
    { id: "settings", label: "设置", icon: "Settings" },
  ],
} as const;

export type NavSection = keyof typeof SIDEBAR_NAV;
export type NavViewId = (typeof SIDEBAR_NAV)[NavSection][number]["id"];
