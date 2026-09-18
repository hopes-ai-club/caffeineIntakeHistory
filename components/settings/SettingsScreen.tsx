"use client";

import { useState } from "react";
import TabBar from "@/components/TabBar";
import { useSettings } from "@/hooks/useSettings";
import { HALF_LIFE_HOURS } from "@/lib/caffeine";
import { isBedtime } from "@/lib/datetime";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const SAVE_FAILED_MESSAGE = "保存できませんでした。もう一度お試しください。";

/** 1日の摂取上限値・就寝時刻を編集し、半減期モデル（固定・読み取り専用）を確認できる設定画面。 */
export default function SettingsScreen() {
  const preferences = useSettings();
  const broken = preferences.status === "error";

  const [prevLimit, setPrevLimit] = useState(preferences.settings.dailyLimitMg);
  const [limitDraft, setLimitDraft] = useState(String(preferences.settings.dailyLimitMg));
  const [limitError, setLimitError] = useState<string | null>(null);
  const [bedtimeError, setBedtimeError] = useState<string | null>(null);

  // 永続化された値が変わった（初回読み込み・保存成功）ときだけ下書きを同期する（Effectは使わない）。
  if (preferences.settings.dailyLimitMg !== prevLimit) {
    setPrevLimit(preferences.settings.dailyLimitMg);
    setLimitDraft(String(preferences.settings.dailyLimitMg));
    setLimitError(null);
  }

  function commitLimit() {
    const value = Number(limitDraft);
    if (!Number.isFinite(value) || value <= 0) {
      setLimitError("1以上の数値を入力してください。");
      return;
    }
    const ok = preferences.updateSettings({ dailyLimitMg: value });
    setLimitError(ok ? null : SAVE_FAILED_MESSAGE);
  }

  function handleBedtimeChange(value: string) {
    if (!isBedtime(value)) return;
    const ok = preferences.updateSettings({ bedtime: value });
    setBedtimeError(ok ? null : SAVE_FAILED_MESSAGE);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col bg-bg-base px-space-20 pt-[max(60px,env(safe-area-inset-top))] min-[600px]:max-w-[420px]">
      <header className="mb-space-22">
        <h1 className="text-size-26 font-semibold tracking-[-0.01em]">設定</h1>
      </header>

      {broken && (
        <p role="alert" className="mb-space-16 rounded-radius-16 border border-danger bg-surface-card p-space-16 text-size-14">
          設定を読み込めませんでした。既定値を表示しています。保存はできません。
        </p>
      )}

      <div className="overflow-hidden rounded-radius-22 border border-border-subtle bg-surface-card">
        <div className="flex items-center justify-between gap-space-10 px-space-16 py-space-16">
          <label htmlFor="settings-bedtime" className="text-size-15 text-text-secondary">就寝時刻</label>
          <input
            id="settings-bedtime"
            type="time"
            disabled={broken}
            value={preferences.settings.bedtime}
            onChange={(event) => handleBedtimeChange(event.target.value)}
            className={`bg-transparent text-right font-mono text-size-16 text-text-primary disabled:opacity-50 ${focus}`}
          />
        </div>

        <div className="flex items-center justify-between gap-space-10 border-t border-border-subtle px-space-16 py-space-16">
          <span className="text-size-15 text-text-secondary">半減期モデル</span>
          <span className="font-mono text-size-16 text-text-quaternary">固定 {HALF_LIFE_HOURS.toFixed(1)}h</span>
        </div>

        <div className="flex items-center justify-between gap-space-10 border-t border-border-subtle px-space-16 py-space-16">
          <label htmlFor="settings-daily-limit" className="text-size-15 text-text-secondary">1日の摂取上限</label>
          <div className="flex items-baseline gap-space-4">
            <input
              id="settings-daily-limit"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              disabled={broken}
              value={limitDraft}
              onChange={(event) => { setLimitDraft(event.target.value); setLimitError(null); }}
              onBlur={commitLimit}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              className={`w-[4.5em] border-b-[1.5px] border-accent bg-transparent text-right font-mono text-size-17 text-text-primary disabled:opacity-50 ${focus}`}
            />
            <span className="font-mono text-size-13 text-text-tertiary">mg</span>
          </div>
        </div>
      </div>
      <p className="mt-space-10 text-size-12 text-text-quaternary">半減期モデルは要件どおりの固定値のため変更できません。</p>
      {limitError && <p role="alert" className="mt-space-10 text-size-14 text-danger">{limitError}</p>}
      {bedtimeError && <p role="alert" className="mt-space-10 text-size-14 text-danger">{bedtimeError}</p>}

      <div className="mt-auto pt-space-14">
        <TabBar />
      </div>
    </main>
  );
}
