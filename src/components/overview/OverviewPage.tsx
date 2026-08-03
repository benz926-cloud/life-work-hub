"use client";

import { StatCard, SectionHeader, Badge, Card } from "@/components/shared/SharedComponents";
import { useAlertsData, useApprovalsData, useCheckinHabitsData, useCheckinRecordsData, useChildGrowthData, useFamilyMembersData, useFinanceData, useHealthData, useKPIData, useSavingsGoalsData, useTravelPlansData, useWorkTasksData } from "@/hooks/useData";
import { useAISuggestions, useFinanceAnalysis, useGrowthReport } from "@/hooks/useAI";

export default function OverviewPage({ onNavigate }: { onNavigate: (view: string) => void }) {
  const family = useFamilyMembersData(); const health = useHealthData(); const approvals = useApprovalsData(); const alerts = useAlertsData(); const tasks = useWorkTasksData(); const travel = useTravelPlansData(); const finance = useFinanceData(); const goals = useSavingsGoalsData(); const habits = useCheckinHabitsData(); const checkins = useCheckinRecordsData(); useKPIData();
  const child = family.items.find((member) => member.role === "child"); const growthRecords = useChildGrowthData(child?.id);
  const { data: financeAnalysis } = useFinanceAnalysis(finance.items, goals.items, { monthlyBudget: 10000 }); const { data: growth } = useGrowthReport(growthRecords.items, child);
  const mockAISuggestions = useAISuggestions({ finance: financeAnalysis, growth, alerts: alerts.items, checkins: { habits: habits.items, records: checkins.items } });
  const mockFamilyMembers = family.items; const mockHealthRecords = health.items; const mockApprovals = approvals.items; const mockAlerts = alerts.items; const mockWorkTasks = tasks.items; const mockTravelPlans = travel.items;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  const pendingApprovals = mockApprovals.filter((a) => a.status === "pending").length;
  const criticalAlerts = mockAlerts.filter((a) => a.level === "critical" && !a.resolved).length;
  const inProgressTasks = mockWorkTasks.filter((t) => t.status === "in_progress").length;
  const todayRecords = mockHealthRecords.filter((r) => r.family_member_id === "fm1")[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {greeting}，林涛
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          8月2日 周日 · 晴 32°C
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="待审批" value={pendingApprovals} icon="📋" color="#3B82F6" href="approvals" />
        <StatCard title="严重预警" value={criticalAlerts} icon="🚨" color="#EF4444" href="alerts" />
        <StatCard title="进行中任务" value={inProgressTasks} icon="✅" color="#F59E0B" href="tasks" />
        <StatCard title="本周报表" value={8} icon="📊" color="#10B981" href="reports" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Suggestions */}
          <Card>
            <SectionHeader title="🤖 AI 主动建议" subtitle="根据你的数据智能分析" />
            <div className="px-4 pb-4 space-y-2">
              {mockAISuggestions.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg p-3 transition-colors cursor-pointer ${s.severity === "urgent" ? "bg-red-50 ring-1 ring-red-200 dark:bg-red-950/20 dark:ring-red-900" : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800"}`}
                >
                  <span className="text-xl">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {s.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {s.detail}
                    </div>
                  </div>
                  <button onClick={() => onNavigate(s.action ?? "overview")} className={`text-xs px-3 py-1 text-white rounded-lg flex-shrink-0 ${s.severity === "urgent" ? "bg-red-600 hover:bg-red-700" : "bg-blue-500 hover:bg-blue-600"}`}>
                    {s.action}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Family Quick Status */}
          <Card>
            <SectionHeader
              title="👨‍👩‍👧‍👦 家庭速览"
              action={
                <button
                  onClick={() => onNavigate("family-health")}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  查看全部 →
                </button>
              }
            />
            <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3">
              {mockFamilyMembers.map((fm) => {
                const health = mockHealthRecords.find((h) => h.family_member_id === fm.id);
                return (
                  <div
                    key={fm.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {fm.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {fm.name}
                        <span className="text-xs text-gray-400 ml-1">
                          {fm.role === "self" ? "自己" : fm.role === "spouse" ? "妻子" : fm.role === "child" ? "女儿" : "父亲"}
                        </span>
                      </div>
                      {health && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {health.steps && `步数 ${health.steps.toLocaleString()}`}
                          {health.blood_pressure_systolic && ` · 血压 ${health.blood_pressure_systolic}/${health.blood_pressure_diastolic}`}
                          {fm.health_conditions && fm.health_conditions.length > 0 && (
                            <Badge variant="warning">{fm.health_conditions[0]}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Work Quick View */}
          <Card>
            <SectionHeader
              title="💼 工作速览"
              action={
                <button
                  onClick={() => onNavigate("tasks")}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  查看全部 →
                </button>
              }
            />
            <div className="px-4 pb-4 space-y-2">
              {mockWorkTasks.filter(t => t.status !== "done").slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      task.priority === "urgent" ? "bg-red-500" : "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 dark:text-white truncate">{task.title}</div>
                  </div>
                  <Badge variant={task.status === "todo" ? "warning" : "info"}>
                    {task.status === "todo" ? "待处理" : task.status === "in_progress" ? "进行中" : "待验证"}
                  </Badge>
                  {task.due_date && (
                    <span className="text-xs text-gray-400">{task.due_date}</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Content Stats */}
          <Card>
            <SectionHeader
              title="📡 内容聚合"
              action={
                <button
                  onClick={() => onNavigate("content")}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  去阅读 →
                </button>
              }
            />
            <div className="px-4 pb-4 grid grid-cols-4 gap-3 text-center">
              {[
                { label: "B站", count: 6, color: "#FB7299" },
                { label: "小红书", count: 7, color: "#FF2442" },
                { label: "YouTube", count: 3, color: "#FF0000" },
                { label: "已转化", count: 4, color: "#8B5CF6" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-2xl font-bold" style={{ color: item.color }}>
                    {item.count}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Today's Schedule */}
          <Card>
            <SectionHeader title="📅 今日日程" />
            <div className="px-4 pb-4 space-y-3">
              {[
                { time: "09:00", title: "早餐 · 全家", color: "bg-green-100 dark:bg-green-900/20" },
                { time: "10:00", title: "补本周OKR周报", color: "bg-blue-100 dark:bg-blue-900/20", done: true },
                { time: "14:00", title: "供应商合同续签审核", color: "bg-orange-100 dark:bg-orange-900/20" },
                { time: "16:00", title: "带朵朵上钢琴课", color: "bg-purple-100 dark:bg-purple-900/20" },
                { time: "19:00", title: "给爸爸量血压", color: "bg-red-100 dark:bg-red-900/20" },
              ].map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="text-xs text-gray-400 w-10 flex-shrink-0 pt-0.5">{event.time}</div>
                  <div className={`flex-1 px-3 py-1.5 rounded-lg text-sm ${event.color} ${event.done ? "line-through opacity-50" : ""}`}>
                    {event.title}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Travel Countdown */}
          {mockTravelPlans.filter(t => t.status === "planning").map((plan) => {
            const daysLeft = Math.ceil(
              (new Date(plan.start_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            return (
              <Card key={plan.id} className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                <div className="p-4">
                  <div className="text-sm opacity-80">即将出行</div>
                  <div className="text-2xl font-bold mt-1">{plan.destination}</div>
                  <div className="text-sm mt-1 opacity-80">
                    {plan.start_date} ~ {plan.end_date}
                  </div>
                  <div className="text-4xl font-bold mt-3">{daysLeft}</div>
                  <div className="text-sm opacity-80">天后出发</div>
                  <button
                    onClick={() => onNavigate("travel")}
                    className="mt-3 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                  >
                    查看行程
                  </button>
                </div>
              </Card>
            );
          })}

          {/* Quick Health */}
          {todayRecords && (
            <Card>
              <SectionHeader title="⌚ 今日健康" />
              <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
                  <div className="text-2xl font-bold text-green-600">{todayRecords.steps?.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-1">步数</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10">
                  <div className="text-2xl font-bold text-blue-600">{todayRecords.sleep_hours}h</div>
                  <div className="text-xs text-gray-500 mt-1">睡眠</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10">
                  <div className="text-2xl font-bold text-purple-600">{todayRecords.heart_rate}</div>
                  <div className="text-xs text-gray-500 mt-1">心率</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/10">
                  <div className="text-2xl font-bold text-orange-600">{todayRecords.active_minutes}min</div>
                  <div className="text-xs text-gray-500 mt-1">运动</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
