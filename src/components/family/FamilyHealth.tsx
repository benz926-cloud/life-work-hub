"use client";

import { useMemo, useState } from "react";
import { Activity, Footprints, Moon, TrendingUp } from "lucide-react";
import { SectionHeader, Card } from "@/components/shared/SharedComponents";
import { useFamilyMembersData, useHealthData } from "@/hooks/useData";
import type { FamilyMember, HealthRecord } from "@/types";

const roleLabels: Record<string, string> = { self: "自己", spouse: "妻子", child: "女儿", parent: "父亲" };
const trendData = {
  heart: { label: "静息心率", value: "68", unit: "bpm", color: "#e05d5d", Icon: Activity, values: [71, 69, 70, 67, 68, 66, 68], note: "较上周 -2 bpm" },
  steps: { label: "每日步数", value: "8,432", unit: "步", color: "#168a7a", Icon: Footprints, values: [6200, 8120, 7550, 10480, 9320, 7100, 8432], note: "本周日均 8,172 步" },
  sleep: { label: "睡眠时长", value: "7.2", unit: "小时", color: "#6975d8", Icon: Moon, values: [6.8, 7.4, 6.9, 7.8, 7.1, 7.5, 7.2], note: "近 7 天保持稳定" },
} as const;
type Metric = keyof typeof trendData;

export default function FamilyHealth() {
  const members = useFamilyMembersData(); const healthRecords = useHealthData();
  const [metric, setMetric] = useState<Metric>("heart");
  const active = trendData[metric];
  return (
    <div className="space-y-6">
      <SectionHeader title="家庭健康" subtitle="4 位家庭成员 · Apple Health 已同步" />
      <section className="surface-card overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-labelledby="trend-title">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"><div><div className="flex items-center gap-2"><TrendingUp size={17} className="text-sky-600 dark:text-sky-300" /><h2 id="trend-title" className="text-sm font-semibold text-slate-900 dark:text-white">林涛的 7 日趋势</h2></div><p className="mt-1 text-xs text-slate-500">来自已同步的健康数据，图表为本地可视化展示。</p></div><div role="tablist" aria-label="健康趋势指标" className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">{(Object.keys(trendData) as Metric[]).map((key) => <button key={key} role="tab" aria-selected={metric === key} onClick={() => setMetric(key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${metric === key ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>{trendData[key].label}</button>)}</div></div>
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_12rem]"><div><TrendGraph label={active.label} values={active.values} color={active.color} unit={active.unit} /><div className="mt-2 flex justify-between px-1 text-[10px] text-slate-400"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>今天</span></div></div><div className="flex flex-col justify-center rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"><active.Icon size={20} style={{ color: active.color }} aria-hidden="true" /><div className="mt-4 flex items-baseline gap-1"><strong className="text-3xl tracking-tight text-slate-900 dark:text-white">{active.value}</strong><span className="text-xs text-slate-400">{active.unit}</span></div><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{active.note}</p></div></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {members.items.map((member) => <FamilyCard key={member.id} member={member} records={healthRecords.items} />)}
      </div>
    </div>
  );
}

function TrendGraph({ label, values, color, unit }: { label: string; values: readonly number[]; color: string; unit: string }) {
  const { path, area, lastX, lastY, min, max } = useMemo(() => {
    const width = 700; const height = 190; const padding = 18;
    const minimum = Math.min(...values); const maximum = Math.max(...values); const span = maximum - minimum || 1;
    const points = values.map((value, index) => ({ x: padding + (index * (width - padding * 2)) / (values.length - 1), y: height - padding - ((value - minimum) / span) * (height - padding * 2) }));
    const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    return { path: line, area: `${line} L ${points.at(-1)?.x} ${height - padding} L ${points[0].x} ${height - padding} Z`, lastX: points.at(-1)?.x ?? 0, lastY: points.at(-1)?.y ?? 0, min: minimum, max: maximum };
  }, [values]);
  return <div><div className="sr-only">{label}趋势，最高 {max}{unit}，最低 {min}{unit}</div><svg viewBox="0 0 700 190" role="img" aria-label={`${label}七日趋势`} className="h-44 w-full overflow-visible"><defs><linearGradient id={`trend-${label}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".24" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>{[32, 82, 132].map((y) => <line key={y} x1="18" y1={y} x2="682" y2={y} stroke="currentColor" strokeOpacity=".08" strokeDasharray="4 5" />)}<path d={area} fill={`url(#trend-${label})`} /><path d={path} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx={lastX} cy={lastY} r="6" fill="white" stroke={color} strokeWidth="3" className="dark:fill-slate-900" /></svg></div>;
}

function FamilyCard({ member, records }: { member: FamilyMember; records: HealthRecord[] }) {
  const health = records.find((record) => record.family_member_id === member.id);
  const metrics = health ? [
    health.steps && { value: health.steps.toLocaleString(), label: "今日步数" }, health.sleep_hours && { value: `${health.sleep_hours}h`, label: "昨晚睡眠" }, health.heart_rate && { value: `${health.heart_rate}`, label: "静息心率" }, health.blood_pressure_systolic && { value: `${health.blood_pressure_systolic}/${health.blood_pressure_diastolic}`, label: "血压", warning: true }, health.blood_sugar && { value: `${health.blood_sugar}`, label: "空腹血糖" }, health.active_minutes && { value: `${health.active_minutes}min`, label: "运动时长" },
  ].filter(Boolean) as { value: string; label: string; warning?: boolean }[] : [];
  return <Card className="overflow-hidden"><div className="p-4"><div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-teal-600 text-sm font-bold text-white">{member.name[0]}</div><div><h2 className="font-medium text-slate-900 dark:text-white">{member.name}<span className="ml-1.5 text-xs font-normal text-slate-400">{roleLabels[member.role]} · {member.age}岁</span></h2><p className="mt-0.5 text-xs text-slate-500">{health ? "今日已同步" : "等待新的健康数据"}</p></div></div>{metrics.length > 0 && <div className="grid grid-cols-2 gap-2">{metrics.map((item) => <div key={item.label} className={`rounded-xl p-2.5 ${item.warning ? "bg-rose-50 dark:bg-rose-500/10" : "bg-slate-50 dark:bg-slate-800"}`}><div className={`text-base font-semibold ${item.warning ? "text-rose-600 dark:text-rose-300" : "text-slate-900 dark:text-white"}`}>{item.value}</div><div className={`mt-0.5 text-xs ${item.warning ? "text-rose-500" : "text-slate-500"}`}>{item.label}{item.warning && " · 偏高"}</div></div>)}</div>}{member.health_conditions?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{member.health_conditions.map((condition) => <span key={condition} className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{condition}</span>)}</div> : null}</div></Card>;
}
