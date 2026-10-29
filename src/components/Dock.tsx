"use client";

import { useEffect, useState } from "react";
import { accents, applyAccent, read, store, STORAGE } from "@/lib/theme";
import type { Locale, Resume } from "@/lib/content";
import { Download, Palette } from "./Icons";
import { asset } from "@/lib/base";

/** Remembers where the reader is, so the other language opens at the same spot. */
export function rememberPosition() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-frames]"));
  const mid = window.innerHeight / 2;
  for (const el of sections) {
    const r = el.getBoundingClientRect();
    if (r.bottom > mid) {
      const t = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      try {
        sessionStorage.setItem(STORAGE.resume, JSON.stringify({ id: el.id, t }));
      } catch {}
      return;
    }
  }
}

export default function Dock({ lang, ui, pdf }: { lang: Locale; ui: Resume["ui"]; pdf: string }) {
  const [accent, setAccent] = useState<string>(accents[0].value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const a = read(STORAGE.accent);
    if (a) setAccent(a);
  }, []);

  const pickAccent = (hex: string) => {
    setAccent(hex);
    applyAccent(hex);
    store(STORAGE.accent, hex);
  };

  // Close the phone swatch popover on a tap outside it.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-dock]")) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const other: Locale = lang === "fa" ? "en" : "fa";

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="glass glass-strong flex items-center gap-1 rounded-full p-1.5" role="toolbar" aria-label={ui.accent} data-dock>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid size-11 cursor-pointer place-items-center rounded-full text-fg transition-colors hover:bg-white/10 sm:hidden"
          aria-label={ui.accent}
          aria-expanded={open}
          aria-controls="accent-swatches"
        >
          <Palette />
        </button>

        <div
          id="accent-swatches"
          className={`${open ? "flex" : "hidden"} items-center gap-1 sm:flex max-sm:glass max-sm:glass-strong max-sm:absolute max-sm:inset-x-0 max-sm:bottom-[calc(100%+0.5rem)] max-sm:mx-auto max-sm:w-max max-sm:rounded-full max-sm:p-1.5`}
          role="radiogroup"
          aria-label={ui.accent}
        >
          {accents.map((a) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={accent.toLowerCase() === a.value}
              aria-label={a.name}
              title={a.name}
              onClick={() => pickAccent(a.value)}
              className="grid size-9 cursor-pointer place-items-center rounded-full"
            >
              <span
                className="block size-5 rounded-full transition-transform"
                style={{
                  background: a.value,
                  boxShadow: accent.toLowerCase() === a.value ? `0 0 0 2px var(--bg), 0 0 0 4px ${a.value}, 0 0 16px ${a.value}` : "none",
                  transform: accent.toLowerCase() === a.value ? "scale(1.05)" : "scale(0.9)",
                }}
              />
            </button>
          ))}
          <label className="relative grid size-9 cursor-pointer place-items-center rounded-full" title={ui.customAccent}>
            <span className="sr-only">{ui.customAccent}</span>
            <span className="block size-5 rounded-full" style={{ background: "conic-gradient(#ef3b2d, #f2b632, #10b981, #22c7e6, #8b5cf6, #ef3b2d)" }} />
            <input type="color" value={accent} onChange={(e) => pickAccent(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>

        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />

        <a
          href={asset(`/${other}/`)}
          onClick={rememberPosition}
          hrefLang={other}
          className="grid h-11 min-w-11 cursor-pointer place-items-center rounded-full px-3 text-sm font-semibold text-fg transition-colors hover:bg-white/10"
          aria-label={ui.languageLabel}
          lang={other}
        >
          {ui.language}
        </a>

        <a href={asset(pdf)} download className="btn btn-accent h-11 min-h-0 px-4" aria-label={ui.downloadCv}>
          <Download />
          <span className="hidden sm:inline">{ui.downloadCv}</span>
        </a>
      </div>
    </div>
  );
}
