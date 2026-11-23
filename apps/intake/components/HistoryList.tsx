"use client";

import { useState, type FormEvent } from "react";
import TabBar from "@/components/TabBar";
import { useIntakeRecords } from "@/hooks/useIntakeRecords";
import { useNow } from "@/hooks/useNow";
import { groupKey } from "@/lib/caffeine";
import { formatDateLabel, formatTime } from "@/lib/datetime";
import {
  buildHistoryDayGroups,
  buildHistoryDrinkBreakdown,
  filterHistoryRecords,
  getHistoryRange,
  toDateInputValue,
  type HistoryCustomRangeInput,
  type HistoryPeriod,
} from "@/lib/history";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const displayMg = (mg: number) => Math.round(mg).toLocaleString("ja-JP");
const formatShortDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
const GROUP_PAGE_SIZE = 30;
const PERIODS: ReadonlyArray<{ value: HistoryPeriod; label: string }> = [
  { value: "week", label: "1週間" },
  { value: "month", label: "1か月" },
  { value: "custom", label: "期間指定" },
];

/** 選択したローカル日付期間の個別記録を表示し、飲み物での絞り込みと確認付き削除を提供する。 */
export default function HistoryList() {
  const intake = useIntakeRecords();
  const now = useNow();
  const [period, setPeriod] = useState<HistoryPeriod>("week");
  const [customDraft, setCustomDraft] = useState<HistoryCustomRangeInput>({ startDate: "", endDate: "" });
  const [appliedCustom, setAppliedCustom] = useState<HistoryCustomRangeInput | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [visibleGroupCount, setVisibleGroupCount] = useState(GROUP_PAGE_SIZE);

  const loading = !now || intake.status === "loading";
  const broken = intake.status === "error";
  const ready = !loading && !broken;
  const rangeResult = ready
    ? getHistoryRange(period, now!, period === "custom" ? appliedCustom ?? undefined : undefined)
    : null;
  const range = rangeResult?.ok ? rangeResult.range : null;
  const rangeRecords = ready && range ? filterHistoryRecords(intake.records, range) : [];
  const dayGroups = ready ? buildHistoryDayGroups(rangeRecords, now!) : [];
  const drinkBreakdown = ready ? buildHistoryDrinkBreakdown(rangeRecords) : [];
  const filteredGroups = filterKey
    ? dayGroups
        .map((group) => ({ ...group, records: group.records.filter((record) => groupKey(record) === filterKey) }))
        .filter((group) => group.records.length > 0)
    : dayGroups;
  const visibleGroups = filteredGroups.slice(0, visibleGroupCount);
  const hasMore = visibleGroups.length < filteredGroups.length;

  function resetTransientState() {
    setVisibleGroupCount(GROUP_PAGE_SIZE);
    setPendingDeleteId(null);
    setDeleteError(null);
  }

  function selectPeriod(next: HistoryPeriod) {
    setPeriod(next);
    setCustomError(null);
    resetTransientState();
    if (next === "custom" && now && !appliedCustom) {
      const week = getHistoryRange("week", now);
      if (week.ok) {
        const initial = {
          startDate: toDateInputValue(week.range.start),
          endDate: toDateInputValue(now),
        };
        setCustomDraft(initial);
        setAppliedCustom(initial);
      }
    }
  }

  function applyCustomRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!now) return;
    const result = getHistoryRange("custom", now, customDraft);
    if (!result.ok) {
      setCustomError(result.error);
      return;
    }
    setAppliedCustom(customDraft);
    setCustomError(null);
    resetTransientState();
  }

  function toggleFilter(key: string, active: boolean) {
    setFilterKey(active ? null : key);
    resetTransientState();
  }

  function toggleEditMode() {
    setEditMode((prev) => !prev);
    setPendingDeleteId(null);
    setDeleteError(null);
  }

  function requestDelete(id: string) {
    setPendingDeleteId(id);
    setDeleteError(null);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
    setDeleteError(null);
  }

  function confirmDelete(id: string) {
    if (intake.removeRecord(id)) {
      setPendingDeleteId(null);
      setDeleteError(null);
    } else {
      setDeleteError("削除できませんでした。もう一度お試しください。");
    }
  }

  const periodLabel = period === "week" ? "直近1週間" : period === "month" ? "直近1か月" : "指定期間";
  const todayInput = now ? toDateInputValue(now) : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col bg-bg-base px-space-20 pt-[max(60px,env(safe-area-inset-top))] min-[600px]:max-w-[420px]">
      <header className="mb-space-16 flex items-baseline justify-between">
        <h1 className="text-size-26 font-semibold tracking-[-0.01em]">履歴</h1>
        {ready && dayGroups.length > 0 && (
          <button type="button" onClick={toggleEditMode} className={`rounded-radius-5 py-space-5 text-size-14 text-accent ${focus}`}>
            {editMode ? "完了" : "編集"}
          </button>
        )}
      </header>

      <div aria-label="履歴の表示期間" className="mb-space-14 grid grid-cols-3 gap-space-4 rounded-radius-14 bg-surface-row p-space-4">
        {PERIODS.map((item) => {
          const active = period === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              onClick={() => selectPeriod(item.value)}
              className={`rounded-radius-10 px-space-6 py-space-10 text-size-13 transition-colors motion-reduce:transition-none ${focus} ${active ? "bg-surface-selected text-text-primary" : "text-text-tertiary"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {period === "custom" && (
        <form onSubmit={applyCustomRange} className="mb-space-16 rounded-radius-16 border border-border-subtle bg-surface-card p-space-14">
          <div className="grid grid-cols-2 gap-space-10">
            <label className="min-w-0 text-size-12 text-text-secondary">
              開始日
              <input
                type="date"
                value={customDraft.startDate}
                max={todayInput}
                onChange={(event) => setCustomDraft((current) => ({ ...current, startDate: event.target.value }))}
                className={`mt-space-6 block w-full min-w-0 rounded-radius-10 border border-border-strong bg-surface-row px-space-8 py-space-10 font-mono text-size-12 text-text-primary ${focus}`}
              />
            </label>
            <label className="min-w-0 text-size-12 text-text-secondary">
              終了日
              <input
                type="date"
                value={customDraft.endDate}
                max={todayInput}
                onChange={(event) => setCustomDraft((current) => ({ ...current, endDate: event.target.value }))}
                className={`mt-space-6 block w-full min-w-0 rounded-radius-10 border border-border-strong bg-surface-row px-space-8 py-space-10 font-mono text-size-12 text-text-primary ${focus}`}
              />
            </label>
          </div>
          {customError && <p role="alert" className="mt-space-10 text-size-12 leading-[1.45] text-danger">{customError}</p>}
          <button type="submit" disabled={!ready} className={`mt-space-12 w-full rounded-radius-99 bg-accent px-space-14 py-space-10 text-size-13 font-semibold text-bg-base disabled:opacity-50 ${focus}`}>
            この期間を表示
          </button>
        </form>
      )}

      {ready && range && (
        <p aria-live="polite" className="mb-space-20 font-mono text-size-12 tracking-[0.04em] text-text-tertiary">
          {periodLabel} · {formatShortDate(range.start)} — {formatShortDate(range.end)}
        </p>
      )}

      {broken ? (
        <p role="alert" className="rounded-radius-18 border border-danger bg-surface-card p-space-16 text-size-14">
          記録を読み込めませんでした。データを確認できないため、削除を停止しています。再読み込みしてお試しください。
        </p>
      ) : loading ? (
        <p role="status" className="text-size-14 text-text-secondary">読み込み中…</p>
      ) : (
        <>
          <section aria-labelledby="drink-filter" className="mb-space-22">
            <h2 id="drink-filter" className="mb-space-10 text-size-15 font-medium">飲み物で絞り込む</h2>
            {drinkBreakdown.length === 0 ? (
              <p className="text-size-13 text-text-tertiary">この期間に記録がないため、絞り込みは利用できません。</p>
            ) : (
              <div className="flex flex-wrap gap-space-8">
                {drinkBreakdown.map((item) => {
                  const active = filterKey === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleFilter(item.key, active)}
                      className={`max-w-full rounded-radius-99 border px-space-14 py-[11px] text-left text-size-14 ${focus} ${active ? "border-accent bg-accent-soft" : "border-text-primary/[0.09] bg-surface-chip"}`}
                    >
                      <span className="break-words">{item.name}</span>{" "}
                      <span className={`inline-block font-mono ${active ? "text-accent" : "text-text-tertiary"}`}>{item.count}回・{displayMg(item.totalMg)}mg</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {filterKey && (
            <p className="mb-space-14 flex items-center justify-between text-size-13 text-text-tertiary">
              <span>飲み物で絞り込み中</span>
              <button type="button" onClick={() => toggleFilter(filterKey, true)} className={`rounded-radius-5 text-accent ${focus}`}>解除</button>
            </p>
          )}

          {filteredGroups.length === 0 ? (
            <p className="rounded-radius-16 bg-surface-row px-space-16 py-space-14 text-size-14 text-text-secondary">
              {filterKey ? "この条件に一致する記録はありません。" : "この期間の記録はまだありません。"}
            </p>
          ) : (
            <div className="flex flex-col gap-space-22">
              {visibleGroups.map((group) => (
                <div key={group.date.toISOString()} className="[content-visibility:auto] [contain-intrinsic-size:auto_120px]">
                  <div className="mb-space-8 flex items-baseline justify-between px-space-4">
                    <span className={`text-size-14 font-medium ${group.isToday ? "text-text-primary" : "text-text-secondary"}`}>
                      {group.isToday ? "今日 · " : ""}{formatDateLabel(group.date)}
                    </span>
                    <span className="font-mono text-size-13 text-text-tertiary">{displayMg(group.totalMg)} mg</span>
                  </div>
                  <ul className="flex flex-col gap-px overflow-hidden rounded-radius-16 bg-border-subtle">
                    {group.records.map((record) => (
                      <li key={record.id} className="bg-surface-row">
                        {pendingDeleteId === record.id ? (
                          <div className="flex items-center justify-between gap-space-10 px-space-16 py-space-14">
                            <p className="min-w-0 flex-1 text-size-13 text-text-secondary">
                              本当に削除しますか？
                              {deleteError && <span className="mt-space-4 block text-danger">{deleteError}</span>}
                            </p>
                            <div className="flex shrink-0 items-center gap-space-8">
                              <button type="button" onClick={cancelDelete} className={`rounded-radius-5 py-space-5 text-size-13 text-text-tertiary ${focus}`}>やめる</button>
                              <button type="button" onClick={() => confirmDelete(record.id)} className={`rounded-radius-99 bg-danger px-space-14 py-space-6 text-size-13 font-semibold text-bg-base ${focus}`}>削除する</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-space-14 px-space-16 py-space-14">
                            <time dateTime={record.consumedAt} className="w-[42px] shrink-0 font-mono text-size-13 text-text-tertiary">{formatTime(new Date(record.consumedAt))}</time>
                            <span className="min-w-0 flex-1 break-words text-size-15">{record.name}</span>
                            <span className="max-w-[40%] break-all text-right font-mono text-size-15">{displayMg(record.caffeineMg)}<span className="text-size-11 text-text-tertiary"> mg</span></span>
                            {editMode && (
                              <button type="button" onClick={() => requestDelete(record.id)} aria-label={`${formatTime(new Date(record.consumedAt))}の${record.name}を削除`}
                                className={`shrink-0 rounded-radius-99 bg-danger px-space-12 py-space-6 text-size-12 font-semibold text-bg-base ${focus}`}>削除</button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {hasMore && (
                <button type="button" onClick={() => setVisibleGroupCount((count) => count + GROUP_PAGE_SIZE)} className={`self-center rounded-radius-99 border border-border-strong px-space-16 py-space-10 text-size-13 text-accent ${focus}`}>
                  続きを表示（残り{filteredGroups.length - visibleGroups.length}日）
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-auto pt-space-20">
        <div className="mb-space-20 flex gap-space-12 rounded-radius-18 border border-border-subtle bg-surface-row p-space-16">
          <span aria-hidden="true" className="mt-space-6 size-space-8 shrink-0 rounded-radius-99 bg-text-quaternary" />
          <p className="text-size-13 leading-[1.55] text-text-secondary">記録は端末内に全期間保存されています。表示期間を切り替えて、以前の記録も確認・削除できます。</p>
        </div>
        <TabBar />
      </div>
    </main>
  );
}
