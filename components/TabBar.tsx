"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "今日", round: false },
  { href: "/history", label: "履歴", round: false },
  { href: "/stats", label: "統計", round: true },
  { href: "/settings", label: "設定", round: true },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="メインナビゲーション" className="grid grid-cols-4 border-t border-border-subtle pt-space-6 pb-[max(34px,env(safe-area-inset-bottom))]">
      {tabs.map(({ href, label, round }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-col items-center gap-space-5 rounded-radius-5 pt-space-10 text-size-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? "text-text-primary" : "text-text-tertiary"}`}>
            <span aria-hidden="true" className={`size-[18px] ${round ? "rounded-radius-99" : "rounded-radius-5"} ${active ? "bg-accent" : "border-[1.5px] border-text-quaternary"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
