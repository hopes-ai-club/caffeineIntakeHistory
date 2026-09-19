"use client";

import { useEffect, useState } from "react";
import { PRESETS } from "@/data/presets";
import { useIntakeRecords } from "@/hooks/useIntakeRecords";
import { useSettings } from "@/hooks/useSettings";
import { useNow } from "@/hooks/useNow";
import { calculateTodayTotalMg } from "@/lib/caffeine";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/datetime";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const displayMg = (mg: number) => Math.round(mg).toLocaleString("ja-JP");
/** プリセットを使わない手動入力の飲料名。手動入力どうしは同じ名前でまとめる集計仕様に合わせた固定名。 */
const MANUAL_ENTRY_NAME = "手動入力";
const SAVE_FAILED_MESSAGE = "保存できませんでした。入力内容は保持しています。もう一度お試しください。";

export interface IntakeFormProps {
  /** シートの開閉状態。閉じている間は非表示・非操作にする。 */
  open: boolean;
  /** 閉じる操作（背景タップ・「閉じる」・Esc・保存成功）を呼び出し側へ通知する。 */
  onClose: () => void;
}

/** 数値化できて0より大きい入力かどうか。 */
function isPositiveAmount(input: string): boolean {
  const value = Number(input);
  return input.trim() !== "" && Number.isFinite(value) && value > 0;
}

/**
 * 1杯を記録するボトムシート。プリセット選択または手動入力・時刻を指定し、`useIntakeRecords` へ保存する。
 * 保存に失敗した場合は入力内容を保持したままエラーを表示し、シートは閉じない。
 */
