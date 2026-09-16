import type { IntakeRecord, Settings } from "../types";
import { assertDate, getBedtime, isSameDay, startOfDay } from "./datetime";

export const HALF_LIFE_HOURS = 5;
const HOUR_MS = 60 * 60 * 1000;

function assertAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Invalid caffeine amount");
}

/** 指定時刻より後の記録は含めない。過去全期間の摂取を合算する。 */
export function calculateResidualMg(records: readonly IntakeRecord[], at: Date): number {
  assertDate(at);
  return records.reduce((total, record) => {
    assertAmount(record.caffeineMg);
    const consumedAt = new Date(record.consumedAt);
    assertDate(consumedAt);
    const elapsed = at.getTime() - consumedAt.getTime();
    return total + (elapsed < 0 ? 0 : record.caffeineMg * 0.5 ** (elapsed / HOUR_MS / HALF_LIFE_HOURS));
  }, 0);
}

export function getTodayRecords(records: readonly IntakeRecord[], now = new Date()): IntakeRecord[] {
  assertDate(now);
  return records.filter((record) => {
    const at = new Date(record.consumedAt);
    return isSameDay(at, now) && at.getTime() <= now.getTime();
  });
}

export function calculateTodayTotalMg(records: readonly IntakeRecord[], now = new Date()): number {
  return getTodayRecords(records, now).reduce((total, record) => {
    assertAmount(record.caffeineMg);
    return total + record.caffeineMg;
  }, 0);
}

export interface DrinkBreakdown {
  presetId: string | null;
  name: string;
  count: number;
  totalMg: number;
}

/** プリセットはID、手動入力は前後の空白を除いた名前で集計する。 */
export function getTodayBreakdown(records: readonly IntakeRecord[], now = new Date()): DrinkBreakdown[] {
  const groups = new Map<string, DrinkBreakdown>();
  for (const record of getTodayRecords(records, now)) {
    assertAmount(record.caffeineMg);
    const key = record.presetId === null ? `manual:${record.name.trim()}` : `preset:${record.presetId}`;
    const group = groups.get(key) ?? { presetId: record.presetId, name: record.name.trim(), count: 0, totalMg: 0 };
    group.count += 1;
    group.totalMg += record.caffeineMg;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export interface CurvePoint { at: string; residualMg: number }

/** 等間隔点と終端に加え、摂取直前・直後も含めて立ち上がりを保つ。 */
export function sampleResidualCurve(records: readonly IntakeRecord[], start: Date, end: Date, intervalMinutes = 5): CurvePoint[] {
  assertDate(start);
  assertDate(end);
  const step = intervalMinutes * 60_000;
  const from = start.getTime();
  const to = end.getTime();
  if (!Number.isFinite(step) || step < 1 || to < from || (to - from) / step > 100_000) {
    throw new RangeError("Invalid curve range or interval");
  }
  const times = new Set<number>([to]);
  for (let at = from; at <= to; at += step) times.add(at);
  for (const record of records) {
    const at = new Date(record.consumedAt).getTime();
    if (at >= from && at <= to) {
      times.add(at);
      if (at > from) times.add(at - 1);
    }
  }
  return [...times].sort((a, b) => a - b).map((at) => ({
    at: new Date(at).toISOString(), residualMg: calculateResidualMg(records, new Date(at)),
  }));
}

export function calculateBedtimeResidualMg(records: readonly IntakeRecord[], settings: Settings, now = new Date()): number {
  return calculateResidualMg(records, getBedtime(now, settings.bedtime));
}

/**
 * 今日の追加1杯の最終時刻。残量目標は医学的な安全閾値ではなく呼び出し側の目安。
 * 当日の既存記録（未来分も含む）で日上限を判定し、過去全期間で就寝時残量を算出。
 * 条件を満たす時刻が今日の現在以降にない場合は null。
 */
export function calculateLastCupTime(
  records: readonly IntakeRecord[], settings: Settings, cupMg: number,
  bedtimeTargetMg: number, now = new Date(),
): Date | null {
  assertAmount(cupMg);
  assertAmount(bedtimeTargetMg);
  assertAmount(settings.dailyLimitMg);
  const bedtime = getBedtime(now, settings.bedtime);
  if (now > bedtime) return null;
  const dayTotal = records.filter((record) => isSameDay(new Date(record.consumedAt), now))
    .reduce((sum, record) => { assertAmount(record.caffeineMg); return sum + record.caffeineMg; }, 0);
  if (dayTotal + cupMg > settings.dailyLimitMg) return null;
  const available = bedtimeTargetMg - calculateResidualMg(records, bedtime);
  if (available < 0 || (available === 0 && cupMg > 0)) return null;
  const hours = cupMg === 0 || cupMg <= available ? 0 : HALF_LIFE_HOURS * Math.log2(cupMg / available);
  const cutoff = new Date(Math.floor(bedtime.getTime() - hours * HOUR_MS));
  if (cutoff < now || cutoff < startOfDay(now)) return null;
  return cutoff;
}
