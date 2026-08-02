"use client";

import { SectionHeader, Card, Badge } from "@/components/shared/SharedComponents";
import { mockTravelPlans } from "@/lib/mock-data";

export default function TravelPlan() {
  const plan = mockTravelPlans[0];
  if (!plan) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">✈️</div>
        <div className="text-gray-500">还没有旅行计划，创建一个吧</div>
      </div>
    );
  }

  const daysLeft = Math.ceil(
    (new Date(plan.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const itinerary = plan.itinerary as any;
  const checklist = plan.checklist as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <div className="p-6">
          <div className="text-sm opacity-80">即将出行</div>
          <div className="text-3xl font-bold mt-1">{plan.destination}</div>
          <div className="mt-1 opacity-80">
            {plan.start_date} ~ {plan.end_date} · 5天4晚
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div>
              <div className="text-4xl font-bold">{daysLeft}</div>
              <div className="text-sm opacity-80">天后出发</div>
            </div>
            <div className="flex-1">
              <div className="w-full h-2 bg-white/20 rounded-full">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${Math.max(0, 100 - (daysLeft / 14) * 100)}%` }}
                />
              </div>
              <div className="text-xs mt-1 opacity-70">准备进度</div>
            </div>
          </div>
          {plan.budget && (
            <div className="mt-3 text-sm opacity-80">
              预算: ¥{plan.budget.toLocaleString()}
            </div>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Itinerary */}
        <Card>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              🗺️ AI 行程规划
            </span>
          </div>
          <div className="p-4 space-y-4">
            {itinerary?.days?.map((day: any) => (
              <div key={day.day} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center">
                    {day.day}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {day.title}
                  </span>
                </div>
                <div className="space-y-1 ml-7">
                  {day.activities.map((act: string, i: number) => (
                    <div key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      {act}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Checklist */}
        <Card>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-white">🎒 行李清单</span>
          </div>
          <div className="p-4 space-y-4">
            {checklist &&
              Object.entries(checklist).map(([category, items]: [string, any]) => (
                <div key={category}>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                    {category === "documents" ? "📄 证件" : category === "clothing" ? "👔 衣物" : category === "kids" ? "👶 儿童" : "🎒 其他"}
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item: { name: string; done: boolean }, i: number) => (
                      <label key={i} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={item.done}
                          className="rounded border-gray-300 text-blue-500"
                        />
                        <span
                          className={`text-sm ${item.done ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}
                        >
                          {item.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
