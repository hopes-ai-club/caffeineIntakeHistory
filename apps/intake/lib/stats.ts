import type { IntakeRecord } from "../types";
import { groupKey } from "./caffeine";
import { assertDate, startOfDay } from "./datetime";

export type StatsPeriod = "month" | "quarter" | "all";
export type TrendGranularity = "day" | "week";

export interface StatsRange {
  start: Date;
  end: Date;
  dayCount: number;
}

export interface StatsTrendPoint {
  start: Date;
  end: Date;
  totalMg: number;
}

export interface StatsDrinkBreakdown {
  key: string;
  presetId: string | null;
  name: string;
  count: number;
  totalMg: number;
}

export interface StatsResult {
  period: StatsPeriod;
  range: StatsRange;
  recordCount: number;
  totalMg: number;
  averageDailyMg: number;
  overLimitDays: number;
  trendGranularity: TrendGranularity;
  trend: StatsTrendPoint[];
  drinks: StatsDrinkBreakdown[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** DSTの影響を受けないよう、ローカル暦日をUTC上の通し番号に変換する。 */
function calendarDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function daysInclusive(start: Date, end: Date): number {
  return calendarDayNumber(end) - calendarDayNumber(start) + 1;
}

function addLocalDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function localDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function assertLimit(dailyLimitMg: number): void {
  if (!Number.isFinite(dailyLimitMg) || dailyLimitMg < 0) throw new RangeError("Invalid daily limit");
}

function eligibleRecords(records: readonly IntakeRecord[], now: Date): IntakeRecord[] {
  const nowMs = now.getTime();
  return records.filter((record) => {
    const at = new Date(record.consumedAt);
    assertDate(at);
    if (!Number.isFinite(record.caffeineMg) || record.caffeineMg < 0) throw new RangeError("Invalid caffeine amount");
    return at.getTime() <= nowMs;
  });
}

/** 統計期間はミリ秒ではなく、端末のローカル暦日で求める。 */
export function getStatsRange(
  records: readonly IntakeRecord[], period: StatsPeriod, now = new Date(),
): StatsRange {
  assertDate(now);
  const today = startOfDay(now);
  if (period === "month") return { start: addLocalDays(today, -29), end: new Date(now), dayCount: 30 };
  if (period === "quarter") return { start: addLocalDays(today, -89), end: new Date(now), dayCount: 90 };
  if (period !== "all") throw new RangeError("Invalid stats period");

  const eligible = eligibleRecords(records, now);
  if (eligible.length === 0) return { start: today, end: new Date(now), dayCount: 1 };
  const earliestMs = Math.min(...eligible.map((record) => new Date(record.consumedAt).getTime()));
  const start = startOfDay(new Date(earliestMs));
  return { start, end: new Date(now), dayCount: daysInclusive(start, today) };
}

function buildDailyTotals(records: readonly IntakeRecord[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of records) {
    const key = localDayKey(new Date(record.consumedAt));
    totals.set(key, (totals.get(key) ?? 0) + record.caffeineMg);
  }
  return totals;
}

function buildDailyTrend(range: StatsRange, totals: ReadonlyMap<string, number>): StatsTrendPoint[] {
  const trend: StatsTrendPoint[] = [];
  let cursor = new Date(range.start);
  const lastDay = startOfDay(range.end);
  while (cursor.getTime() <= lastDay.getTime()) {
    trend.push({ start: new Date(cursor), end: new Date(cursor), totalMg: totals.get(localDayKey(cursor)) ?? 0 });
    cursor = addLocalDays(cursor, 1);
  }
  return trend;
}

function nextMonday(date: Date): Date {
  const days = date.getDay() === 1 ? 7 : (8 - date.getDay()) % 7;
  return addLocalDays(date, days);
}

function buildWeeklyTrend(range: StatsRange, totals: ReadonlyMap<string, number>): StatsTrendPoint[] {
  const trend: StatsTrendPoint[] = [];
  const lastDay = startOfDay(range.end);
  let cursor = new Date(range.start);
  while (cursor.getTime() <= lastDay.getTime()) {
    const followingMonday = nextMonday(cursor);
    const naturalEnd = addLocalDays(followingMonday, -1);
    const end = naturalEnd.getTime() < lastDay.getTime() ? naturalEnd : new Date(lastDay);
    let totalMg = 0;
    for (let day = new Date(cursor); day.getTime() <= end.getTime(); day = addLocalDays(day, 1)) {
      totalMg += totals.get(localDayKey(day)) ?? 0;
    }
    trend.push({ start: new Date(cursor), end, totalMg });
    cursor = followingMonday;
  }
  return trend;
}

function buildDrinkBreakdown(records: readonly IntakeRecord[]): StatsDrinkBreakdown[] {
  const groups = new Map<string, StatsDrinkBreakdown>();
  for (const record of records) {
    const key = groupKey(record);
    const group = groups.get(key) ?? {
      key,
      presetId: record.presetId,
      name: record.name.trim(),
      count: 0,
      totalMg: 0,
    };
    group.count += 1;
    group.totalMg += record.caffeineMg;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.totalMg - a.totalMg
    || b.count - a.count
    || a.name.localeCompare(b.name, "ja"));
}

/** 選択期間の記録を、UIに依存しない統計値へ集計する。 */
export function calculateStats(
  records: readonly IntakeRecord[], period: StatsPeriod, dailyLimitMg: number, now = new Date(),
): StatsResult {
  assertDate(now);
  assertLimit(dailyLimitMg);
  const range = getStatsRange(records, period, now);
  const eligible = eligibleRecords(records, now).filter((record) => {
    const at = new Date(record.consumedAt).getTime();
    return at >= range.start.getTime();
  });
  const dailyTotals = buildDailyTotals(eligible);
  const totalMg = eligible.reduce((sum, record) => sum + record.caffeineMg, 0);
  const trendGranularity: TrendGranularity = period === "month" ? "day" : "week";

  return {
    period,
    range,
    recordCount: eligible.length,
    totalMg,
    averageDailyMg: totalMg / range.dayCount,
    overLimitDays: [...dailyTotals.values()].filter((total) => total > dailyLimitMg).length,
    trendGranularity,
    trend: trendGranularity === "day"
      ? buildDailyTrend(range, dailyTotals)
      : buildWeeklyTrend(range, dailyTotals),
    drinks: buildDrinkBreakdown(eligible),
  };
}
