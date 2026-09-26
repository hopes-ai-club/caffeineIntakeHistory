"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useIntakeRecords } from "@/hooks/useIntakeRecords";
import { useSettings } from "@/hooks/useSettings";
import { useNow } from "@/hooks/useNow";
import {
  HALF_LIFE_HOURS, calculateResidualMg, sampleResidualCurve, findResidualPeak,
  calculateBedtimeResidualMg, calculateLastCupTime,
} from "@/lib/caffeine";
import { formatTime, getBedtime, startOfDay } from "@/lib/datetime";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const displayMg = (mg: number) => Math.round(mg).toLocaleString("ja-JP");
/** ホームのカットオフ・バナーと同じ仮設定（追加1杯・就寝時残量目標）。lib側の計算は再利用するが、定数はHome（3-1）側が非exportのため複製する。 */
const CUTOFF_CUP_MG = 90;
const CUTOFF_TARGET_MG = 50;
/** カーブの表示範囲。ホーム・詳細で共通の仕様（当日06:00〜翌日02:00、5分刻み）。 */
const CURVE_START_HOUR = 6;
const CURVE_END_HOUR = 26;
const CURVE_INTERVAL_MINUTES = 5;

const VB_WIDTH = 320;
const VB_HEIGHT = 150;
const CHART_TOP = 14;
const CHART_BOTTOM = 142;
const HEADROOM = 1.15;

export interface ResidualCardProps {
  /** 開閉状態。閉じている間は非表示・非操作にする。 */
  open: boolean;
  /** 閉じる操作（戻るボタン・Esc）を呼び出し側へ通知する。 */
  onClose: () => void;
}

