---
name: browser-game-dev
description: >-
  Use when adding a new gameplay system, screen, or mechanic to Own a Dungeon
  (Next.js/React/TS DOM-based dungeon game) — e.g. "add a new trap type",
  "build an arcade leaderboard", "add a new hero class". Enforces a
  one-system-at-a-time build-and-verify loop instead of building several
  systems in parallel untested. Adapted from
  Sudhanshu5669/Html5-Gamedev-Skill for this project's existing DOM/CSS
  architecture (no canvas engine).
license: MIT
---

# Own a Dungeon — Build & Verify Loop

Source: adapted from the `game-dev` skill in
[Sudhanshu5669/Html5-Gamedev-Skill](https://github.com/Sudhanshu5669/Html5-Gamedev-Skill),
which assumes a fresh Phaser/PixiJS canvas project. This is a shipping Next.js
App Router game rendered entirely with DOM and CSS. This version drops the
greenfield scaffolding and keeps the discipline that still applies: one system
at a time, verified in a real browser before moving on.

## This project's shape

- **`game/`** is framework-free TypeScript with no DOM and no React:
  `content/` (the tunable data), `state/` (save, economy, roster, world),
  `sim/` (hero instances, AI, the raid loop, offline batch).
- **`app/game/`** is React and owns everything visual. `GameShell` composes,
  `useGameState` handles persistence, `useRaidDirector` replays the
  simulation's `RaidEvent[]` as timed animation and sound, `panels/` holds one
  file per sheet, `styles/` is split into tokens, chrome, dungeon and panels.
- **The seam is the event log.** `simulateRaid()` returns `RaidEvent[]`.
  Presentation replays it. Simulation never touches the DOM; presentation
  never recomputes an outcome. Keeping that seam clean is why the same
  function can run the offline batch with events switched off.
- **Static export, no server.** `output: 'export'` for GitHub Pages, all
  persistence in `localStorage`. Never add code that assumes a Node runtime.

## The loop

1. **Scope one system.** One cohesive change — a new trap end to end (data +
   interaction + sprite), a new sheet, a new combat rule. If the ask is
   genuinely several systems, say so and propose an order.
2. **Find the layer first.** Content and tuning go in `game/content/`. New
   behaviour goes in `game/sim/`. New surfaces go in `app/game/`. Do not
   duplicate logic across the seam.
3. **Build it.**
4. **Verify — every time.** `npm run type-check`, `npm run build`, and a real
   Playwright pass at 390×844 *and* 360×640 with a clean console. See
   `qa-verification` for what that pass has to cover and for the measurement
   habits (per-raid seeds, geometry assertions, aria-label selectors) that
   have caught real bugs here.
5. **Fix and retest the same system** before starting the next.
6. **Commit the verified system on its own.** One focused commit per change.

## Don't

- Don't add a canvas, WebGL, a physics engine, or a bundler switch — this is
  deliberately DOM/CSS. Flag it and ask if a request seems to need one.
- Don't reach for a hero-specific branch in `game/sim/`. The interaction table
  and status `blocksTraits` exist so that identities stay data.
- Don't skip the 360-wide check because 390 looked right.
- Don't mark something done from the diff alone.
