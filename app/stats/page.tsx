import TabBar from "@/components/TabBar";

export default function Stats() {
  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col bg-bg-base px-space-20 pt-[max(60px,env(safe-area-inset-top))] min-[600px]:max-w-[420px]">
      <header className="mb-space-22">
        <h1 className="text-size-26 font-semibold tracking-[-0.01em]">統計</h1>
      </header>

      <p className="text-size-14 text-text-secondary">統計機能は準備中です。</p>

      <div className="mt-auto pt-space-20">
        <TabBar />
      </div>
    </main>
  );
}
