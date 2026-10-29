# Ali Hani · Portfolio

Bilingual (FA RTL / EN LTR) portfolio with a scroll-driven face canvas, frosted bento cards and a live theme dock.

- **Stack:** Next.js 16 (static export), React 19, Tailwind CSS 4, GSAP ScrollTrigger, Lenis
- **Routes:** `/fa/`, `/en/` (and `/` picks the saved or browser language)

## Run

```bash
npm install
npm run dev        # http://localhost:3000/fa/
npm run build      # static site in out/
```

`out/` can be hosted anywhere static: Vercel, Netlify, Cloudflare Pages, GitHub Pages (from the domain root).

## How it works

| Piece | Where |
| --- | --- |
| Face canvas, Lenis, frame mapping, reveal animations | `src/components/ScrollStage.tsx` |
| Theme / accent / language / PDF dock | `src/components/Dock.tsx` |
| Ambient glow, accent re-lighting, glass cards | `src/app/globals.css` (`.stage-*`, `glass`) |
| Resume content (one file per language) | `src/data/resume-fa.json`, `src/data/resume-en.json` |
| Page layout | `src/app/[lang]/page.tsx` |

**Frames.** `public/frames/lg` (desktop) and `public/frames/sm` (phones) hold 120 WebP frames each (1920px / 1080px wide, denoised and sharpened from the source video). The first frame is preloaded, then the rest load in order of distance from the frame on screen. The canvas only redraws when the frame changes.

**Frame ranges.** Each section in the JSON has `frames: [from, to]`. While the section passes the middle of the viewport, the canvas scrubs through that range. Change the ranges to choose which expression plays with which section.

**Accent lighting.** The dock writes `--accent` / `--accent-rgb`. Two layers use it: a blurred radial glow behind the canvas (the canvas uses `mix-blend-mode: screen` in dark mode, so the glow shows through the black studio background) and a `mix-blend-mode: color` layer that re-colours the red rim light on the face.

**RTL/LTR.** Layout uses logical properties and a 12-column grid with the face in the empty middle columns, so switching language mirrors the cards without moving the face. The language switch remembers the section and position and reopens the other language at the same spot.

**Accessibility.** Skip link, visible focus rings, labelled icon buttons, `prefers-reduced-motion` turns off Lenis and reveal animations.

## Updating content

### From a new video

```bash
npm run frames -- path/to/face.mp4 120
```

Needs `ffmpeg`. Writes both frame sizes and `public/frames/manifest.json`.

### From a new resume PDF

Edit the JSON files by hand, or let Claude extract them:

```bash
ANTHROPIC_API_KEY=... npm run resume:parse -- path/to/resume.pdf
```

`scripts/parse-resume.mjs` sends the PDF to Claude, gets structured Persian and English content back, merges it into the JSON files (keeping frame ranges, UI strings and links), and copies the PDF to `public/resume-alihani.pdf` for the download button. Review the diff before committing.

## Design skill

`.claude/skills/ui-ux-pro-max` is the [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) skill (MIT), installed at project level so Claude Code sessions in this repo can use it.
