"use client";

import { useState } from "react";
import { SectionHeader, Badge, Card } from "@/components/shared/SharedComponents";
import { mockInboxItems } from "@/lib/mock-data";
import type { InboxItem, InboxCategory } from "@/types";
import { Send } from "lucide-react";

const categoryConfig: Record<InboxCategory, { label: string; icon: string; color: string }> = {
  task: { label: "任务", icon: "📋", color: "bg-blue-100 dark:bg-blue-900/30" },
  shopping: { label: "购物", icon: "🛒", color: "bg-pink-100 dark:bg-pink-900/30" },
  inspiration: { label: "灵感", icon: "💡", color: "bg-purple-100 dark:bg-purple-900/30" },
  ai_processing: { label: "AI处理中", icon: "🤖", color: "bg-green-100 dark:bg-green-900/30" },
};

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>(mockInboxItems);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<InboxCategory | "all">("all");

  const filteredItems =
    activeTab === "all" ? items : items.filter((i) => i.category === activeTab);

  const handleSubmit = () => {
    if (!input.trim()) return;
    // Simple intent detection
    let category: InboxCategory = "inspiration";
    if (input.includes("任务") || input.includes("做") || input.includes("完成") || input.includes("准备")) {
      category = "task";
    } else if (input.includes("买") || input.includes("购")) {
      category = "shopping";
    } else if (input.includes("调研") || input.includes("分析") || input.includes("帮我")) {
      category = "ai_processing";
    }

    const newItem: InboxItem = {
      id: `i${Date.now()}`,
      user_id: "",
      content: input,
      category,
      status: "pending",
      priority: "medium",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems([newItem, ...items]);
    setInput("");
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="📥 AI 收件箱" subtitle="对AI说任何想法，自动分类成任务/购物/灵感" />

      {/* Input */}
      <Card>
        <div className="p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="跟AI说点什么... 例如：准备下周汇报PPT"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-gray-400"
            />
            <button
              onClick={handleSubmit}
              className="px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Send size={16} />
              <span className="hidden sm:inline">发送</span>
            </button>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {(["📋 记灵感", "📋 加任务", "🛒 想买的", "🤖 AI帮我"] as const).map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  if (chip.includes("记灵感")) setInput("记录一个灵感：");
                  else if (chip.includes("加任务")) setInput("添加任务：");
                  else if (chip.includes("想买")) setInput("想买：");
                  else setInput("帮我调研：");
                }}
                className="px-3 py-1.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            activeTab === "all"
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          全部 ({items.length})
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as InboxCategory)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeTab === key
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : `${config.color} text-gray-700 dark:text-gray-300`
            }`}
          >
            {config.icon} {config.label} ({items.filter((i) => i.category === key).length})
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredItems.map((item) => {
          const config = categoryConfig[item.category];
          return (
            <Card key={item.id}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>{config.icon}</span>
                  <span className="text-xs font-medium text-gray-500">{config.label}</span>
                  {item.priority === "high" && <Badge variant="danger">紧急</Badge>}
                </div>
                <div className="text-sm text-gray-900 dark:text-white mb-3 leading-relaxed">
                  {item.content}
                </div>
                {item.ai_result && (
                  <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 mb-3 max-h-32 overflow-y-auto">
                    <span className="font-medium text-green-600">AI 已完成处理</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString("zh-CN")}
                  </span>
                  <div className="flex gap-1">
                    {item.status === "pending" && (
                      <button className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200">
                        完成
                      </button>
                    )}
                    <button className="text-xs px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded hover:bg-gray-200">
                      归档
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">📭</div>
          <div>这个分类下还没有内容</div>
        </div>
      )}
    </div>
  );
}
