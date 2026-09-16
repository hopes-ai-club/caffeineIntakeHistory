export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-space-20 bg-bg-base p-space-20 min-[600px]:max-w-[420px]">
      <h1 className="text-size-26 font-semibold">デザイン基盤</h1>
      <p className="text-size-15 text-text-secondary">
        背景・文字・数値の表示を確認するための仮表示です。
      </p>
      <section
        aria-label="文字と数値のサンプル"
        className="flex flex-col gap-space-16 rounded-radius-22 border border-border-subtle bg-surface-card p-space-20"
      >
        <p className="text-size-17">Caffeine Log</p>
        <p className="font-mono text-size-34 font-medium text-accent">245 mg</p>
        <p className="rounded-radius-16 bg-surface-row p-space-14 text-size-13">
          時刻サンプル：<span className="font-mono text-sleep">23:00</span>
        </p>
      </section>
    </main>
  );
}
