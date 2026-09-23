"use client";

import { useState } from "react";
import TabBar from "@/components/TabBar";
import { useIntakeRecords } from "@/hooks/useIntakeRecords";
import { useNow } from "@/hooks/useNow";
import { getTodayBreakdown, groupKey } from "@/lib/caffeine";
import { formatDateLabel, formatTime, isSameDay, startOfDay } from "@/lib/datetime";
import type { IntakeRecord } from "@/types";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const displayMg = (mg: number) => Math.round(mg).toLocaleString("ja-JP");
const formatShortDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
/** 履歴の表示範囲。データ自体は全期間保持し、表示のみ直近1週間（今日を含む）に絞る。 */
const HISTORY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DayGroup {
  date: Date;
  isToday: boolean;
  totalMg: number;
  records: IntakeRecord[];
}

/** 表示範囲内で記録がある日だけを、新しい順（今日→過去）に並べる。 */
function buildDayGroups(records: readonly IntakeRecord[], now: Date): DayGroup[] {
  const todayStart = startOfDay(now);
  const groups: DayGroup[] = [];
  for (let offset = 0; offset < HISTORY_DAYS; offset += 1) {
    const date = new Date(todayStart.getTime() - offset * DAY_MS);
    const dayRecords = records
      .filter((record) => isSameDay(new Date(record.consumedAt), date))
      .sort((a, b) => Date.parse(b.consumedAt) - Date.parse(a.consumedAt));
    if (dayRecords.length === 0) continue;
    const totalMg = dayRecords.reduce((sum, record) => sum + record.caffeineMg, 0);
    groups.push({ date, isToday: offset === 0, totalMg, records: dayRecords });
  }
  return groups;
}

/**
 * 直近1週間（今日を含む）の摂取履歴。今日の飲み物別内訳の行をタップすると、その飲み物で一覧を絞り込む。
 * 削除は「編集」モードでの行ごとの削除操作＋確認ステップを経てから確定する。
 */
export default function HistoryList() {
  const intake = useIntakeRecords();
  const now = useNow();
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loading = !now || intake.status === "loading";
  const broken = intake.status === "error";
  const ready = !loading && !broken;

  const visibleRecords = ready
    ? intake.records.filter((record) => new Date(record.consumedAt).getTime() <= now!.getTime())
    : [];
  const dayGroups = ready ? buildDayGroups(visibleRecords, now!) : [];
  const filteredGroups = filterKey
    ? dayGroups
        .map((group) => ({ ...group, records: group.records.filter((record) => groupKey(record) === filterKey) }))
        .filter((group) => group.records.length > 0)
    : dayGroups;
  const todayBreakdown = ready ? getTodayBreakdown(intake.records, now!) : [];
  const rangeStart = ready ? new Date(startOfDay(now!).getTime() - (HISTORY_DAYS - 1) * DAY_MS) : null;

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

  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col bg-bg-base px-space-20 pt-[max(60px,env(safe-area-inset-top))] min-[600px]:max-w-[420px]">
      <header className="mb-space-5 flex items-baseline justify-between">
        <h1 className="text-size-26 font-semibold tracking-[-0.01em]">履歴</h1>
        {ready && dayGroups.length > 0 && (
          <button type="button" onClick={toggleEditMode} className={`rounded-radius-5 py-space-5 text-size-14 text-accent ${focus}`}>
            {editMode ? "完了" : "編集"}
          </button>
        )}
      </header>
      {ready && rangeStart && (
        <p className="mb-space-24 font-mono text-size-12 tracking-[0.04em] text-text-tertiary">
          直近1週間 · {formatShortDate(rangeStart)} — {formatShortDate(now!)}
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
          <section aria-labelledby="today-breakdown" className="mb-space-22">
            <h2 id="today-breakdown" className="mb-space-10 text-size-15 font-medium">今日の内訳</h2>
            {todayBreakdown.length === 0 ? (
              <p className="text-size-13 text-text-tertiary">今日の記録がまだないため、内訳からの絞り込みは利用できません。</p>
            ) : (
              <div className="flex flex-wrap gap-space-8">
                {todayBreakdown.map((item) => {
                  const key = groupKey({ presetId: item.presetId, name: item.name });
                  const active = filterKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilterKey(active ? null : key)}
                      className={`max-w-full rounded-radius-99 border px-space-14 py-[11px] text-left text-size-14 ${focus} ${active ? "border-accent bg-accent-soft" : "border-text-primary/[0.09] bg-surface-chip"}`}
                    >
                      <span className="break-words">{item.name}</span>{" "}
                      <span className={`inline-block font-mono ${active ? "text-accent" : "text-text-tertiary"}`}>{item.count}杯・{displayMg(item.totalMg)}mg</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {filterKey && (
            <p className="mb-space-14 flex items-center justify-between text-size-13 text-text-tertiary">
              <span>絞り込み中</span>
              <button type="button" onClick={() => setFilterKey(null)} className={`rounded-radius-5 text-accent ${focus}`}>解除</button>
            </p>
          )}

          {filteredGroups.length === 0 ? (
            <p className="rounded-radius-16 bg-surface-row px-space-16 py-space-14 text-size-14 text-text-secondary">
              {filterKey ? "この条件に一致する記録はありません。" : "直近1週間の記録はまだありません。"}
            </p>
          ) : (
            <div className="flex flex-col gap-space-22">
              {filteredGroups.map((group) => (
                <div key={group.date.toISOString()}>
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
            </div>
          )}
        </>
      )}

      <div className="mt-auto pt-space-20">
        <div className="mb-space-20 flex gap-space-12 rounded-radius-18 border border-border-subtle bg-surface-row p-space-16">
          <span aria-hidden="true" className="mt-space-6 size-space-8 shrink-0 rounded-radius-99 bg-text-quaternary" />
          <p className="text-size-13 leading-[1.55] text-text-secondary">1週間より前の記録も端末内に保存されています。表示だけを直近1週間に絞っています。</p>
        </div>
        <TabBar />
      </div>
    </main>
  );
}
