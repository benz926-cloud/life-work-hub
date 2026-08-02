"use client";

import { SectionHeader, Card } from "@/components/shared/SharedComponents";
import { mockKPIs } from "@/lib/mock-data";

const trendIcon = (t: string) => (t === "up" ? "↑" : t === "down" ? "↓" : "→");
const trendColor = (t: string) =>
  t === "up" ? "text-green-500" : t === "down" ? "text-red-500" : "text-gray-400";

export default function WorkReports() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="📊 关键报表"
        subtitle="工业互联网平台 · 今日数据"
        action={
          <select className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <option>今日</option>
            <option>本周</option>
            <option>本月</option>
          </select>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {mockKPIs.map((kpi) => (
          <Card key={kpi.id}>
            <div className="p-4">
              <div className="text-xs text-gray-500 mb-1">{kpi.name}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.value.toLocaleString()}
                <span className="text-sm font-normal text-gray-400 ml-1">{kpi.unit}</span>
              </div>
              <div className={`text-xs mt-2 ${trendColor(kpi.trend)}`}>
                {trendIcon(kpi.trend)} {kpi.change_percent !== 0 && `${kpi.change_percent}%`}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Production chart (simplified bar) */}
      <Card>
        <div className="p-4">
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            7天产量趋势
          </div>
          <div className="flex items-end gap-2 h-40">
            {[9800, 10200, 11500, 10800, 12400, 13100, 12840].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600"
                  style={{ height: `${(val / 14000) * 100}%` }}
                />
                <span className="text-[10px] text-gray-400">
                  {["周一", "周二", "周三", "周四", "周五", "周六", "周日"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Device Status */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-900 dark:text-white">设备实时状态</span>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          {[
            { name: "1号产线", status: "running", temp: "78°C", speed: "120件/h" },
            { name: "2号产线", status: "running", temp: "76°C", speed: "118件/h" },
            { name: "3号产线", status: "warning", temp: "89°C", speed: "105件/h" },
            { name: "包装线", status: "running", temp: "42°C", speed: "200件/h" },
          ].map((device) => (
            <div
              key={device.name}
              className={`p-3 rounded-lg border ${
                device.status === "warning"
                  ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                  : "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {device.name}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    device.status === "warning" ? "bg-red-500 animate-pulse" : "bg-green-500"
                  }`}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                温度 {device.temp} · 速度 {device.speed}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
