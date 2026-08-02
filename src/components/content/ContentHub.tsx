"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Heart, Search, Sparkles } from "lucide-react";
import { SectionHeader, Card } from "@/components/shared/SharedComponents";
import { mockContentFeeds, mockSubscriptionRules } from "@/lib/mock-data";
import type { ContentPlatform } from "@/types";

const platformConfig: Record<ContentPlatform, { label: string; color: string }> = {
  bilibili: { label: "B站", color: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
  xiaohongshu: { label: "小红书", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  youtube: { label: "YouTube", color: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};
const tags = ["全部", "效率", "旅行", "健康", "穿搭", "学习"] as const;
type Tag = (typeof tags)[number];
const inferTags = (title: string): Tag[] => {
  if (/穿搭/.test(title)) return ["穿搭"];
  if (/旅行|大理|成都/.test(title)) return ["旅行"];
  if (/高血压|饮食/.test(title)) return ["健康"];
  if (/英语/.test(title)) return ["学习"];
  return ["效率"];
};

export default function ContentHub() {
  const [platform, setPlatform] = useState<ContentPlatform | "all">("all");
  const [tag, setTag] = useState<Tag>("全部");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const animationTimer = useRef<number | null>(null);
  const filtered = useMemo(() => mockContentFeeds.filter((feed) => {
    const matchesPlatform = platform === "all" || feed.platform === platform;
    const matchesTag = tag === "全部" || inferTags(feed.title).includes(tag);
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || `${feed.title} ${feed.author} ${feed.summary}`.toLowerCase().includes(needle);
    return matchesPlatform && matchesTag && matchesQuery;
  }), [platform, tag, query]);
  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setAnimatingId(id); if (animationTimer.current) window.clearTimeout(animationTimer.current);
    animationTimer.current = window.setTimeout(() => setAnimatingId(null), 420);
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="内容聚合" subtitle="把值得看的内容，变成下一步行动。" action={<button className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"><Sparkles size={14} />AI 扫描</button>} />
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="relative w-full sm:max-w-xs"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、作者或摘要" className="h-9 w-full rounded-xl bg-slate-100 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-sky-500/30 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-950" /></div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="内容平台筛选"><button role="tab" aria-selected={platform === "all"} onClick={() => setPlatform("all")} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${platform === "all" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}>全部 {mockContentFeeds.length}</button>{(Object.keys(platformConfig) as ContentPlatform[]).map((key) => <button key={key} role="tab" aria-selected={platform === key} onClick={() => setPlatform(key)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${platform === key ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{platformConfig[key].label}</button>)}</div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="主题筛选">{tags.map((item) => <button key={item} type="button" onClick={() => setTag(item)} aria-pressed={tag === item} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${tag === item ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300" : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"}`}>#{item}</button>)}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((feed) => {
        const config = platformConfig[feed.platform]; const expanded = expandedId === feed.id; const saved = favorites.has(feed.id);
        return <article key={feed.id} tabIndex={0} onMouseEnter={() => setExpandedId(feed.id)} onMouseLeave={() => setExpandedId(null)} onFocus={() => setExpandedId(feed.id)} onBlur={() => setExpandedId(null)} className="content-card relative flex min-h-60 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 outline-none dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-2"><span className={`rounded-md px-2 py-1 text-xs font-medium ${config.color}`}>{config.label}</span><button type="button" onClick={() => toggleFavorite(feed.id)} aria-label={saved ? "取消收藏" : "收藏内容"} aria-pressed={saved} className={`grid h-8 w-8 place-items-center rounded-full transition ${saved ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10" : "text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"}`}><Heart size={17} fill={saved ? "currentColor" : "none"} className={animatingId === feed.id ? "favorite-pop" : ""} /></button></div>
          <h2 className={`text-sm font-semibold leading-6 text-slate-900 transition dark:text-white ${expanded ? "" : "line-clamp-2"}`}>{feed.title}</h2><p className={`mt-2 text-xs leading-5 text-slate-500 transition dark:text-slate-400 ${expanded ? "" : "line-clamp-2"}`}>{feed.summary}</p>
          <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ${expanded ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden"><div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">{inferTags(feed.title).map((item) => <span key={item} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">#{item}</span>)}<span className="ml-auto text-[11px] text-slate-400">{feed.likes?.toLocaleString() ?? 0} 喜欢</span></div></div></div>
          <div className="mt-auto flex items-center justify-between pt-4 text-xs"><span className="max-w-32 truncate text-slate-400">{feed.author}</span><div className="flex items-center gap-1"><button type="button" onClick={() => setExpandedId(expanded ? null : feed.id)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">详情 <ChevronDown size={13} className={`ml-0.5 inline transition-transform ${expanded ? "rotate-180" : ""}`} /></button><button type="button" className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="打开原文"><ExternalLink size={14} /></button></div></div>
        </article>;
      })}</div>
      {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center text-sm text-slate-400 dark:border-slate-700">没有符合当前筛选条件的内容。</div>}
      <Card><div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">订阅规则</h2><button className="text-xs font-medium text-sky-700 hover:text-sky-800 dark:text-sky-300">+ 添加规则</button></div><div className="divide-y divide-slate-100 p-2 dark:divide-slate-800">{mockSubscriptionRules.map((rule) => <div key={rule.id} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"><span className={`shrink-0 rounded-md px-2 py-1 text-xs ${platformConfig[rule.platform].color}`}>{platformConfig[rule.platform].label}</span><span className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">{rule.keywords.map((keyword) => `#${keyword}`).join(" ")}</span><span className={`h-5 w-9 rounded-full p-0.5 ${rule.active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}><span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${rule.active ? "translate-x-4" : ""}`} /></span></div>)}</div></Card>
    </div>
  );
}
