# Caddie

A phone-first golf caddie web app. It showcases every shot in your arsenal —
each club + swing combination with its carry distance, trajectory, and shape —
and, given the distance to the flag and the conditions (wind, slope,
temperature, altitude), highlights the shot that best covers the number.

Built with Vite + React + TypeScript + Tailwind. Installable on your phone as a
PWA; all data lives on-device (localStorage) so it works offline on the course.

## Quick start

```bash
npm install
npm run dev      # prints a local URL and a network URL — open the network one on your phone
npm run build    # type-checks and builds to dist/
```

> **Note:** `package.json` pins rollup to its WASM build (`@rollup/wasm-node`
> via `overrides`) because this machine's Windows Application Control policy
> blocks rollup's native binary. Builds run slightly slower but work
> identically everywhere — locally and on Vercel. If your policy ever allows
> the native binary, you can remove the override.

## Deploying (GitHub + Vercel)

1. Push this repo to GitHub.
2. In Vercel, import the repo — it auto-detects Vite. No env vars, no backend.
3. Every push deploys. `base: './'` in `vite.config.ts` means the build also
   works from any static host path (GitHub Pages included).

## Installing on your phone

- **Android/Chrome:** open the deployed URL → menu → "Add to Home screen".
- **iOS/Safari:** Share → "Add to Home Screen". (The icon is SVG; drop a 180px
  `apple-touch-icon.png` into `public/` and reference it in `index.html` if you
  want a nicer iOS icon.)

Once installed it runs fullscreen and works with no signal — the service worker
caches the app shell.

## The distance model

Your arsenal's stock carries are defined under **standard conditions**: no wind,
20°C (68°F), sea level. Each shot's stock carry is scaled by the conditions, and
the app ranks shots by how close they land to your number:

- **The number to cover** = the distance you enter on the Play tab. A
  slope-adjusted laser reading is ideal — it already handles the elevation
  change to the green, so there's no separate target-elevation input.
- **Stance slope** (Play tab) = the tilt of the ground under your feet, which a
  laser can't see: an uphill lie adds loft and shortens the carry, a downhill
  lie delofts and lengthens it. Set it whenever you're standing on a slope.
- **Effective carry** (per shot) = stock carry × wind × temperature × altitude.

Wind is applied as a percentage scaled by the shot's trajectory — high-flying
shots are hurt more by a headwind than punch shots, which is exactly why the
arsenal concept beats a plain club list. Overshoots are penalized when ranking
(flying the green is worse than coming up short). The dock's **Miss
preference** flips that: with trouble guarding the front (a bunker short of
the green), set it to Overshoot and undershoots are penalized instead.
Crosswinds get a rough aim hint instead of a distance change.

Temperature and course altitude live in **Settings → Round conditions** — set
them once when you arrive, not per swing. The same section has a **"How am I
feeling"** slider (−20%…+20%): arsenal numbers are a sim/range baseline, and
this shifts all of them for how you're striking it today, without touching the
arsenal itself. Conditions (wind, temperature, altitude) display in **metric by
default** (°C, km/h, m) with an imperial toggle in Settings; golf distances keep
their own **yards-by-default** toggle, since golf is played in yards almost
everywhere.

Tuning factors (all adjustable in Settings → Model tuning):

| Factor | Default | Meaning |
|---|---|---|
| Headwind | 0.8%/mph | distance lost per mph into the wind |
| Tailwind | 0.45%/mph | distance gained per mph behind |
| Temperature | 0.15%/°F | per °F away from 68°F (20°C) |
| Altitude | 2%/1000 ft | distance gained per 1,000 ft above sea level |
| Stance slope | 1%/deg | carry change per degree of uphill ground under your feet (uphill lie adds loft, plays shorter) |
| Overshoot penalty | 1.5× | ranking penalty on the side you don't want to miss (which side is set on the Play tab) |

These are caddie heuristics, not physics — play a few rounds, compare results,
tune them to your game.

## Where the data lives

Everything (shots, conditions, settings) is stored in `localStorage` on the
device. **Export a backup** from Settings before switching phones. The state
shape is a single JSON document (`AppState` in `src/types.ts`), deliberately
designed so a sync layer (e.g. Supabase) can be added later without changing
the UI.

## Roadmap ideas

- Supabase sync + multi-device backup
- GPS distance-to-pin (needs course green coordinates) and shot tracking
- Optional manual slope entry (only relevant if you ever use non-slope-adjusted
  GPS numbers on hilly courses — laser users don't need it)
- Dispersion per shot (average + spread, not just stock carry)
- Wind in km/h, if you play in metric countries
- Green-side context (front/middle/back pin, hazards)
