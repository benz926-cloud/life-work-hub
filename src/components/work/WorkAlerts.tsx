"use client";

import { SectionHeader, Badge, Card } from "@/components/shared/SharedComponents";
import { mockAlerts } from "@/lib/mock-data";

const levelConfig = {
  critical: { label: "严重", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  warning: { label: "警告", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" },
  info: { label: "提示", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
};

const sourceLabels = {
  feishu: "飞书",
  industry_platform: "工业互联网",
  italent: "iTalent",
  system: "系统",
};

export default function WorkAlerts() {
  const critical = mockAlerts.filter((a) => a.level === "critical" && !a.resolved);
  const warning = mockAlerts.filter((a) => a.level === "warning" && !a.resolved);
  const info = mockAlerts.filter((a) => a.level === "info" && !a.resolved);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="🚨 预警监控"
        subtitle={`严重 ${critical.length} · 警告 ${warning.length} · 提示 ${info.length}`}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Critical */}
        <Card>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              严重预警 ({critical.length})
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {critical.map((alert) => {
              const config = levelConfig[alert.level];
              return (
                <div key={alert.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">🔴</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {alert.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{alert.description}</div>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="danger">
                          {sourceLabels[alert.source] || alert.source}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(alert.created_at).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0">
                      处理
                    </button>
                  </div>
                </div>
              );
            })}
            {critical.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-400">无严重预警</div>
            )}
          </div>
        </Card>

        {/* Warnings + Info */}
        <div className="space-y-4">
          <Card>
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                警告 ({warning.length})
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {warning.map((alert) => (
                <div key={alert.id} className="p-3 flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">🟡</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 dark:text-white truncate">
                      {alert.title}
                    </div>
                    <div className="text-xs text-gray-500">{alert.description}</div>
                  </div>
                  <Badge variant="warning">{sourceLabels[alert.source] || alert.source}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                提示 ({info.length})
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {info.map((alert) => (
                <div key={alert.id} className="p-3 flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">🔵</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {alert.title}
                    </div>
                  </div>
                  <Badge variant="info">{sourceLabels[alert.source] || alert.source}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
