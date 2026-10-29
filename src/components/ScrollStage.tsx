"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { STORAGE } from "@/lib/theme";
import { asset } from "@/lib/base";

gsap.registerPlugin(ScrollTrigger);

type Manifest = { count: number; width: number; height: number };
type Range = { id: string; start: number; end: number; from: number; to: number };

export type StageDetail = { frame: number; total: number; loaded: number; fps: number };

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

const FOCUS_X = 0.5;
const FOCUS_Y = 0.38;

export default function ScrollStage({ loadingLabel }: { loadingLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingQuality = "high";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;

    let manifest: Manifest = { count: 120, width: 1280, height: 720 };
    let images: (HTMLImageElement | null)[] = [];
    let loaded = 0;
    let current = 0;
    let lastImg: HTMLImageElement | null = null;
    let ranges: Range[] = [];
    let fps = 60;

    /* ---------- smooth scroll ---------- */
    const lenis = reduced ? null : new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.9 });
    if (lenis) {
      window.__lenis = lenis;
      lenis.on("scroll", ScrollTrigger.update);
    }
    const tick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onFps = () => {
      const delta = gsap.ticker.deltaRatio(60);
      fps = Math.round(fps * 0.9 + (60 / Math.max(delta, 0.01)) * 0.1);
    };
    gsap.ticker.add(onFps);

    /* ---------- canvas ---------- */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      draw(current, true);
    };

    const nearestLoaded = (index: number) => {
      if (images[index]) return images[index];
      for (let d = 1; d < images.length; d++) {
        const a = images[index - d];
        if (a) return a;
        const b = images[index + d];
        if (b) return b;
      }
      return null;
    };

    // Only touches the canvas when the image on screen actually changes.
    const draw = (index: number, force = false) => {
      const img = nearestLoaded(index);
      if (!img || (img === lastImg && !force)) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const x = (cw - w) * FOCUS_X;
      const y = Math.min(0, (ch - h) * FOCUS_Y);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, x, y, w, h);
      lastImg = img;
    };

    const emit = () => {
      window.dispatchEvent(
        new CustomEvent<StageDetail>("stage:frame", { detail: { frame: current, total: manifest.count, loaded, fps } }),
      );
    };

    /* ---------- scroll position -> frame ---------- */
    const measure = () => {
      const vh = window.innerHeight;
      const max = ScrollTrigger.maxScroll(window);
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-frames]"));
      ranges = els.map((el, i) => {
        const [from, to] = el.dataset.frames!.split(",").map(Number);
        const top = el.getBoundingClientRect().top + window.scrollY;
        const start = i === 0 ? 0 : top - vh / 2;
        const end = i === els.length - 1 ? max : top + el.offsetHeight - vh / 2;
        return { id: el.id, start, end: Math.max(end, start + 1), from, to };
      });
    };

    let activeId = "";
    const update = (scrollY: number) => {
      const max = ScrollTrigger.maxScroll(window) || 1;
      document.documentElement.style.setProperty("--progress", String(Math.min(1, scrollY / max)));
      if (!ranges.length) return;
      let r = ranges[ranges.length - 1];
      for (const range of ranges) {
        if (scrollY < range.end) {
          r = range;
          break;
        }
      }
      const t = gsap.utils.clamp(0, 1, (scrollY - r.start) / (r.end - r.start));
      const frame = Math.round(gsap.utils.clamp(0, manifest.count - 1, r.from + (r.to - r.from) * t));
      current = frame;
      draw(frame);
      if (r.id !== activeId) {
        activeId = r.id;
        document.querySelectorAll<HTMLElement>("[data-nav]").forEach((a) => {
          if (a.dataset.nav === activeId) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      }
      emit();
    };

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => update(self.scroll()),
      onRefresh: (self) => {
        measure();
        update(self.scroll());
      },
    });

    /* ---------- reveal ---------- */
    let revealCtx: gsap.Context | null = null;
    if (!reduced) {
      revealCtx = gsap.context(() => {
        gsap.set("[data-reveal]", { autoAlpha: 0, y: 40 });
        ScrollTrigger.batch("[data-reveal]", {
          start: "top 88%",
          onEnter: (batch) =>
            gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, overwrite: true }),
        });
      });
    }

    /* ---------- anchors through Lenis ---------- */
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const target = document.querySelector<HTMLElement>(a.getAttribute("href")!);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.4 });
      else target.scrollIntoView();
      target.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick);

    /* ---------- restore position after a language switch ---------- */
    const restore = () => {
      let saved: { id: string; t: number } | null = null;
      try {
        saved = JSON.parse(sessionStorage.getItem(STORAGE.resume) || "null");
        sessionStorage.removeItem(STORAGE.resume);
      } catch {}
      if (!saved) return;
      const r = ranges.find((x) => x.id === saved!.id);
      if (!r) return;
      const y = r.start + (r.end - r.start) * saved.t;
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    };

    /* ---------- frames ---------- */
    const load = async () => {
      try {
        const res = await fetch(asset("/frames/manifest.json"));
        if (res.ok) manifest = await res.json();
      } catch {}
      images = new Array(manifest.count).fill(null);
      const size = window.innerWidth < 768 ? "sm" : "lg";
      const src = (i: number) => asset(`/frames/${size}/${String(i + 1).padStart(3, "0")}.webp`);

      const loadOne = (i: number) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            images[i] = img;
            loaded++;
            setProgress(loaded / manifest.count);
            draw(current);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src(i);
        });

      await loadOne(0);
      if (disposed) return;
      resize();
      ScrollTrigger.refresh();
      restore();
      setReady(true);

      // Load the rest in order of distance from the frame that is on screen.
      const queue = Array.from({ length: manifest.count - 1 }, (_, k) => k + 1).sort(
        (a, b) => Math.abs(a - current) - Math.abs(b - current),
      );
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length && !disposed) await loadOne(queue.shift()!);
      });
      await Promise.all(workers);
      emit();
    };

    resize();
    window.addEventListener("resize", resize);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    load();

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      gsap.ticker.remove(onFps);
      trigger.kill();
      revealCtx?.revert();
      lenis?.destroy();
      delete window.__lenis;
    };
  }, []);

  const hideLoader = ready && progress > 0.35;

  return (
    <>
      <div className="stage" aria-hidden="true">
        <div className="stage-glow" />
        <canvas ref={canvasRef} className="stage-canvas" data-ready={ready} />
        <div className="stage-tint" />
        <div className="stage-vignette" />
        <div className="stage-grain" />
      </div>
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg transition-opacity duration-700"
        style={{ opacity: hideLoader ? 0 : 1, pointerEvents: hideLoader ? "none" : "auto" }}
        role="status"
        aria-live="polite"
        aria-hidden={hideLoader}
      >
        <span className="dot-accent animate-pulse" />
        <p className="text-sm text-muted">{loadingLabel}</p>
        <div className="h-px w-48 overflow-hidden bg-line">
          <div className="h-full origin-left bg-accent transition-transform duration-300 rtl:origin-right" style={{ transform: `scaleX(${progress})` }} />
        </div>
        <p className="ltr text-xs tabular-nums text-muted">{Math.round(progress * 100)}%</p>
      </div>
    </>
  );
}
