"use client";

import { useRef, useState } from "react";
import { CalendarDays, GripVertical, MoreHorizontal, Plus, X } from "lucide-react";
import { SectionHeader, Badge } from "@/components/shared/SharedComponents";
import { mockWorkTasks } from "@/lib/mock-data";
import type { WorkTask, TaskStatus } from "@/types";

const columns: { status: TaskStatus; label: string; shortLabel: string; color: string; dot: string }[] = [
  { status: "todo", label: "待办", shortLabel: "待办", color: "bg-amber-50 dark:bg-amber-500/10", dot: "bg-amber-500" },
  { status: "in_progress", label: "进行中", shortLabel: "进行", color: "bg-sky-50 dark:bg-sky-500/10", dot: "bg-sky-500" },
  { status: "review", label: "审核", shortLabel: "审核", color: "bg-violet-50 dark:bg-violet-500/10", dot: "bg-violet-500" },
  { status: "done", label: "完成", shortLabel: "完成", color: "bg-emerald-50 dark:bg-emerald-500/10", dot: "bg-emerald-500" },
];
const priorityConfig = { urgent: { label: "紧急", variant: "danger" as const }, normal: { label: "普通", variant: "default" as const }, low: { label: "低优", variant: "info" as const } };

export default function WorkTasks() {
  const [tasks, setTasks] = useState<WorkTask[]>(() => mockWorkTasks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const moveTask = (taskId: string, targetStatus: TaskStatus, beforeId?: string) => {
    setTasks((current) => {
      const task = current.find((item) => item.id === taskId);
      if (!task) return current;
      const remainder = current.filter((item) => item.id !== taskId);
      const moved = { ...task, status: targetStatus };
      if (!beforeId) return [...remainder, moved];
      const targetIndex = remainder.findIndex((item) => item.id === beforeId);
      return targetIndex < 0 ? [...remainder, moved] : [...remainder.slice(0, targetIndex), moved, ...remainder.slice(targetIndex)];
    });
    setMenuTaskId(null);
  };
  const beginDrag = (event: React.DragEvent, taskId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
    setDraggedId(taskId);
  };
  const finishDrag = () => { setDraggedId(null); setOverColumn(null); };
  const dropOn = (event: React.DragEvent, status: TaskStatus, beforeId?: string) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedId;
    if (taskId) moveTask(taskId, status, beforeId);
    finishDrag();
  };
  const clearLongPress = () => { if (longPressTimer.current) window.clearTimeout(longPressTimer.current); };
  const scheduleLongPress = (event: React.PointerEvent, taskId: string) => {
    if (event.pointerType !== "touch") return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => { setMenuTaskId(taskId); navigator.vibrate?.(12); }, 480);
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="任务跟踪" subtitle={`${tasks.length} 个任务 · 拖拽调整优先级`} action={<button className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"><Plus size={14} />新建任务</button>} />
      <p className="-mt-2 text-xs text-slate-400 dark:text-slate-500">电脑端可直接拖拽；手机端长按任务可移动到其他列。</p>
      <div className="grid snap-x snap-mandatory grid-flow-col auto-cols-[88%] gap-3 overflow-x-auto pb-3 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 lg:grid-cols-4 lg:overflow-visible">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.status);
          return <section key={column.status} aria-label={`${column.label}任务`} onDragOver={(event) => { event.preventDefault(); setOverColumn(column.status); }} onDragLeave={() => setOverColumn(null)} onDrop={(event) => dropOn(event, column.status)} className={`min-h-[360px] snap-center rounded-2xl p-3 transition-colors ${column.color} ${overColumn === column.status ? "ring-2 ring-sky-400 ring-offset-2 dark:ring-offset-slate-950" : ""}`}>
            <div className="mb-3 flex items-center justify-between px-1"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${column.dot}`} /><h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{column.label}</h2></div><span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-950/30 dark:text-slate-400">{columnTasks.length}</span></div>
            <div className="space-y-2" onDrop={(event) => dropOn(event, column.status)}>
              {columnTasks.map((task) => <article key={task.id} draggable onDragStart={(event) => beginDrag(event, task.id)} onDragEnd={finishDrag} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOn(event, column.status, task.id)} onPointerDown={(event) => scheduleLongPress(event, task.id)} onPointerUp={clearLongPress} onPointerCancel={clearLongPress} onPointerMove={clearLongPress} aria-grabbed={draggedId === task.id} className={`kanban-card relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${draggedId === task.id ? "kanban-card-dragging" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5"><GripVertical size={16} className="cursor-grab text-slate-300 dark:text-slate-600" aria-hidden="true" /><Badge variant={priorityConfig[task.priority].variant}>{priorityConfig[task.priority].label}</Badge></div><button type="button" data-no-gesture onClick={() => setMenuTaskId((id) => id === task.id ? null : task.id)} aria-label={`打开${task.title}菜单`} aria-expanded={menuTaskId === task.id} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"><MoreHorizontal size={16} /></button></div>
                <h3 className="text-sm font-medium leading-5 text-slate-900 dark:text-white">{task.title}</h3>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400"><span className="truncate">{task.assignee || "未指派"}</span>{task.due_date && <span className={`flex shrink-0 items-center gap-1 ${new Date(task.due_date) < new Date() && task.status !== "done" ? "text-rose-500" : ""}`}><CalendarDays size={12} />{task.due_date.slice(5)}</span>}</div>
                {menuTaskId === task.id && <TaskMenu currentStatus={task.status} onClose={() => setMenuTaskId(null)} onMove={(status) => moveTask(task.id, status)} />}
              </article>)}
              {columnTasks.length === 0 && <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-slate-300/70 text-xs text-slate-400 dark:border-slate-700">拖放任务到这里</div>}
            </div>
          </section>;
        })}
      </div>
    </div>
  );
}

function TaskMenu({ currentStatus, onClose, onMove }: { currentStatus: TaskStatus; onClose: () => void; onMove: (status: TaskStatus) => void }) {
  return <div role="menu" className="absolute right-2 top-10 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="mb-1 flex items-center justify-between px-2 py-1 text-[11px] font-medium text-slate-400">移动到<button type="button" onClick={onClose} aria-label="关闭菜单"><X size={13} /></button></div>{columns.filter((column) => column.status !== currentStatus).map((column) => <button key={column.status} role="menuitem" type="button" onClick={() => onMove(column.status)} className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{column.shortLabel}</button>)}</div>;
}
