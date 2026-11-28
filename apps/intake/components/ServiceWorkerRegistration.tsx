"use client";

import { useEffect } from "react";

/** アプリシェルのオフラインキャッシュ用Service Workerを登録する。表示には関与しない。 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // オフライン対応が効かないだけなので、アプリ自体の動作は継続する。
    });
  }, []);

  return null;
}
