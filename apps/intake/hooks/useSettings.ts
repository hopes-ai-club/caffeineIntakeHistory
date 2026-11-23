"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type StorageResult } from "../lib/storage";

type StorageError = Extract<StorageResult<Settings>, { ok: false }>["error"];
type Status = "loading" | "ready" | "error";

interface SettingsSnapshot {
  settings: Settings;
  status: Status;
  error: StorageError | null;
}

const SERVER_SNAPSHOT: SettingsSnapshot = Object.freeze({ settings: DEFAULT_SETTINGS, status: "loading", error: null });

let snapshot: SettingsSnapshot = SERVER_SNAPSHOT;
let initialized = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** localStorageの読み込みはクライアントでの初回参照時に一度だけ行う。 */
function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  const result = loadSettings();
  snapshot = result.ok
    ? { settings: result.data, status: "ready", error: null }
    : { settings: DEFAULT_SETTINGS, status: "error", error: result.error };
}

function subscribe(callback: () => void): () => void {
  ensureInitialized();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): SettingsSnapshot {
  ensureInitialized();
  return snapshot;
}

function getServerSnapshot(): SettingsSnapshot {
  return SERVER_SNAPSHOT;
}

/** 保存に成功した場合のみ反映する。失敗時は直前の設定をメモリ上に残したままエラーを通知する（破損データの自動上書きはしない）。 */
function write(next: Settings): boolean {
  const result = saveSettings(next);
  snapshot = result.ok
    ? { settings: result.data, status: "ready", error: null }
    : { ...snapshot, status: "error", error: result.error };
  notify();
  return result.ok;
}

export interface UseSettingsResult extends SettingsSnapshot {
  /** 変更したいフィールドだけを渡す。保存に成功したかどうかを返す。 */
  updateSettings: (updates: Partial<Settings>) => boolean;
}

/**
 * 1日の摂取上限値・就寝時刻を管理し、localStorageへ永続化するフック。
 * 読み込みに失敗した場合は既定値をメモリ上で使いつつ status を "error" にし、保存済みの破損データ自体は上書きしない。
 */
export function useSettings(): UseSettingsResult {
  const { settings, status, error } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateSettings = useCallback((updates: Partial<Settings>): boolean => {
    return write({ ...snapshot.settings, ...updates });
  }, []);

  return { settings, status, error, updateSettings };
}
