"use client";

import { SectionHeader, Card, Badge } from "@/components/shared/SharedComponents";
import { useCheckinHabitsData, useCheckinRecordsData } from "@/hooks/useData";
import { DemoBanner } from "@/components/shared/DataStates";

const categoryIcons: Record<string, string> = {
  fitness: "🏃", learning: "📚", health: "💊", work: "💼", other: "📌",
};

export default function CheckinsPage() {
  const habits = useCheckinHabitsData(); const checkins = useCheckinRecordsData();
  return (
    <div className="space-y-6">
      <SectionHeader title="🎯 打卡习惯" subtitle="今日打卡进度" /><DemoBanner isDemo={habits.isDemo} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {habits.items.map((habit) => {
          const checkin = checkins.items.find(
            (c) => c.habit_id === habit.id && c.date === "2026-08-02"
          );
          return (
            <Card key={habit.id}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{categoryIcons[habit.category]}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {habit.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {habit.source === "keep" ? "Keep" : habit.source === "duolingo" ? "多邻国" : habit.source === "beike" ? "贝壳英语" : "手动"}
                      {" · "}每周 {habit.target_days_per_week} 天
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      checkin?.completed
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-green-100"
                    }`}
                  >
                    {checkin?.completed ? "✓ 已打卡" : "打卡"}
                  </button>
                  <Badge variant={checkin?.completed ? "success" : "warning"}>
                    {checkin?.completed ? "已完成" : "待打卡"}
                  </Badge>
                </div>

                {/* Week progress dots */}
                <div className="flex gap-1 mt-3">
                  {["一", "二", "三", "四", "五", "六", "日"].map((day, i) => (
                    <div
                      key={day}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                        i < 5
                          ? "bg-green-100 dark:bg-green-900/20 text-green-600"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
