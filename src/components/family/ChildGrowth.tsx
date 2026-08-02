"use client";

import { SectionHeader, Card } from "@/components/shared/SharedComponents";
import { mockGrowthRecords, mockFamilyMembers } from "@/lib/mock-data";

export default function ChildGrowth() {
  const duoduo = mockFamilyMembers.find((m) => m.role === "child");
  const latest = mockGrowthRecords[0];
  const subjects = latest.subject_scores || {};

  return (
    <div className="space-y-6">
      <SectionHeader title="📚 朵朵成长" subtitle="一年级 · 7岁" />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Growth metrics */}
        <Card>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-white">📏 身体指标</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{latest.height_cm}cm</div>
              <div className="text-xs text-gray-500">身高</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{latest.weight_kg}kg</div>
              <div className="text-xs text-gray-500">体重</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{latest.vision_left}</div>
              <div className="text-xs text-gray-500">左眼视力</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{latest.vision_right}</div>
              <div className="text-xs text-gray-500">右眼视力</div>
            </div>
          </div>
        </Card>

        {/* Subject scores */}
        <Card>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-white">📝 学科进度</span>
          </div>
          <div className="p-4 space-y-3">
            {Object.entries(subjects).map(([subject, score]) => (
              <div key={subject}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">{subject}</span>
                  <span className="text-gray-500">{score}分</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      score >= 90 ? "bg-green-500" : score >= 80 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(score, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Milestones */}
        <Card>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-white">🏆 成长里程碑</span>
          </div>
          <div className="p-4 space-y-3">
            {latest.milestones?.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">{m}</span>
              </div>
            ))}
            {mockGrowthRecords[1]?.milestones?.map((m, i) => (
              <div key={`old-${i}`} className="flex items-center gap-2 text-sm opacity-50">
                <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="text-gray-400 line-through">{m}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Growth trend */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-900 dark:text-white">📈 身高体重趋势</span>
        </div>
        <div className="p-4">
          <div className="h-40 flex items-end gap-8">
            {mockGrowthRecords.reverse().map((r, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex gap-2 items-end">
                  <div
                    className="w-6 bg-blue-400 rounded-t-sm"
                    style={{ height: `${r.height_cm || 0}px` }}
                  />
                  <div
                    className="w-6 bg-green-400 rounded-t-sm"
                    style={{ height: `${(r.weight_kg || 0) * 4}px` }}
                  />
                </div>
                <div className="text-[10px] text-gray-400">{r.date}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-6 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-400 rounded" /> 身高 (cm)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-400 rounded" /> 体重 (kg)
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
