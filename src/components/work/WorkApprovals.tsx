"use client";

import { SectionHeader, Badge, Card } from "@/components/shared/SharedComponents";
import { useApprovalsData } from "@/hooks/useData";
import { DemoBanner } from "@/components/shared/DataStates";

export default function WorkApprovals() {
  const approvals = useApprovalsData(); const pending = approvals.items.filter((a) => a.status === "pending");
  const history = approvals.items.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-6">
      <SectionHeader title="📋 审批中心" subtitle={`飞书审批 · ${pending.length} 条待处理`} /><DemoBanner isDemo={approvals.isDemo} />

      {/* Pending */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              待审批 ({pending.length})
            </span>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {pending.map((approval) => (
            <div key={approval.id} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-sm font-bold flex-shrink-0">
                {approval.applicant[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {approval.title}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {approval.applicant} · {approval.reason}
                  {approval.amount && ` · ¥${approval.amount.toLocaleString()}`}
                </div>
              </div>
              {approval.due_date && (
                <Badge variant={
                  new Date(approval.due_date) < new Date() ? "danger" : "warning"
                }>
                  {new Date(approval.due_date) < new Date() ? "已超时" : approval.due_date}
                </Badge>
              )}
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => void approvals.update(approval.id, { status: "approved" })} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                  ✓ 通过
                </button>
                <button onClick={() => void approvals.update(approval.id, { status: "rejected" })} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                  ✕ 驳回
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">暂无待审批事项</div>
          )}
        </div>
      </Card>

      {/* History */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-900 dark:text-white">已处理</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {history.map((approval) => (
            <div key={approval.id} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 text-sm font-bold flex-shrink-0">
                {approval.applicant[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate line-through">
                  {approval.title}
                </div>
                <div className="text-xs text-gray-400">{approval.applicant}</div>
              </div>
              <Badge variant={approval.status === "approved" ? "success" : "danger"}>
                {approval.status === "approved" ? "已通过" : "已驳回"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
