import type { IntakeRecord, Settings } from "../types";
import { isBedtime } from "./datetime";

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({ dailyLimitMg: 400, bedtime: "23:00" });
export const STORAGE_KEYS = Object.freeze({ records: "caffeine-log:records", settings: "caffeine-log:settings" });
const VERSION = 1;

type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export type StorageResult<T> = { ok: true; data: T } | { ok: false; error: "unavailable" | "invalid-data" | "read-failed" | "write-failed" };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isUtcDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

export function isIntakeRecord(value: unknown): value is IntakeRecord {
  return isObject(value) && typeof value.id === "string" && value.id.trim().length > 0
    && (value.presetId === null || (typeof value.presetId === "string" && value.presetId.trim().length > 0))
    && typeof value.name === "string" && value.name.trim().length > 0
    && isAmount(value.caffeineMg) && isUtcDate(value.consumedAt);
}

export function isSettings(value: unknown): value is Settings {
  return isObject(value) && isAmount(value.dailyLimitMg) && isBedtime(value.bedtime);
}

function isRecords(value: unknown): value is IntakeRecord[] {
  return Array.isArray(value) && value.every(isIntakeRecord)
    && new Set(value.map((record) => record.id)).size === value.length;
}

/** SSRやブラウザのストレージ拒否を、モジュール読み込み時に例外にしない。 */
function resolveStorage(storage?: StorageAccess | null): StorageAccess | null {
  if (storage !== undefined) return storage;
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

function read<T>(key: string, validate: (value: unknown) => value is T, fallback: T, storage?: StorageAccess | null): StorageResult<T> {
  const target = resolveStorage(storage);
  if (!target) return { ok: false, error: "unavailable" };
  let raw: string | null;
  try { raw = target.getItem(key); }
  catch { return { ok: false, error: "read-failed" }; }
  if (raw === null) return { ok: true, data: fallback };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== VERSION || !validate(parsed.data)) {
      return { ok: false, error: "invalid-data" };
    }
    return { ok: true, data: parsed.data };
  } catch { return { ok: false, error: "invalid-data" }; }
}

function write<T>(key: string, data: T, validate: (value: unknown) => value is T, storage?: StorageAccess | null): StorageResult<T> {
  if (!validate(data)) return { ok: false, error: "invalid-data" };
  const target = resolveStorage(storage);
  if (!target) return { ok: false, error: "unavailable" };
  try {
    target.setItem(key, JSON.stringify({ version: VERSION, data }));
    return { ok: true, data };
  } catch { return { ok: false, error: "write-failed" }; }
}

/** 未保存時のみ空配列。破損時はエラーを返し、元データを削除・上書きしない。 */
export function loadIntakeRecords(storage?: StorageAccess | null): StorageResult<IntakeRecord[]> {
  return read(STORAGE_KEYS.records, isRecords, [], storage);
}

/** 表示範囲にかかわらず全期間を保存する。 */
export function saveIntakeRecords(records: IntakeRecord[], storage?: StorageAccess | null): StorageResult<IntakeRecord[]> {
  return write(STORAGE_KEYS.records, records, isRecords, storage);
}

export function loadSettings(storage?: StorageAccess | null): StorageResult<Settings> {
  return read(STORAGE_KEYS.settings, isSettings, { ...DEFAULT_SETTINGS }, storage);
}

export function saveSettings(settings: Settings, storage?: StorageAccess | null): StorageResult<Settings> {
  return write(STORAGE_KEYS.settings, settings, isSettings, storage);
}