/** 体内残量の詳細ビュー。全画面オーバーレイとしてIntakeFormと同じ開閉契約で提供する。 */
export default function ResidualCard({ open, onClose }: ResidualCardProps) {
  const intake = useIntakeRecords();
  const preferences = useSettings();
  const now = useNow();

  useEffect(() => {
    if (!open) return;
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  const loading = !now || intake.status === "loading" || preferences.status === "loading";
  const broken = intake.status === "error" || preferences.status === "error";
  const ready = !loading && !broken;

  const records = intake.records;
  const settings = preferences.settings;

  const curveStart = ready ? new Date(startOfDay(now!).getTime() + CURVE_START_HOUR * 3_600_000) : null;
  const curveEnd = ready ? new Date(startOfDay(now!).getTime() + CURVE_END_HOUR * 3_600_000) : null;
  const curve = ready ? sampleResidualCurve(records, curveStart!, curveEnd!, CURVE_INTERVAL_MINUTES) : [];
  const peak = ready ? findResidualPeak(curve) : null;
  const current = ready ? calculateResidualMg(records, now!) : 0;
  const bedtime = ready ? getBedtime(now!, settings.bedtime) : null;
  const bedtimeResidual = ready ? calculateBedtimeResidualMg(records, settings, now!) : 0;
  const cutoff = ready ? calculateLastCupTime(records, settings, CUTOFF_CUP_MG, CUTOFF_TARGET_MG, now!) : null;

  const chartMaxMg = ready ? Math.max(peak?.residualMg ?? 0, settings.dailyLimitMg, 1) * HEADROOM : 1;
  const mapX = (at: number) => ((at - curveStart!.getTime()) / (curveEnd!.getTime() - curveStart!.getTime())) * VB_WIDTH;
  const mapY = (mg: number) => CHART_BOTTOM - Math.max(0, Math.min(1, mg / chartMaxMg)) * (CHART_BOTTOM - CHART_TOP);
  const inRange = (at: number) => ready && at >= curveStart!.getTime() && at <= curveEnd!.getTime();

  const linePath = ready
    ? curve.map((point, index) => `${index === 0 ? "M" : "L"}${mapX(Date.parse(point.at)).toFixed(1)},${mapY(point.residualMg).toFixed(1)}`).join(" ")
    : "";
  const areaPath = ready && curve.length > 0
    ? `${linePath} L${VB_WIDTH},${CHART_BOTTOM} L0,${CHART_BOTTOM} Z`
    : "";

  const nowX = ready && inRange(now!.getTime()) ? mapX(now!.getTime()) : null;
  const bedtimeX = ready && bedtime && inRange(bedtime.getTime()) ? mapX(bedtime.getTime()) : null;
  const limitY = ready ? mapY(settings.dailyLimitMg) : 0;

  const xTicks = ready
    ? Array.from({ length: 6 }, (_, i) => new Date(curveStart!.getTime() + (i / 5) * (curveEnd!.getTime() - curveStart!.getTime())))
    : [];

  return (
    <div
      role="presentation"
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-0 z-50 bg-bg-overlay transition-opacity duration-[240ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="residual-card-title"
        className={`mx-auto flex h-full w-full flex-col bg-bg-base px-space-20 pt-[max(60px,env(safe-area-inset-top))] pb-[max(34px,env(safe-area-inset-bottom))] transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] min-[600px]:max-w-[420px] ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <header className="mb-space-24 flex shrink-0 items-center justify-between">
          <div className="-ml-space-6 flex items-center gap-space-8">
            <button type="button" onClick={onClose} aria-label="戻る" className={`flex size-[34px] items-center justify-center rounded-radius-99 text-size-22 text-text-tertiary ${focus}`}>←</button>
            <h1 id="residual-card-title" className="text-size-26 font-semibold tracking-[-0.01em]">体内残量</h1>
          </div>
          <span className="font-mono text-size-13 text-text-tertiary">半減期 {HALF_LIFE_HOURS.toFixed(1)}h</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {broken ? (
            <p role="alert" className="rounded-radius-18 border border-danger bg-surface-card p-space-16 text-size-14">
              記録または設定を読み込めませんでした。データを確認できないため、詳細を表示できません。再読み込みしてお試しください。
            </p>
          ) : loading ? (
            <p role="status" className="text-size-14 text-text-secondary">読み込み中…</p>
          ) : (
            <>
              <div className="mb-space-4 flex items-end gap-space-8">
                <span className="font-mono text-size-64 leading-[0.85] tracking-[-0.02em] text-accent">{displayMg(current)}</span>
                <span className="pb-space-6 font-mono text-size-17 text-text-tertiary">mg</span>
              </div>
              {peak && peak.residualMg > 0 && (
                <p className="mb-space-20 text-size-14 text-text-secondary">
                  ピークは <span className="font-mono">{formatTime(new Date(peak.at))}</span> の <span className="font-mono">{displayMg(peak.residualMg)}mg</span>
                </p>
              )}

              <div className="rounded-radius-22 border border-border-subtle bg-surface-card px-space-16 pb-[12px] pt-[18px]">
                <svg viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`} width="100%" height="170" style={{ display: "block", overflow: "visible" }}>
                  <defs>
                    <linearGradient id="residual-curve-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8913F" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#E8913F" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <line x1={0} y1={limitY} x2={VB_WIDTH} y2={limitY} stroke="rgba(210,96,63,0.4)" strokeWidth={1} strokeDasharray="4 5" />
                  <text x={VB_WIDTH} y={limitY - 6} textAnchor="end" fill="#D2603F" fontSize={10} fontFamily="IBM Plex Mono, monospace">上限 {displayMg(settings.dailyLimitMg)}mg</text>

                  {areaPath && <path d={areaPath} fill="url(#residual-curve-fill)" />}
                  {linePath && <path d={linePath} fill="none" stroke="#E8913F" strokeWidth={2.2} strokeLinejoin="round" />}

                  {nowX !== null && (
                    <>
                      <line x1={nowX} y1={0} x2={nowX} y2={VB_HEIGHT} stroke="rgba(244,238,229,0.22)" strokeWidth={1} strokeDasharray="3 4" />
                      <circle cx={nowX} cy={mapY(current)} r={5} fill="#E8913F" stroke="#221C16" strokeWidth={2.5} />
                    </>
                  )}
                  {bedtimeX !== null && (
                    <>
                      <line x1={bedtimeX} y1={0} x2={bedtimeX} y2={VB_HEIGHT} stroke="rgba(122,160,190,0.45)" strokeWidth={1} />
                      <text x={bedtimeX} y={VB_HEIGHT - 4} textAnchor={bedtimeX > VB_WIDTH - 30 ? "end" : bedtimeX < 30 ? "start" : "middle"} fill="#7AA0BE" fontSize={10} fontFamily="IBM Plex Mono, monospace">就寝 {settings.bedtime}</text>
                    </>
                  )}
                </svg>
                <div className="flex justify-between pt-space-6 font-mono text-size-11 text-text-quaternary">
                  {xTicks.map((tick) => <span key={tick.toISOString()}>{formatTime(tick)}</span>)}
                </div>
              </div>

              <div className="mt-space-16 flex gap-space-10">
                <div className="flex flex-1 flex-col gap-[7px] rounded-radius-18 border border-border-subtle bg-surface-card p-space-16">
                  <span className="text-size-13 text-text-tertiary">就寝時の残量</span>
                  <span className="font-mono text-size-22 text-text-primary">{displayMg(bedtimeResidual)}<span className="text-size-13 text-text-tertiary"> mg</span></span>
                  <span className="text-size-12 text-sleep">就寝時点（{settings.bedtime}）の推定値</span>
                </div>
                <div className="flex flex-1 flex-col gap-[7px] rounded-radius-18 border border-border-subtle bg-surface-card p-space-16">
                  <span className="text-size-13 text-text-tertiary">最後の1杯</span>
                  {cutoff ? (
                    <>
                      <span className="font-mono text-size-22 text-accent">{formatTime(cutoff)}</span>
                      <span className="text-size-12 text-text-tertiary">まで（{CUTOFF_CUP_MG}mg想定）</span>
                    </>
                  ) : (
                    <span className="text-size-13 text-text-secondary">この条件では、今日これから追加できる目安時刻はありません</span>
                  )}
                </div>
              </div>

              <div className="mt-space-16 overflow-hidden rounded-radius-22 border border-border-subtle bg-surface-card">
                <Link href="/settings" onClick={onClose} className={`flex items-center justify-between px-space-16 py-space-16 ${focus}`}>
                  <span className="text-size-15">就寝時刻</span>
                  <span className="flex items-center gap-space-6">
                    <span className="font-mono text-size-15 text-text-secondary">{settings.bedtime}</span>
                    <span aria-hidden="true" className="text-size-14 text-text-quaternary">›</span>
                  </span>
                </Link>
                <div className="flex items-center justify-between border-t border-border-subtle px-space-16 py-space-16">
                  <span className="text-size-15 text-text-secondary">半減期モデル</span>
                  <span className="font-mono text-size-15 text-text-quaternary">固定 {HALF_LIFE_HOURS.toFixed(1)}h</span>
                </div>
                <Link href="/settings" onClick={onClose} className={`flex items-center justify-between border-t border-border-subtle px-space-16 py-space-16 ${focus}`}>
                  <span className="text-size-15">1日の上限</span>
                  <span className="flex items-center gap-space-6">
                    <span className="font-mono text-size-15 text-text-secondary">{displayMg(settings.dailyLimitMg)} mg</span>
                    <span aria-hidden="true" className="text-size-14 text-text-quaternary">›</span>
                  </span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