export default function IntakeForm({ open, onClose }: IntakeFormProps) {
  const intake = useIntakeRecords();
  const preferences = useSettings();
  const liveNow = useNow();

  const [prevOpen, setPrevOpen] = useState(open);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [manualConsumedAt, setManualConsumedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 開いた瞬間に前回の入力を持ち越さないよう、propの変化に合わせて描画中に下書きをリセットする（Effectは使わない）。
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedPresetId(null);
      setAmountInput("");
      setManualConsumedAt(null);
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  const broken = intake.status === "error" || preferences.status === "error";
  const consumedAt = manualConsumedAt ?? liveNow ?? new Date();
  const validAmount = isPositiveAmount(amountInput);
  const limit = preferences.settings.dailyLimitMg;
  const todayTotal = calculateTodayTotalMg(intake.records, liveNow ?? new Date());
  const previewTotal = todayTotal + (validAmount ? Number(amountInput) : 0);
  const overLimit = previewTotal > limit;

  function selectPreset(id: string, caffeineMg: number) {
    setSelectedPresetId(id);
    setAmountInput(String(caffeineMg));
    setError(null);
  }

  function editAmount(value: string) {
    setSelectedPresetId(null);
    setAmountInput(value);
    setError(null);
  }

  function handleSubmit() {
    if (broken || !validAmount) return;
    const name = selectedPresetId ? PRESETS.find((preset) => preset.id === selectedPresetId)?.name ?? MANUAL_ENTRY_NAME : MANUAL_ENTRY_NAME;
    try {
      const saved = intake.addRecord({
        presetId: selectedPresetId,
        name,
        caffeineMg: Number(amountInput),
        consumedAt: consumedAt.toISOString(),
      });
      if (!saved) {
        setError(SAVE_FAILED_MESSAGE);
        return;
      }
      onClose();
    } catch {
      setError(SAVE_FAILED_MESSAGE);
    }
  }

  return (
    <div
      role="presentation"
      aria-hidden={!open}
      inert={!open}
      onClick={onClose}
      className={`fixed inset-0 z-50 flex flex-col justify-end bg-bg-overlay transition-opacity duration-[240ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-form-title"
        onClick={(event) => event.stopPropagation()}
        className={`mx-auto flex max-h-[90dvh] w-full flex-col rounded-t-radius-30 border-t border-[rgba(244,238,229,0.09)] bg-bg-base px-space-20 pt-space-22 pb-[max(34px,env(safe-area-inset-bottom))] transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] min-[600px]:max-w-[420px] ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <span aria-hidden="true" className="mb-space-20 h-space-4 w-11 shrink-0 self-center rounded-radius-99 bg-border-strong" />
        <div className="mb-space-20 flex shrink-0 items-baseline justify-between">
          <h2 id="intake-form-title" className="text-size-22 font-semibold">1杯を記録</h2>
          <button type="button" onClick={onClose} className={`rounded-radius-5 py-space-5 text-size-15 text-text-tertiary ${focus}`}>閉じる</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {broken && (
            <p role="alert" className="mb-space-16 rounded-radius-16 border border-danger bg-surface-card p-space-16 text-size-14">
              記録または設定を読み込めませんでした。データを確認できないため、追加を停止しています。
            </p>
          )}
          <div className="mb-space-22 grid grid-cols-3 gap-space-10">
            {PRESETS.map((preset) => {
              const selected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={broken}
                  onClick={() => selectPreset(preset.id, preset.caffeineMg)}
                  className={`flex flex-col gap-space-6 rounded-radius-18 px-[12px] py-space-14 text-left disabled:opacity-50 ${focus} ${selected ? "border-[1.5px] border-accent bg-accent-soft" : "border border-border-subtle bg-surface-card"}`}
                >
                  <span className="break-words text-size-14 font-medium">{preset.name}</span>
                  <span className={`font-mono text-size-12 ${selected ? "text-accent" : "text-text-tertiary"}`}>{displayMg(preset.caffeineMg)}mg</span>
                </button>
              );
            })}
          </div>

          <div className="mb-space-22 flex items-center justify-between gap-space-10 rounded-radius-16 border border-dashed border-border-strong bg-surface-row px-space-16 py-space-14">
            <label htmlFor="intake-manual-amount" className="text-size-14 text-text-secondary">プリセットを使わず手動で入力</label>
            <div className="flex items-baseline gap-space-4">
              <input
                id="intake-manual-amount"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                disabled={broken}
                value={amountInput}
                onChange={(event) => editAmount(event.target.value)}
                className={`w-[4.5em] border-b-[1.5px] border-accent bg-transparent px-space-8 pb-space-4 text-right font-mono text-size-17 text-text-primary disabled:opacity-50 ${focus}`}
              />
              <span className="font-mono text-size-13 text-text-tertiary">mg</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-subtle py-space-16">
            <span className="text-size-15 text-text-secondary">飲んだ時刻</span>
            <div className="flex items-center gap-space-10">
              <input
                type="datetime-local"
                aria-label="摂取時刻"
                disabled={broken}
                value={toDatetimeLocal(consumedAt)}
                onChange={(event) => {
                  const iso = fromDatetimeLocal(event.target.value);
                  if (iso) setManualConsumedAt(new Date(iso));
                }}
                className={`bg-transparent font-mono text-size-16 text-text-primary disabled:opacity-50 ${focus}`}
              />
              <button
                type="button"
                disabled={broken}
                onClick={() => setManualConsumedAt(null)}
                className={`rounded-radius-99 bg-accent-soft px-space-14 py-space-6 text-size-13 text-accent disabled:opacity-50 ${focus}`}
              >いま</button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-subtle py-space-16">
            <span className="text-size-15 text-text-secondary">この1杯で</span>
            <p className="text-size-15 text-text-primary">
              今日 <span className={`font-mono ${overLimit ? "text-danger" : ""}`}>{displayMg(previewTotal)}</span> / {displayMg(limit)} mg
            </p>
          </div>

          {error && <p role="alert" className="mt-space-14 text-size-14 text-danger">{error}</p>}
        </div>

        <button
          type="button"
          disabled={broken || !validAmount}
          onClick={handleSubmit}
          className={`mt-space-16 w-full shrink-0 rounded-radius-18 bg-accent p-[18px] text-center text-size-17 font-semibold text-bg-base disabled:opacity-50 ${focus}`}
        >記録する</button>
      </div>
    </div>
  );
}
