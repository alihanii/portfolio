"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { STORAGE } from "@/lib/theme";
import { asset } from "@/lib/base";

gsap.registerPlugin(ScrollTrigger);

type Manifest = { count: number; width: number; height: number; sm?: { count: number; width: number; height: number } };
type Range = { id: string; start: number; end: number; from: number; to: number };
type Frame = HTMLImageElement | ImageBitmap;

export type StageDetail = { frame: number; total: number; loaded: number; fps: number };

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

const FOCUS_X = 0.5;
const FOCUS_Y = 0.38;
/* Phones keep at most this many decoded frames; the rest stay as compressed blobs. */
const BITMAP_CACHE = 28;

const frameSize = (f: Frame) => (f instanceof HTMLImageElement ? [f.naturalWidth, f.naturalHeight] : [f.width, f.height]);

export default function ScrollStage({ loadingLabel }: { loadingLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const progressBar = document.querySelector<HTMLElement>("[data-progress]");
    let disposed = false;

    let manifest: Manifest = { count: 120, width: 1920, height: 1080 };
    let count = 120; // frames in the set this device loads
    let frames: (Frame | null)[] = [];
    let blobs: (Blob | null)[] = [];
    let loaded = 0;
    let current = 0; // index on the 0..manifest.count-1 scale used by the JSON ranges
    let lastDrawn: Frame | null = null;
    let ranges: Range[] = [];
    let maxScroll = 1;
    let fps = 60;

    /* ---------- smooth scroll (wheel only; touch keeps native scrolling) ---------- */
    ScrollTrigger.config({ ignoreMobileResize: true });
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

    /* ---------- lighting layers, painted into the canvas ----------
       The accent glow, the accent re-light and the vignette used to be CSS layers with
       mix-blend-mode over the canvas, which made the browser re-blend the whole screen on
       every scroll frame. They are now pre-rendered once per size/theme/accent and composited
       inside the canvas only when the frame changes. */
    const glowLayer = document.createElement("canvas");
    const tintLayer = document.createElement("canvas");
    const vignetteLayer = document.createElement("canvas");

    const buildLayers = () => {
      const cs = getComputedStyle(root);
      const accent = cs.getPropertyValue("--accent-rgb").trim().split(/\s+/).join(",") || "239,59,45";
      const bg = cs.getPropertyValue("--bg-rgb").trim().split(/\s+/).join(",") || "7,5,5";
      const glow = 0.55;
      const tint = 0.5;
      const w = canvas.width;
      const h = canvas.height;
      const radial = (c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rgba: string) => {
        c.save();
        c.translate(cx * w, cy * h);
        c.scale(rx * w, ry * h);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, rgba);
        g.addColorStop(1, rgba.replace(/[\d.]+\)$/, "0)"));
        c.fillStyle = g;
        c.fillRect(-1, -1, 2, 2);
        c.restore();
      };
      for (const layer of [glowLayer, tintLayer, vignetteLayer]) {
        layer.width = w;
        layer.height = h;
      }
      const g = glowLayer.getContext("2d")!;
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, h);
      radial(g, 0.22, 0.42, 0.5, 0.65, `rgba(${accent},${glow})`);
      radial(g, 0.82, 0.28, 0.42, 0.5, `rgba(${accent},${glow * 0.35})`);

      const t = tintLayer.getContext("2d")!;
      t.clearRect(0, 0, w, h);
      t.globalAlpha = tint;
      radial(t, 0.18, 0.45, 0.55, 0.8, `rgba(${accent},1)`);
      radial(t, 0.85, 0.35, 0.38, 0.6, `rgba(${accent},0.6)`);

      const v = vignetteLayer.getContext("2d")!;
      v.clearRect(0, 0, w, h);
      const lin = v.createLinearGradient(0, 0, 0, h);
      lin.addColorStop(0, `rgba(${bg},0.55)`);
      lin.addColorStop(0.22, `rgba(${bg},0)`);
      lin.addColorStop(0.7, `rgba(${bg},0)`);
      lin.addColorStop(1, `rgba(${bg},0.85)`);
      v.fillStyle = lin;
      v.fillRect(0, 0, w, h);
      {
        v.save();
        v.translate(w / 2, h * 0.45);
        v.scale(w * 0.8, h * 0.7);
        const rg = v.createRadialGradient(0, 0, 0, 0, 0, 1);
        rg.addColorStop(0.55, `rgba(${bg},0)`);
        rg.addColorStop(1, `rgba(${bg},0.7)`);
        v.fillStyle = rg;
        v.fillRect(-2, -2, 4, 4);
        v.restore();
      }
    };

    /* ---------- canvas ---------- */
    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      // The canvas is sized to the large viewport (100lvh), so the mobile URL bar showing or
      // hiding doesn't change its size; only real size changes reallocate it.
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === cssW && Math.abs(h - cssH) < 2) return;
      cssW = w;
      cssH = h;
      // Phone frames are ~900px tall, about 1 source pixel per CSS pixel, so a denser canvas
      // would only upscale the same pixels at 4x the fill cost.
      const dpr = mobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.imageSmoothingQuality = "high";
      buildLayers();
      draw(true);
    };

    const toLocal = (i: number) => Math.round((i / Math.max(manifest.count - 1, 1)) * (count - 1));

    const nearest = (index: number) => {
      if (frames[index]) return frames[index];
      for (let d = 1; d < count; d++) {
        const a = frames[index - d];
        if (a) return a;
        const b = frames[index + d];
        if (b) return b;
      }
      return null;
    };

    // Only touches the canvas when the frame on screen actually changes.
    const draw = (force = false) => {
      const local = toLocal(current);
      const img = nearest(local);
      if (!img || (img === lastDrawn && !force)) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const [iw, ih] = frameSize(img);
      const scale = Math.max(cw / iw, ch / ih);
      const w = iw * scale;
      const h = ih * scale;
      const x = (cw - w) * FOCUS_X;
      const y = Math.min(0, (ch - h) * FOCUS_Y);
      ctx.drawImage(glowLayer, 0, 0);
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(img, x, y, w, h);
      ctx.globalCompositeOperation = "color";
      ctx.drawImage(tintLayer, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(vignetteLayer, 0, 0);
      lastDrawn = img;
      if (mobile) prefetch(local);
    };

    /* ---------- phone frame cache: decode around the current frame, drop the rest ---------- */
    const decoding = new Set<number>();
    const order: number[] = [];
    const prefetch = (center: number) => {
      for (let d = 0; d <= BITMAP_CACHE / 2; d++) {
        for (const i of [center + d, center - d]) {
          if (i < 0 || i >= count || frames[i] || decoding.has(i) || !blobs[i]) continue;
          decoding.add(i);
          createImageBitmap(blobs[i]!)
            .then((bmp) => {
              decoding.delete(i);
              if (disposed) return bmp.close();
              frames[i] = bmp;
              order.push(i);
              while (order.length > BITMAP_CACHE) {
                // Evict the cached frame furthest from the one on screen.
                const here = toLocal(current);
                order.sort((a, b) => Math.abs(a - here) - Math.abs(b - here));
                const out = order.pop()!;
                const f = frames[out];
                if (f && f !== lastDrawn && !(f instanceof HTMLImageElement)) f.close();
                if (f !== lastDrawn) frames[out] = null;
              }
              if (Math.abs(i - toLocal(current)) <= 1) draw();
            })
            .catch(() => decoding.delete(i));
        }
      }
    };

    const emit = () => {
      window.dispatchEvent(
        new CustomEvent<StageDetail>("stage:frame", { detail: { frame: current, total: manifest.count, loaded: Math.round((loaded / count) * manifest.count), fps } }),
      );
    };

    /* ---------- scroll position -> frame ---------- */
    const measure = () => {
      const vh = window.innerHeight;
      maxScroll = ScrollTrigger.maxScroll(window) || 1;
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-frames]"));
      ranges = els.map((el, i) => {
        const [from, to] = el.dataset.frames!.split(",").map(Number);
        const top = el.getBoundingClientRect().top + window.scrollY;
        const start = i === 0 ? 0 : top - vh / 2;
        const end = i === els.length - 1 ? maxScroll : top + el.offsetHeight - vh / 2;
        return { id: el.id, start, end: Math.max(end, start + 1), from, to };
      });
    };

    let activeId = "";
    const update = (scrollY: number) => {
      // Writes only; everything it needs was measured on refresh, so scrolling never forces layout.
      if (progressBar) progressBar.style.transform = `scaleX(${Math.min(1, scrollY / maxScroll)})`;
      if (!ranges.length) return;
      let r = ranges[ranges.length - 1];
      for (const range of ranges) {
        if (scrollY < range.end) {
          r = range;
          break;
        }
      }
      const t = gsap.utils.clamp(0, 1, (scrollY - r.start) / (r.end - r.start));
      current = Math.round(gsap.utils.clamp(0, manifest.count - 1, r.from + (r.to - r.from) * t));
      draw();
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

    /* ---------- accent changes re-light the canvas ---------- */
    const themeObserver = new MutationObserver(() => {
      buildLayers();
      draw(true);
    });
    themeObserver.observe(root, { attributes: true, attributeFilter: ["style"] });

    /* ---------- reveal ---------- */
    let revealCtx: gsap.Context | null = null;
    if (!reduced) {
      revealCtx = gsap.context(() => {
        gsap.set("[data-reveal]", { autoAlpha: 0, y: mobile ? 24 : 40 });
        ScrollTrigger.batch("[data-reveal]", {
          start: "top 90%",
          onEnter: (batch) =>
            gsap.to(batch, { autoAlpha: 1, y: 0, duration: mobile ? 0.6 : 0.9, ease: "power3.out", stagger: 0.08, overwrite: true }),
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
      const size = mobile && manifest.sm ? "sm" : "lg";
      count = size === "sm" ? manifest.sm!.count : manifest.count;
      frames = new Array(count).fill(null);
      blobs = new Array(count).fill(null);
      const src = (i: number) => asset(`/frames/${size}/${String(i + 1).padStart(3, "0")}.webp`);

      const done = () => {
        loaded++;
        setProgress(loaded / count);
      };

      // Desktop: <img> elements, decoded off the main thread before first use.
      const loadImage = (i: number) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.src = src(i);
          img
            .decode()
            .then(() => {
              frames[i] = img;
              done();
              if (Math.abs(i - toLocal(current)) <= 2) draw();
            })
            .catch(() => {})
            .finally(resolve);
        });

      // Phones: keep the compressed file, decode into a bitmap only near the current frame.
      const loadBlob = async (i: number) => {
        try {
          const res = await fetch(src(i));
          if (!res.ok) return;
          blobs[i] = await res.blob();
          done();
          if (Math.abs(i - toLocal(current)) <= BITMAP_CACHE / 2) prefetch(toLocal(current));
        } catch {}
      };

      const loadOne = size === "sm" ? loadBlob : loadImage;

      await loadOne(0);
      if (size === "sm" && blobs[0]) {
        frames[0] = await createImageBitmap(blobs[0]);
        order.push(0);
      }
      if (disposed) return;
      resize();
      ScrollTrigger.refresh();
      restore();
      draw(true);
      setReady(true);

      // Load the rest in order of distance from the frame that is on screen.
      const here = toLocal(current);
      const queue = Array.from({ length: count - 1 }, (_, k) => k + 1).sort((a, b) => Math.abs(a - here) - Math.abs(b - here));
      const workers = Array.from({ length: mobile ? 4 : 6 }, async () => {
        while (queue.length && !disposed) await loadOne(queue.shift()!);
      });
      await Promise.all(workers);
      emit();
    };

    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(canvas);
    resize();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    load();

    return () => {
      disposed = true;
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      gsap.ticker.remove(onFps);
      trigger.kill();
      revealCtx?.revert();
      lenis?.destroy();
      delete window.__lenis;
      for (const f of frames) if (f && !(f instanceof HTMLImageElement)) f.close();
    };
  }, []);

  const hideLoader = ready && progress > 0.35;

  return (
    <>
      <div className="stage" aria-hidden="true">
        <canvas ref={canvasRef} className="stage-canvas" data-ready={ready} />
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
