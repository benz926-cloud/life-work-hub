"use client";

import { SectionHeader, Card, Badge } from "@/components/shared/SharedComponents";
import { mockWardrobeItems, mockOutfits } from "@/lib/mock-data";
import { RefreshCw, Plus } from "lucide-react";

const typeLabels: Record<string, string> = {
  top: "上衣", bottom: "下装", outerwear: "外套", dress: "连衣裙", shoes: "鞋子", accessory: "配饰",
};

export default function WardrobePage() {
  const todayOutfit = mockOutfits[0];
  const outfitItems = todayOutfit
    ? mockWardrobeItems.filter((w) => todayOutfit.items.includes(w.id))
    : [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="👔 智能穿搭"
        subtitle={`衣柜共 ${mockWardrobeItems.length} 件 · 今日推荐`}
        action={
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            <Plus size={14} /> 添加衣物
          </button>
        }
      />

      {/* Today's recommendation */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            📅 今日穿搭推荐
          </span>
          <button className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600">
            <RefreshCw size={14} /> 换一套
          </button>
        </div>
        <div className="p-4">
          <div className="text-xs text-gray-500 mb-3">
            天气：晴 32°C · 风格：休闲通勤
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {outfitItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-center"
              >
                <div className="text-3xl mb-2">
                  {item.type === "top" ? "👕" : item.type === "bottom" ? "👖" : item.type === "outerwear" ? "🧥" : item.type === "shoes" ? "👟" : "👔"}
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {item.name}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {typeLabels[item.type]} · {item.color}
                </div>
              </div>
            ))}
          </div>
          {todayOutfit?.notes && (
            <div className="mt-4 text-sm text-gray-500 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg">
              AI 搭配理由：{todayOutfit.notes}
            </div>
          )}
        </div>
      </Card>

      {/* Wardrobe */}
      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-900 dark:text-white">👗 我的衣柜</span>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {mockWardrobeItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
            >
              <div className="text-3xl mb-2 text-center">
                {item.type === "top" ? "👕" : item.type === "bottom" ? "👖" : item.type === "outerwear" ? "🧥" : item.type === "shoes" ? "👟" : "👔"}
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate text-center">
                {item.name}
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                {item.color} · {typeLabels[item.type]}
              </div>
              <div className="flex flex-wrap gap-1 mt-2 justify-center">
                {item.style.slice(0, 2).map((s) => (
                  <Badge key={s} variant="info">{s}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
