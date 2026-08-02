"use client";

import { SectionHeader, Card } from "@/components/shared/SharedComponents";
import { mockFamilyMembers, mockHealthRecords } from "@/lib/mock-data";

const roleLabels: Record<string, string> = {
  self: "自己", spouse: "妻子", child: "女儿", parent: "父亲",
};

export default function FamilyHealth() {
  return (
    <div className="space-y-6">
      <SectionHeader title="💊 家庭健康" subtitle="4位家庭成员 · Apple Health 已同步" />

      <div className="grid lg:grid-cols-2 gap-4">
        {mockFamilyMembers.map((fm) => {
          const health = mockHealthRecords.find((h) => h.family_member_id === fm.id);
          return (
            <Card key={fm.id}>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {fm.name[0]}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {fm.name}
                      <span className="text-xs text-gray-400 ml-1">({roleLabels[fm.role]})</span>
                    </div>
                    <div className="text-xs text-gray-500">{fm.age}岁</div>
                  </div>
                </div>

                {health && (
                  <div className="grid grid-cols-2 gap-3">
                    {health.steps && (
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{health.steps?.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">今日步数</div>
                      </div>
                    )}
                    {health.sleep_hours && (
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{health.sleep_hours}h</div>
                        <div className="text-xs text-gray-500">昨晚睡眠</div>
                      </div>
                    )}
                    {health.heart_rate && (
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{health.heart_rate}</div>
                        <div className="text-xs text-gray-500">静息心率</div>
                      </div>
                    )}
                    {health.blood_pressure_systolic && (
                      <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/10">
                        <div className="text-lg font-bold text-red-600">
                          {health.blood_pressure_systolic}/{health.blood_pressure_diastolic}
                        </div>
                        <div className="text-xs text-red-500">血压 ⚠️偏高</div>
                      </div>
                    )}
                    {health.blood_sugar && (
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{health.blood_sugar}</div>
                        <div className="text-xs text-gray-500">空腹血糖 mmol/L</div>
                      </div>
                    )}
                    {health.active_minutes && (
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{health.active_minutes}min</div>
                        <div className="text-xs text-gray-500">运动时长</div>
                      </div>
                    )}
                  </div>
                )}

                {fm.health_conditions && fm.health_conditions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {fm.health_conditions.map((c) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
