"use client";

import { useId, type Ref } from "react";
import { calculateResidualMg, sampleResidualCurve } from "@/lib/caffeine";
import { formatTime, startOfDay } from "@/lib/datetime";
import type { IntakeRecord } from "@/types";

interface Props {
  records: IntakeRecord[];
  now: Date;
  dailyLimitMg: number;
  triggerRef: Ref<HTMLButtonElement>;
  onOpen: () => void;
}

/** 詳細と同じ全期間の記録・時計・半減期モデルで描くホーム用カード。 */
export default function ResidualSummary({ records, now, dailyLimitMg, triggerRef, onOpen }: Props) {
  const gradientId = useId();
  const start = new Date(startOfDay(now).getTime() + 6 * 3_600_000);
  const end = new Date(startOfDay(now).getTime() + 26 * 3_600_000);
  const points = sampleResidualCurve(records, start, end, 5);
  const current = calculateResidualMg(records, now);
  const maximum = Math.max(dailyLimitMg, ...points.map(point => point.residualMg), 1) * 1.15;
  const x = (at: number) => (at - start.getTime()) / (end.getTime() - start.getTime()) * 300;
  const y = (mg: number) => 90 - mg / maximum * 82;
  const path = points.map((point, i) => `${i ? "L" : "M"}${x(Date.parse(point.at)).toFixed(1)},${y(point.residualMg).toFixed(1)}`).join(" ");
  const inRange = now >= start && now <= end;

  return (
    <button ref={triggerRef} type="button" onClick={onOpen} aria-label="体内残量の詳細を開く" aria-haspopup="dialog"
      className="mt-space-14 w-full rounded-radius-22 border border-border-subtle bg-surface-card px-space-20 pt-space-20 pb-space-14 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <span className="flex flex-wrap items-baseline justify-between gap-space-8">
        <span className="text-size-15 text-text-secondary">いま体内に残っている量</span>
        <time dateTime={now.toISOString()} className="font-mono text-size-13 text-text-tertiary">{formatTime(now)}</time>
      </span>
      <span className="mt-space-8 block font-mono text-size-34 text-accent">
        {Math.round(current).toLocaleString("ja-JP")}<span className="ml-space-6 text-size-14 text-text-tertiary">mg</span>
      </span>
      <svg aria-hidden="true" viewBox="0 0 300 96" preserveAspectRatio="none" width="100%" height="96">
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E8913F" stopOpacity=".3" /><stop offset="100%" stopColor="#E8913F" stopOpacity="0" /></linearGradient></defs>
        <path d={`${path} L300,96 L0,96 Z`} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="#E8913F" strokeWidth="2" strokeLinejoin="round" />
        {inRange && <><line x1={x(now.getTime())} x2={x(now.getTime())} y1="0" y2="96" stroke="rgba(244,238,229,.22)" strokeDasharray="3 4" /><circle cx={x(now.getTime())} cy={y(current)} r="4.5" fill="#E8913F" stroke="#17130F" strokeWidth="2" /></>}
      </svg>
      <span aria-hidden="true" className="flex justify-between font-mono text-size-11 text-text-quaternary">
        {["06", "10", "14", "18", "22", "02"].map(label => <span key={label}>{label}</span>)}
      </span>
      <span className="mt-space-8 block text-right text-size-12 text-text-tertiary">残量の詳細を見る ›</span>
    </button>
  );
}
