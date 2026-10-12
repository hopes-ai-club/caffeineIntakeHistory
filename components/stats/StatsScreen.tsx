"use client";

import { useState } from "react";
import TabBar from "@/components/TabBar";
import { useIntakeRecords } from "@/hooks/useIntakeRecords";
import { useNow } from "@/hooks/useNow";
import { useSettings } from "@/hooks/useSettings";
import { calculateStats, type StatsPeriod, type StatsTrendPoint } from "@/lib/stats";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PERIODS: ReadonlyArray<{ value: StatsPeriod; label: string }> = [
  { value: "month", label: "1か月" },
  { value: "quarter", label: "3か月" },
  { value: "all", label: "全期間" },
];

const displayMg = (mg: number) => Math.round(mg).toLocaleString("ja-JP");
const shortDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
const longDate = (date: Date) => new Intl.DateTimeFormat("ja-JP", {
  year: "numeric", month: "short", day: "numeric",
}).format(date);

function trendLabel(point: StatsTrendPoint, weekly: boolean): string {
  return weekly && point.start.getTime() !== point.end.getTime()
    ? `${shortDate(point.start)}〜${shortDate(point.end)}`
    : shortDate(point.start);
}

interface TrendChartProps {
  points: StatsTrendPoint[];
  weekly: boolean;
}

function TrendChart({ points, weekly }: TrendChartProps) {
  const max = Math.max(...points.map((point) => point.totalMg), 1);
  const itemWidth = weekly ? 24 : 14;
  return (
    <div>
      <div className="overflow-x-auto pb-space-5">
        <ol
          aria-label={`${weekly ? "週" : "日"}別摂取量`}
          className="flex h-[160px] items-end gap-space-4 border-b border-border-strong"
          style={{ minWidth: `${Math.max(300, points.length * itemWidth)}px` }}
        >
          {points.map((point) => {
            const label = trendLabel(point, weekly);
            const height = point.totalMg === 0 ? 0 : Math.max(3, point.totalMg / max * 100);
            return (
              <li
                key={`${point.start.toISOString()}-${point.end.toISOString()}`}
                aria-label={`${label} ${displayMg(point.totalMg)} mg`}
                title={`${label}: ${displayMg(point.totalMg)} mg`}
                className="flex h-full min-w-0 flex-1 items-end"
              >
                <span aria-hidden="true" className="w-full rounded-t-radius-5 bg-accent" style={{ height: `${height}%` }} />
              </li>
            );
          })}
        </ol>
      </div>
      <div aria-hidden="true" className="mt-space-4 flex justify-between font-mono text-size-11 text-text-quaternary">
        <span>{trendLabel(points[0], weekly)}</span>
        <span>{trendLabel(points[points.length - 1], weekly)}</span>
      </div>
    </div>
  );
}

