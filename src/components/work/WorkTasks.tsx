"use client";

import { SectionHeader, Badge, Card } from "@/components/shared/SharedComponents";
import { mockWorkTasks } from "@/lib/mock-data";
import type { WorkTask, TaskStatus } from "@/types";
import { Plus } from "lucide-react";

const columns: { status: TaskStatus; label: string; color: string }[] = [
  { status: "todo", label: "待处理", color: "bg-yellow-100 dark:bg-yellow-900/20" },
  { status: "in_progress", label: "进行中", color: "bg-blue-100 dark:bg-blue-900/20" },
  { status: "review", label: "待验证", color: "bg-purple-100 dark:bg-purple-900/20" },
  { status: "done", label: "已完成", color: "bg-green-100 dark:bg-green-900/20" },
];

const priorityConfig = {
  urgent: { label: "紧急", variant: "danger" as const },
  normal: { label: "普通", variant: "default" as const },
  low: { label: "低优", variant: "info" as const },
};

export default function WorkTasks() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="✅ 任务跟踪"
        subtitle={`${mockWorkTasks.length} 个任务`}
        action={
          <button className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            <Plus size={14} />
            新建任务
          </button>
        }
      />

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => {
          const tasks = mockWorkTasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className={`rounded-xl ${col.color} p-3 min-h-[200px]`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {col.label}
                </span>
                <span className="text-xs bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <Card key={task.id}>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={priorityConfig[task.priority].variant}>
                          {priorityConfig[task.priority].label}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white mb-2">
                        {task.title}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{task.assignee}</span>
                        {task.due_date && (
                          <span className={`text-xs ${
                            new Date(task.due_date) < new Date()
                              ? "text-red-500"
                              : "text-gray-400"
                          }`}>
                            {task.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
