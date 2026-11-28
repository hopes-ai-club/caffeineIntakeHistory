import type { IntakeRecord } from "../types";
import { groupKey } from "./caffeine";
import { assertDate, isSameDay, startOfDay } from "./datetime";

export type HistoryPeriod = "week" | "month" | "custom";

export interface HistoryCustomRangeInput {
  startDate: string;
  endDate: string;
}

export interface HistoryRange {
  start: Date;
  end: Date;
}

export type HistoryRangeResult =
  | { ok: true; range: HistoryRange }
  | { ok: false; error: string };

export interface HistoryDayGroup {
  date: Date;
  isToday: boolean;
  totalMg: number;
  records: IntakeRecord[];
}

export interface HistoryDrinkBreakdown {
  key: string;
  name: string;
  count: number;
  totalMg: number;
}

const pad = (value: number) => String(value).padStart(2, "0");

function addLocalDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** date入力の値をUTCとして解釈せず、端末のローカル暦日へ厳密に変換する。 */
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day
    ? startOfDay(result)
    : null;
}

export function toDateInputValue(date: Date): string {
  assertDate(date);
  return localDayKey(date);
}

/** 表示期間をローカル日付境界で求める。1か月は今日を含む30日間。 */
export function getHistoryRange(
  period: HistoryPeriod,
  now = new Date(),
  custom?: HistoryCustomRangeInput,
): HistoryRangeResult {
  assertDate(now);
  const today = startOfDay(now);
  if (period === "week") return { ok: true, range: { start: addLocalDays(today, -6), end: new Date(now) } };
  if (period === "month") return { ok: true, range: { start: addLocalDays(today, -29), end: new Date(now) } };
  if (period !== "custom") throw new RangeError("Invalid history period");

  if (!custom?.startDate && !custom?.endDate) return { ok: false, error: "開始日と終了日を選択してください。" };
  if (!custom.startDate) return { ok: false, error: "開始日を選択してください。" };
  if (!custom.endDate) return { ok: false, error: "終了日を選択してください。" };
  const start = parseLocalDate(custom.startDate);
  const endDay = parseLocalDate(custom.endDate);
  if (!start || !endDay) return { ok: false, error: "有効な日付を選択してください。" };
  if (start.getTime() > endDay.getTime()) return { ok: false, error: "開始日は終了日以前にしてください。" };
  if (endDay.getTime() > today.getTime()) return { ok: false, error: "終了日は今日以前にしてください。" };

  const end = isSameDay(endDay, today)
    ? new Date(now)
    : new Date(addLocalDays(endDay, 1).getTime() - 1);
  return { ok: true, range: { start, end } };
}

/** 両端を含む期間内の記録だけを返す。入力配列の順序や内容は変更しない。 */
export function filterHistoryRecords(records: readonly IntakeRecord[], range: HistoryRange): IntakeRecord[] {
  assertDate(range.start);
  assertDate(range.end);
  if (range.start.getTime() > range.end.getTime()) throw new RangeError("Invalid history range");
  return records.filter((record) => {
    const consumedAt = new Date(record.consumedAt);
    assertDate(consumedAt);
    const at = consumedAt.getTime();
    return at >= range.start.getTime() && at <= range.end.getTime();
  });
}

/** 期間内の記録をローカル日付ごとにまとめ、日付・時刻とも新しい順にする。 */
export function buildHistoryDayGroups(
  records: readonly IntakeRecord[], now = new Date(),
): HistoryDayGroup[] {
  assertDate(now);
  const groups = new Map<string, HistoryDayGroup>();
  const sorted = [...records].sort((a, b) => Date.parse(b.consumedAt) - Date.parse(a.consumedAt));
  for (const record of sorted) {
    const consumedAt = new Date(record.consumedAt);
    assertDate(consumedAt);
    const date = startOfDay(consumedAt);
    const key = localDayKey(date);
    const group = groups.get(key) ?? {
      date,
      isToday: isSameDay(date, now),
      totalMg: 0,
      records: [],
    };
    group.totalMg += record.caffeineMg;
    group.records.push(record);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** 選択期間の飲み物を、摂取量・回数・名称の順で安定して並べる。 */
export function buildHistoryDrinkBreakdown(
  records: readonly IntakeRecord[],
): HistoryDrinkBreakdown[] {
  const groups = new Map<string, HistoryDrinkBreakdown>();
  for (const record of records) {
    const key = groupKey(record);
    const group = groups.get(key) ?? { key, name: record.name.trim(), count: 0, totalMg: 0 };
    group.count += 1;
    group.totalMg += record.caffeineMg;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.totalMg - a.totalMg
    || b.count - a.count
    || a.name.localeCompare(b.name, "ja"));
}
