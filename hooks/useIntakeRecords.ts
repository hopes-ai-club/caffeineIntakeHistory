"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { IntakeRecord } from "../types";
import { loadIntakeRecords, saveIntakeRecords, type StorageResult } from "../lib/storage";

type StorageError = Extract<StorageResult<IntakeRecord[]>, { ok: false }>["error"];
type Status = "loading" | "ready" | "error";

interface RecordsSnapshot {
  records: IntakeRecord[];
  status: Status;
  error: StorageError | null;
}

const SERVER_SNAPSHOT: RecordsSnapshot = Object.freeze({ records: [], status: "loading", error: null });

let snapshot: RecordsSnapshot = SERVER_SNAPSHOT;
let initialized = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** localStorageの読み込みはクライアントでの初回参照時に一度だけ行う。 */
function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  const result = loadIntakeRecords();
  snapshot = result.ok
    ? { records: result.data, status: "ready", error: null }
    : { records: [], status: "error", error: result.error };
}

function subscribe(callback: () => void): () => void {
  ensureInitialized();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): RecordsSnapshot {
  ensureInitialized();
  return snapshot;
}

function getServerSnapshot(): RecordsSnapshot {
  return SERVER_SNAPSHOT;
}

/** 保存に成功した場合のみ反映する。失敗時は直前の記録をメモリ上に残したままエラーを通知する（破損データの自動上書きはしない）。 */
function write(next: IntakeRecord[]): boolean {
  const result = saveIntakeRecords(next);
  snapshot = result.ok
    ? { records: result.data, status: "ready", error: null }
    : { ...snapshot, status: "error", error: result.error };
  notify();
  return result.ok;
}

export interface NewIntakeRecordInput {
  /** 手動入力の場合は null。 */
  presetId: string | null;
  name: string;
  caffeineMg: number;
  /** UTCのISO 8601文字列（ミリ秒付き）。 */
  consumedAt: string;
}

export interface UseIntakeRecordsResult extends RecordsSnapshot {
  /** 保存に成功すれば追加された記録を、失敗すれば null を返す。 */
  addRecord: (input: NewIntakeRecordInput) => IntakeRecord | null;
  /** 対象IDが存在し保存にも成功すれば true を返す。 */
  removeRecord: (id: string) => boolean;
}

/**
 * カフェイン摂取記録を管理し、localStorageへ永続化するフック。表示範囲の絞り込みは呼び出し側の責務とし、常に全期間を保持する。
 * 読み込みに失敗した場合は空配列をメモリ上で使いつつ status を "error" にし、保存済みの破損データ自体は上書きしない。
 */
export function useIntakeRecords(): UseIntakeRecordsResult {
  const { records, status, error } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addRecord = useCallback((input: NewIntakeRecordInput): IntakeRecord | null => {
    const record: IntakeRecord = {
      id: crypto.randomUUID(),
      presetId: input.presetId,
      name: input.name.trim(),
      caffeineMg: input.caffeineMg,
      consumedAt: input.consumedAt,
    };
    return write([...snapshot.records, record]) ? record : null;
  }, []);

  const removeRecord = useCallback((id: string): boolean => {
    const next = snapshot.records.filter((record) => record.id !== id);
    if (next.length === snapshot.records.length) return false;
    return write(next);
  }, []);

  return { records, status, error, addRecord, removeRecord };
}
