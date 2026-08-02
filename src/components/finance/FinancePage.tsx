"use client";

import { SectionHeader, Card, Badge } from "@/components/shared/SharedComponents";
import { mockFinanceRecords, mockSavingsGoals } from "@/lib/mock-data";

const categoryLabels: Record<string, string> = {
  food: "餐饮", transport: "交通", shopping: "购物", housing: "住房",
  entertainment: "娱乐", health: "健康", education: "教育", family: "家庭", other: "其他",
};

export default function FinancePage() {
  const expenses = mockFinanceRecords.filter((r) => r.type === "expense");
  const income = mockFinanceRecords.filter((r) => r.type === "income");
  const totalExpense = expenses.reduce((sum, r) => sum + r.amount, 0);
  const totalIncome = income.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      <SectionHeader title="💰 理财管理" subtitle="8月账本" />

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-500">本月收入</div>
            <div className="text-2xl font-bold text-green-600">¥{totalIncome.toLocaleString()}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-500">本月支出</div>
            <div className="text-2xl font-bold text-red-600">¥{totalExpense.toLocaleString()}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-500">结余</div>
            <div className="text-2xl font-bold text-blue-600">¥{(totalIncome - totalExpense).toLocaleString()}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-500">月预算</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">¥10,000</div>
            <div className="text-xs text-gray-500 mt-1">已用 {Math.round((totalExpense / 10000) * 100)}%</div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <Card>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-white">📋 最近交易</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {mockFinanceRecords.map((record) => (
              <div key={record.id} className="p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  record.type === "income"
                    ? "bg-green-100 dark:bg-green-900/20 text-green-600"
                    : "bg-red-100 dark:bg-red-900/20 text-red-600"
                }`}>
                  {record.type === "income" ? "+" : "-"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-white truncate">
                    {record.description}
                  </div>
                  <div className="text-xs text-gray-500">
                    {categoryLabels[record.category] || record.category} · {record.date}
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  record.type === "income" ? "text-green-600" : "text-red-600"
                }`}>
                  {record.type === "income" ? "+" : "-"}¥{record.amount}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Savings goals */}
        <Card>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-white">🎯 储蓄目标</span>
          </div>
          <div className="p-4 space-y-4">
            {mockSavingsGoals.map((goal) => {
              const pct = Math.round((goal.current_amount / goal.target_amount) * 100);
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">{goal.name}</span>
                    <span className="text-gray-500">{pct}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>¥{goal.current_amount.toLocaleString()}</span>
                    <span>¥{goal.target_amount.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
