"use client";

import { useState } from "react";
import { SectionHeader, Card, Badge } from "@/components/shared/SharedComponents";
import { mockContentFeeds, mockSubscriptionRules, mockAISuggestions } from "@/lib/mock-data";
import type { ContentPlatform } from "@/types";
import { Search, ExternalLink } from "lucide-react";

const platformConfig: Record<ContentPlatform, { label: string; color: string; domain: string }> = {
  bilibili: { label: "B站", color: "bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400", domain: "bilibili.com" },
  xiaohongshu: { label: "小红书", color: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400", domain: "xiaohongshu.com" },
  youtube: { label: "YouTube", color: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400", domain: "youtube.com" },
};

export default function ContentHub() {
  const [platform, setPlatform] = useState<ContentPlatform | "all">("all");

  const filtered = platform === "all" ? mockContentFeeds : mockContentFeeds.filter((f) => f.platform === platform);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="📡 内容聚合"
        subtitle="B站 · 小红书 · YouTube"
        action={
          <button className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            🤖 AI 扫描
          </button>
        }
      />

      {/* Platform filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setPlatform("all")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            platform === "all"
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600"
          }`}
        >
          全部 ({mockContentFeeds.length})
        </button>
        {Object.entries(platformConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setPlatform(key as ContentPlatform)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              platform === key
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : `${config.color} bg-opacity-10`
            }`}
          >
            {config.label} ({mockContentFeeds.filter((f) => f.platform === key).length})
          </button>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((feed) => {
          const config = platformConfig[feed.platform];
          return (
            <Card key={feed.id}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${config.color}`}>
                    {config.label}
                  </span>
                  {feed.likes && (
                    <span className="text-xs text-gray-400">{feed.likes.toLocaleString()} 👍</span>
                  )}
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {feed.title}
                </div>
                <div className="text-xs text-gray-500 mb-3 line-clamp-2">{feed.summary}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{feed.author}</span>
                  <div className="flex gap-1">
                    <button className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200">
                      收藏
                    </button>
                    <button className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200">
                      AI转化
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Subscription Rules */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">⚙️ 订阅规则</span>
          <button className="text-xs text-blue-500 hover:text-blue-600">+ 添加规则</button>
        </div>
        <div className="p-4 space-y-2">
          {mockSubscriptionRules.map((rule) => {
            const config = platformConfig[rule.platform];
            return (
              <div key={rule.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className={`text-xs px-2 py-0.5 rounded ${config.color}`}>{config.label}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {rule.keywords.map((k) => `#${k}`).join(" ")}
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full cursor-pointer ${rule.active ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-3 h-3 bg-white rounded-full m-0.5 transition-transform ${rule.active ? "translate-x-4" : ""}`} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
