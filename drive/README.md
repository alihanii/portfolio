# Ali Hani · Drive-through résumé

A second, separate version of the portfolio: a small snowy island you drive a rally hatchback around. Every part of the résumé is a place on the island. Persian (RTL) and English (LTR).

- **Stack:** Vite, three.js (rendering), cannon-es (car and object physics). No model or audio files: the car, the island and the sounds are all generated in code.
- **Content:** read straight from `../src/data/resume-fa.json` and `../src/data/resume-en.json`, so both sites stay in sync. The PDF and the project screenshot are copied from `../public` at build time.

## Run

```bash
cd drive
npm install
npm run dev      # http://localhost:5173/?lang=fa
npm run build    # static site in drive/dist (relative paths, works in any sub-folder)
```

URL options: `?lang=fa|en`, `?autostart` (skip the start screen).

## Controls

| Desktop | Phone |
| --- | --- |
| W A S D or arrows to drive, Shift boost, Space handbrake | Stick on the left points where to go, yellow button boost, square button handbrake |
| Enter opens the place you are next to, M map, R back on the road, Esc closes | Tap the "Open" card, map and menu buttons at the top |

## Map

| Place | What's there | Résumé section |
| --- | --- | --- |
| Start | Name in big physics letters, title on the ground | `meta`, `hero` |
| About me (cabin) | Smoking chimney, sign | `about`, `education`, `hero.stats` |
| Career road | One glowing lane per job on a year axis | `experience` |
| Skill yard | Crate pyramids, one per skill group | `stack` |
| Project cinema | One billboard per project | `projects` |
| Contact | Email, GitHub, LinkedIn and CV monoliths | `meta`, `contact` |

Ramp and a tilted kicker sit north of the start. There are 11 achievements (saved in the browser).

## Files

| File | Job |
| --- | --- |
| `src/main.js` | Renderer, camera, game loop, achievements logic |
| `src/physics.js` | Raycast vehicle and its tuning (`CAR`) |
| `src/car.js` | The car model |
| `src/world.js` | Island, trees, zones, physics objects |
| `src/layout.js` | Positions of every zone and road |
| `src/textures.js` | Canvas textures (signs, billboards, crates, ground) |
| `src/ui.js` | Panels, markers, map, menu, toasts |
| `src/content.js` | UI strings for this version, career years, palette |
