"use client";

import { useState } from "react";
import { Bot, CalendarDays, Send, Tag } from "lucide-react";
import { SectionHeader, Badge, Card } from "@/components/shared/SharedComponents";
import { AITrust } from "@/components/shared/AITrust";
import { useIntentParser } from "@/hooks/useAI";
import { toInboxItem } from "@/lib/ai";
import { mockInboxItems } from "@/lib/mock-data";
import type { InboxItem, InboxCategory } from "@/types";

const categoryConfig: Record<InboxCategory, { label: string; icon: string; color: string }> = {
  task: { label: "任务", icon: "📋", color: "bg-blue-100 dark:bg-blue-900/30" }, shopping: { label: "购物", icon: "🛒", color: "bg-pink-100 dark:bg-pink-900/30" }, inspiration: { label: "灵感", icon: "💡", color: "bg-purple-100 dark:bg-purple-900/30" }, ai_processing: { label: "AI处理中", icon: "🤖", color: "bg-green-100 dark:bg-green-900/30" },
};

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>(mockInboxItems);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<InboxCategory | "all">("all");
  const [actionsById, setActionsById] = useState<Record<string, string[]>>({});
  const { preview, parse, source, degraded, reasons } = useIntentParser();
  const hint = preview(input);
  const filteredItems = activeTab === "all" ? items : items.filter((item) => item.category === activeTab);
  const handleSubmit = async () => {
    if (!input.trim()) return;
    const result = await parse(input);
    const id = `i${Date.now()}`;
    setItems((current) => [{ id, ...toInboxItem(result.data, "") }, ...current]);
    setActionsById((current) => ({ ...current, [id]: result.data.suggestedActions.slice(0, 3) }));
    setInput("");
  };
  const hintParts = hint ? [
    `将归入：${categoryConfig[hint.data.category].label}`,
    hint.data.entities.dueDate ? `${hint.data.entities.dueDate.slice(5).replace("-", "月")}日到期` : "",
    ...hint.data.entities.tags.map((tag) => `#${tag}`),
  ].filter(Boolean) : [];

  return <div className="space-y-4"><SectionHeader title="AI 收件箱" subtitle="说出任何想法，先看 AI 如何理解，再决定提交。" />
    <Card><div className="p-4"><div className="flex gap-2"><input type="text" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleSubmit(); }} placeholder="例如：下周一前准备部门汇报 PPT" className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" aria-label="输入想法" /><button onClick={() => void handleSubmit()} className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700"><Send size={16} /><span className="hidden sm:inline">发送</span></button></div>
      <div className="mt-3 min-h-7">{hint ? <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-200"><Bot size={14} />{hintParts.map((part, index) => <span key={`hint-${index}-${part}`}>{part}</span>)}</div> : <p className="px-1 text-xs text-slate-400">输入时会实时预览分类、截止日期和标签。</p>}</div>
      <div className="mt-3 flex flex-wrap gap-2">{(["📋 记灵感", "📋 加任务", "🛒 想买的", "🤖 AI帮我"] as const).map((chip) => <button key={chip} onClick={() => setInput(chip.includes("记灵感") ? "记录一个灵感：" : chip.includes("加任务") ? "添加任务：" : chip.includes("想买") ? "想买：" : "帮我调研：")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">{chip}</button>)}</div>
      <AITrust source={source} degraded={degraded} reasons={reasons} className="mt-3" /></div></Card>
    <div className="flex flex-wrap gap-2"><button onClick={() => setActiveTab("all")} className={`rounded-lg px-3 py-1.5 text-sm transition ${activeTab === "all" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>全部 ({items.length})</button>{Object.entries(categoryConfig).map(([key, config]) => <button key={key} onClick={() => setActiveTab(key as InboxCategory)} className={`rounded-lg px-3 py-1.5 text-sm transition ${activeTab === key ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : `${config.color} text-slate-700 dark:text-slate-300`}`}>{config.icon} {config.label} ({items.filter((item) => item.category === key).length})</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredItems.map((item) => { const config = categoryConfig[item.category]; const actions = actionsById[item.id] ?? []; return <Card key={item.id}><div className="p-4"><div className="mb-2 flex items-center gap-2"><span>{config.icon}</span><span className="text-xs font-medium text-slate-500">{config.label}</span>{item.priority === "high" && <Badge variant="danger">紧急</Badge>}</div><div className="mb-3 text-sm leading-relaxed text-slate-900 dark:text-white">{item.content}</div>{actions.length > 0 && <div className="mb-3 space-y-1.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80"><div className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><Tag size={12} />建议下一步</div>{actions.map((action) => <button key={action} className="block text-left text-xs text-sky-700 hover:underline dark:text-sky-300">{action}</button>)}</div>}{item.ai_result && <div className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800"><span className="font-medium text-emerald-600">AI 已完成处理</span></div>}<div className="flex items-center justify-between"><span className="flex items-center gap-1 text-xs text-slate-400"><CalendarDays size={12} />{new Date(item.created_at).toLocaleDateString("zh-CN")}</span><div className="flex gap-1">{item.status === "pending" && <button className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">完成</button>}<button className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">归档</button></div></div></div></Card>; })}</div>
    {filteredItems.length === 0 && <div className="py-12 text-center text-slate-400"><div className="mb-2 text-4xl">📭</div><div>这个分类下还没有内容</div></div>}</div>;
}
