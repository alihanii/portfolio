"use client";

import { useEffect, useState } from "react";
import type { StageDetail } from "./ScrollStage";

/** Live numbers from the canvas, shown in the "under the hood" card. */
export default function LiveStats({ labels, locale }: { labels: { frame: string; fps: string; loaded: string }; locale: string }) {
  const [s, setS] = useState<StageDetail>({ frame: 0, total: 120, loaded: 0, fps: 60 });

  useEffect(() => {
    let raf = 0;
    let latest: StageDetail | null = null;
    const on = (e: Event) => {
      latest = (e as CustomEvent<StageDetail>).detail;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (latest) setS(latest);
        });
    };
    window.addEventListener("stage:frame", on);
    return () => {
      window.removeEventListener("stage:frame", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  const n = (v: number) => v.toLocaleString(locale);
  const items = [
    { label: labels.frame, value: `${n(s.frame + 1)}/${n(s.total)}` },
    { label: labels.fps, value: n(Math.min(s.fps, 120)) },
    { label: labels.loaded, value: `${n(Math.round((s.loaded / s.total) * 100))}%` },
  ];

  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-line px-3 py-2.5">
          <dt className="text-[0.6875rem] leading-tight text-muted">{it.label}</dt>
          <dd className="ltr mt-1 font-display text-lg font-bold tabular-nums">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
