"use client";

import { SectionHeader, Card } from "@/components/shared/SharedComponents";
import { useFamilyMembersData, useSystemIntegrationsData } from "@/hooks/useData";

const integrationLabels: Record<string, string> = {
  feishu: "飞书",
  industry_platform: "工业互联网平台",
  italent: "北森 iTalent",
  apple_health: "Apple Health",
  keep: "Keep",
  duolingo: "多邻国",
};

export default function SettingsPage() {
  const members = useFamilyMembersData(); const integrations = useSystemIntegrationsData(); const mockFamilyMembers = members.items; const mockIntegrations = integrations.items;
  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader title="⚙️ 设置" subtitle="系统配置与数据源管理" />

      {/* Integrations */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-900 dark:text-white">🔌 系统集成</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {mockIntegrations.map((integration) => (
            <div key={integration.id} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg">
                {integration.name === "feishu" ? "🕊️" : integration.name === "industry_platform" ? "🏭" : integration.name === "italent" ? "👥" : integration.name === "apple_health" ? "⌚" : integration.name === "keep" ? "🏃" : "🦉"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {integrationLabels[integration.name] || integration.name}
                </div>
                <div className="text-xs text-gray-500">
                  {integration.connected ? "已连接 · 上次同步: " + (integration.last_sync_at || "刚刚") : "未连接"}
                </div>
              </div>
              <button
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  integration.connected
                    ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                {integration.connected ? "已连接" : "连接"}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Data Refresh */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-900 dark:text-white">🔄 数据刷新频率</span>
        </div>
        <div className="p-4">
          <select className="w-full sm:w-64 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm">
            <option>每 5 分钟</option>
            <option>每 15 分钟</option>
            <option>每 30 分钟</option>
            <option>每 60 分钟</option>
          </select>
        </div>
      </Card>

      {/* Family Members */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">👨‍👩‍👧‍👦 家庭成员</span>
          <button className="text-xs text-blue-500 hover:text-blue-600">+ 添加成员</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {mockFamilyMembers.map((member) => (
            <div key={member.id} className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                {member.name[0]}
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {member.name} · {member.age}岁
                </div>
              </div>
              <button className="text-xs text-gray-400 hover:text-gray-600">编辑</button>
            </div>
          ))}
        </div>
      </Card>

      {/* About */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-900 dark:text-white">ℹ️ 关于</span>
        </div>
        <div className="p-4 space-y-2 text-sm text-gray-500">
          <div>Life Work Hub v0.1.0</div>
          <div>Next.js + Supabase + TypeScript</div>
          <div className="text-xs text-gray-400">阶段 0 骨架搭建完成 · 下一步：对接 Supabase</div>
        </div>
      </Card>
    </div>
  );
}