/** 長期的な摂取傾向に限定し、個別記録の操作は履歴画面に委ねる。 */
export default function StatsScreen() {
  const intake = useIntakeRecords();
  const preferences = useSettings();
  const now = useNow();
  const [period, setPeriod] = useState<StatsPeriod>("month");

  const loading = !now || intake.status === "loading" || preferences.status === "loading";
  const recordsBroken = intake.status === "error";
  const settingsBroken = preferences.status === "error";
  const stats = now && !recordsBroken
    ? calculateStats(intake.records, period, preferences.settings.dailyLimitMg, now)
    : null;
  const empty = stats?.recordCount === 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col bg-bg-base px-space-20 pt-[max(60px,env(safe-area-inset-top))] min-[600px]:max-w-[420px]">
      <header className="mb-space-16">
        <h1 className="text-size-26 font-semibold tracking-[-0.01em]">統計</h1>
      </header>

      <div aria-label="統計の表示期間" className="mb-space-20 grid grid-cols-3 gap-space-4 rounded-radius-14 bg-surface-row p-space-4">
        {PERIODS.map((item) => {
          const active = period === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              onClick={() => setPeriod(item.value)}
              className={`rounded-radius-10 px-space-8 py-space-10 text-size-13 transition-colors motion-reduce:transition-none ${focus} ${active ? "bg-surface-selected text-text-primary" : "text-text-tertiary"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {recordsBroken ? (
        <p role="alert" className="rounded-radius-18 border border-danger bg-surface-card p-space-16 text-size-14 leading-[1.55]">
          記録を読み込めませんでした。正しい統計を計算できないため、値の表示を停止しています。
        </p>
      ) : loading ? (
        <p role="status" className="text-size-14 text-text-secondary">読み込み中…</p>
      ) : stats && empty ? (
        <section className="rounded-radius-18 border border-border-subtle bg-surface-card p-space-20">
          <h2 className="text-size-15 font-medium">この期間の記録はありません</h2>
          <p className="mt-space-8 text-size-13 leading-[1.55] text-text-secondary">期間を切り替えると、以前の記録から摂取傾向を確認できます。</p>
        </section>
      ) : stats ? (
        <div aria-live="polite" className="flex flex-col gap-space-22">
          <p className="font-mono text-size-12 tracking-[0.02em] text-text-tertiary">
            {longDate(stats.range.start)} — {longDate(stats.range.end)}
          </p>

          {settingsBroken && (
            <p role="alert" className="rounded-radius-16 border border-danger bg-surface-card p-space-14 text-size-13 leading-[1.55]">
              設定を読み込めないため、上限超過日数は表示できません。
            </p>
          )}

          <section aria-label="期間の概要" className="grid grid-cols-2 gap-space-8">
            <div className="min-w-0 rounded-radius-18 border border-border-subtle bg-surface-card p-space-16">
              <p className="text-size-12 text-text-tertiary">総摂取量</p>
              <p className="mt-space-6 break-all font-mono text-size-22">{displayMg(stats.totalMg)}<span className="ml-space-4 text-size-12 text-text-tertiary">mg</span></p>
            </div>
            <div className="min-w-0 rounded-radius-18 border border-border-subtle bg-surface-card p-space-16">
              <p className="text-size-12 text-text-tertiary">1日平均</p>
              <p className="mt-space-6 break-all font-mono text-size-22">{displayMg(stats.averageDailyMg)}<span className="ml-space-4 text-size-12 text-text-tertiary">mg</span></p>
            </div>
            <div className="col-span-2 flex items-end justify-between gap-space-12 rounded-radius-18 border border-border-subtle bg-surface-card p-space-16">
              <div>
                <p className="text-size-12 text-text-tertiary">上限超過日数</p>
                <p className="mt-space-6 font-mono text-size-22">{settingsBroken ? "—" : stats.overLimitDays}<span className="ml-space-4 text-size-12 text-text-tertiary">{settingsBroken ? "" : "日"}</span></p>
              </div>
              <p className="text-right text-size-11 leading-[1.45] text-text-quaternary">平均は{stats.range.dayCount}日間で計算</p>
            </div>
          </section>

          <section aria-labelledby="stats-trend" className="rounded-radius-18 border border-border-subtle bg-surface-card p-space-16">
            <div className="mb-space-16 flex items-baseline justify-between gap-space-8">
              <h2 id="stats-trend" className="text-size-15 font-medium">摂取量の推移</h2>
              <span className="text-size-12 text-text-tertiary">{stats.trendGranularity === "day" ? "日別" : "週別"}</span>
            </div>
            <TrendChart points={stats.trend} weekly={stats.trendGranularity === "week"} />
            <p className="mt-space-8 text-size-11 text-text-quaternary">棒にポインターを合わせると期間と摂取量を確認できます。</p>
          </section>

          <section aria-labelledby="stats-drinks">
            <h2 id="stats-drinks" className="mb-space-10 text-size-15 font-medium">飲み物別の内訳</h2>
            <ul className="flex flex-col gap-px overflow-hidden rounded-radius-16 bg-border-subtle">
              {stats.drinks.map((drink) => (
                <li key={drink.key} className="bg-surface-row px-space-16 py-space-14">
                  <div className="flex items-baseline justify-between gap-space-12">
                    <span className="min-w-0 flex-1 break-words text-size-14">{drink.name}</span>
                    <span className="shrink-0 font-mono text-size-14">{displayMg(drink.totalMg)}<span className="text-size-11 text-text-tertiary"> mg</span></span>
                  </div>
                  <div className="mt-space-8 flex items-center gap-space-10">
                    <div aria-hidden="true" className="h-space-4 min-w-0 flex-1 overflow-hidden rounded-radius-99 bg-text-primary/[0.09]">
                      <div className="h-full rounded-radius-99 bg-accent" style={{ width: `${drink.totalMg / Math.max(stats.drinks[0].totalMg, 1) * 100}%` }} />
                    </div>
                    <span className="shrink-0 font-mono text-size-11 text-text-tertiary">{drink.count}回</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      <div className="mt-auto pt-space-22">
        <TabBar />
      </div>
    </main>
  );
}
