"use client";

import { useSyncExternalStore } from "react";

/** 体内カフェイン残存量のライブ更新の粒度。半減期5時間の指数減衰に対して十分な精度。 */
const TICK_INTERVAL_MS = 60_000;

let current: Date | null = null;
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | undefined;
let visibilityHandler: (() => void) | undefined;

function tick(): void {
  current = new Date();
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  if (listeners.size === 1) {
    tick();
    intervalId = setInterval(tick, TICK_INTERVAL_MS);
    visibilityHandler = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      clearInterval(intervalId);
      intervalId = undefined;
      if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = undefined;
      current = null;
    }
  };
}

function getSnapshot(): Date | null {
  return current;
}

function getServerSnapshot(): Date | null {
  return null;
}

/**
 * 体内カフェイン残存量のライブ更新用に現在時刻を提供する。
 * サーバーレンダリング・ハイドレーション直後は null を返し、クライアントの購読開始時に実時刻へ切り替えることで不一致を避ける。
 * バックグラウンドタブではブラウザがタイマーを間引くため、復帰時（visibilitychange）に即座に現在時刻を更新する。
 * 呼び出し元全体で単一のタイマーを共有するため、複数コンポーネントから呼んでもタイマーは1つだけ動く。
 */
export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
