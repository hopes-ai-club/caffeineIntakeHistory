"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import IntakeForm from "@/components/IntakeForm";
import TabBar from "@/components/TabBar";
import { useIntakeRecords } from "@/hooks/useIntakeRecords";
import { useSettings } from "@/hooks/useSettings";
import { useNow } from "@/hooks/useNow";
import { calculateLastCupTime, calculateTodayTotalMg, getTodayRecords, getQuickAddCandidates, type QuickAddCandidate } from "@/lib/caffeine";
import { formatDateLabel, formatTime } from "@/lib/datetime";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const displayMg = (mg: number) => Math.round(mg).toLocaleString("ja-JP");
const CUTOFF_CUP_MG = 90;
const CUTOFF_TARGET_MG = 50;

export default function HomeScreen() {
  const intake = useIntakeRecords();
  const preferences = useSettings();
  const clock = useNow();
  const [addedAt, setAddedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    // キャンセルでも実時刻を更新し、未来の摂取日時を集計時刻に使わない。
    setAddedAt(new Date());
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const wrapper = formRef.current;
    if (!wrapper) return;
    const fab = fabRef.current;
    const heading = headingRef.current;
    // フォームの階層やIDではなく、操作可能な要素だけを参照する。
    const controls = () => Array.from(wrapper.querySelectorAll<HTMLElement>(
      "button, input, select, textarea, a[href], [tabindex]",
    )).filter(element => element.tabIndex >= 0
      && !element.matches(":disabled") && !element.closest("[inert]")
      && element.getClientRects().length > 0);
    const focusFirst = () => controls()[0]?.focus({ preventScroll: true });
    focusFirst();

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) return;
      if (!items.includes(document.activeElement as HTMLElement)) {
        // 保存失敗で操作中の入力がdisabledになった場合もシート内に戻す。
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function keepFocusInside(event: FocusEvent) {
      if (!wrapper?.contains(event.target as Node)) focusFirst();
    }
    document.addEventListener("keydown", trapFocus);
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.removeEventListener("focusin", keepFocusInside);
      (fab && !fab.disabled ? fab : heading)?.focus({ preventScroll: true });
    };
  }, [formOpen]);

  // 共有時計の次のtickを待たず、保存した瞬間までの記録を表示する。
  // 残量カード接続時も、この同一のnowを現在値とグラフに渡す。
  const now = clock && addedAt && addedAt > clock ? addedAt : clock;
  const loading = !now || intake.status === "loading" || preferences.status === "loading";
  const failed = intake.status === "error" || preferences.status === "error";
  const ready = !loading && !failed;
  const today = ready ? getTodayRecords(intake.records, now!) : [];
  const total = ready ? calculateTodayTotalMg(intake.records, now!) : 0;
  const limit = preferences.settings.dailyLimitMg;
  const reached = total >= limit;
  const progress = limit === 0 ? 100 : Math.max(0, Math.min(100, total / limit * 100));
  const recent = [...today].sort((a, b) => Date.parse(b.consumedAt) - Date.parse(a.consumedAt)).slice(0, 3);
  const candidates = ready ? getQuickAddCandidates(intake.records, now!, 2) : [];
  const cutoff = ready ? calculateLastCupTime(intake.records, preferences.settings, CUTOFF_CUP_MG, CUTOFF_TARGET_MG, now!) : null;

  function quickAdd(candidate: QuickAddCandidate) {
    if (!ready) return;
    const at = new Date();
    try {
      const saved = intake.addRecord({ presetId: candidate.presetId, name: candidate.name, caffeineMg: candidate.caffeineMg, consumedAt: at.toISOString() });
      if (!saved) {
        setNotice({ ok: false, text: "保存できませんでした。記録は追加されていません。" });
        return;
      }
      setAddedAt(at);
      setNotice({ ok: true, text: `${candidate.name}を記録しました。` });
    } catch {
      setNotice({ ok: false, text: "保存できませんでした。記録は追加されていません。" });
    }
  }

  return (
    <>
    <main inert={formOpen} className="mx-auto flex min-h-dvh w-full flex-col bg-bg-base px-space-20 pt-[max(60px,env(safe-area-inset-top))] min-[600px]:max-w-[420px]">
      <header className="mb-space-22 flex flex-wrap items-baseline justify-between gap-space-8">
        <h1 ref={headingRef} tabIndex={-1} className="text-size-26 font-semibold tracking-[-0.01em]">今日</h1>
        {now && <time dateTime={now.toISOString()} className="font-mono text-size-13 text-text-tertiary">{formatDateLabel(now)}</time>}
      </header>
      {failed ? (
        <p role="alert" className="rounded-radius-18 border border-danger bg-surface-card p-space-16 text-size-14">
          {intake.error === "write-failed" ? "記録を保存できませんでした。" : "記録または設定を読み込めませんでした。"}
          データを確認できないため、追加を停止しています。再読み込みしてお試しください。
        </p>
      ) : loading ? <p role="status" className="text-size-14 text-text-secondary">読み込み中…</p> : (
        <>
          <section aria-label="今日の総摂取量" className="flex flex-col gap-space-16 rounded-radius-22 border border-border-subtle bg-surface-card p-space-20">
            <div className="flex flex-wrap items-end gap-space-8 font-mono">
              <span className={`max-w-full break-all text-size-54 leading-[0.9] font-medium tracking-[-0.02em] ${reached ? "text-danger" : "text-text-primary"}`}>{displayMg(total)}</span>
              <span className="pb-space-5 text-[16px] text-text-tertiary">/ {displayMg(limit)} mg</span>
            </div>
            <div role="progressbar" aria-label="今日の摂取上限に対する割合" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${displayMg(total)} mg / ${displayMg(limit)} mg`}
              className="h-space-8 overflow-hidden rounded-radius-99 bg-text-primary/[0.09]">
              <div className={`h-full rounded-radius-99 transition-[width,background-color] duration-180 motion-reduce:transition-none ${reached ? "bg-danger" : "bg-accent"}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="flex flex-wrap justify-between gap-space-8 text-size-14 text-text-secondary">
              <p className={reached ? "text-danger" : undefined}>
                {total > limit ? <>上限を<span className="font-mono">{displayMg(total - limit)}mg</span>超過</> : total === limit ? "上限に達しました" : <>上限まで あと <span className="font-mono text-text-primary">{displayMg(limit - total)}mg</span></>}
              </p>
              <p><span className="font-mono">{today.length}</span>杯</p>
            </div>
          </section>
          <section aria-label="最後の1杯の目安" className="mt-space-14 flex items-start gap-space-12 rounded-radius-18 border border-accent/30 bg-accent/[0.10] px-space-16 py-space-14 text-size-14 text-[#EBD9C4]">
            <span aria-hidden="true" className="mt-space-5 size-space-8 shrink-0 rounded-radius-99 bg-accent" />
            <p>
              {cutoff ? <><span className="font-mono">{preferences.settings.bedtime}</span> 就寝なら <span className="font-mono">{formatTime(cutoff)}</span> までが最後の1杯の目安</> : "この条件では、今日これから追加できる目安時刻はありません"}
              <span className="mt-space-4 block text-size-12 text-text-secondary">追加90mg・就寝時目標50mgで計算した表示です。医学的な安全保証ではありません。</span>
            </p>
          </section>
          <section aria-labelledby="today-records" className="mt-space-22">
            <div className="mb-space-10 flex items-baseline justify-between">
              <h2 id="today-records" className="text-size-15 font-medium">きょうの記録</h2>
              <Link href="/history" className={`rounded-radius-5 py-space-8 text-size-14 text-text-tertiary ${focus}`}>すべて<span className="sr-only">の履歴を見る</span></Link>
            </div>
            {recent.length === 0 ? <p className="rounded-radius-16 bg-surface-row px-space-16 py-space-14 text-size-14 text-text-secondary">今日の記録はまだありません。飲んだものを記録していきましょう。</p> : (
              <ul className="flex flex-col gap-px overflow-hidden rounded-radius-16 bg-border-subtle">
                {recent.map(record => (
                  <li key={record.id} className="flex items-center gap-space-14 bg-surface-row px-space-16 py-space-14">
                    <time dateTime={record.consumedAt} className="w-[42px] shrink-0 font-mono text-size-13 text-text-tertiary">{formatTime(new Date(record.consumedAt))}</time>
                    <span className="min-w-0 flex-1 break-words text-size-15">{record.name}</span>
                    <span className="max-w-[40%] break-all text-right font-mono text-size-15">{displayMg(record.caffeineMg)}<span className="text-size-11 text-text-tertiary"> mg</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <div className="mt-auto pt-space-14">
        {notice && (!notice.ok || !failed) && <p role={notice.ok ? "status" : "alert"} className={`mb-space-10 break-words text-size-14 ${notice.ok ? "text-text-secondary" : "text-danger"}`}>{notice.text}</p>}
        <div aria-label="クイック追加" className="flex items-center gap-space-10 pb-[12px]">
          <div className="flex min-w-0 flex-1 flex-wrap gap-space-8">
            {candidates.map(candidate => (
              <button key={candidate.presetId === null ? `manual:${candidate.name}` : `preset:${candidate.presetId}`} type="button" onClick={() => quickAdd(candidate)}
                aria-label={`${candidate.name} ${displayMg(candidate.caffeineMg)}mgを追加`}
                className={`max-w-full rounded-radius-99 border border-text-primary/[0.09] bg-surface-chip px-space-14 py-[11px] text-left text-size-14 ${focus}`}>
                <span className="break-words">{candidate.name}</span>{" "}<span className="inline-block font-mono text-text-tertiary">{displayMg(candidate.caffeineMg)}mg</span>
              </button>
            ))}
          </div>
          <button ref={fabRef} type="button" disabled={!ready} onClick={() => { if (ready) setFormOpen(true); }} aria-label="記録を追加" className={`flex size-[52px] shrink-0 items-center justify-center rounded-radius-99 bg-accent text-[28px] font-medium text-bg-base disabled:opacity-50 ${focus}`}>+</button>
        </div>
        <TabBar />
      </div>
    </main>
    {/* readyの変化や保存失敗で下書きを失わないよう常時マウントする。 */}
    <div ref={formRef}>
      <IntakeForm open={formOpen} onClose={closeForm} />
    </div>
    </>
  );
}
