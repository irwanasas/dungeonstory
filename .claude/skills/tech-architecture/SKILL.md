---
name: tech-architecture
description: >-
  Use when making a structural decision in Own a Dungeon — where new logic
  should live (game/content vs game/state vs game/sim vs app/game), whether
  to add a dependency, how to keep the Next.js static-export/GitHub-Pages
  constraints intact, or any change touching next.config.ts, the
  basePath/assetPrefix setup, or TypeScript config. Triggers on
  "architecture", "should this go in", "add a dependency", "static export",
  "build config". Adapted from AlterLab-IEU/AlterLab_GameForge's
  game-technical-director agent, trimmed to this project's real stack.
license: MIT
---

# Own a Dungeon — Technical Architecture

Source: condensed from
[AlterLab-IEU/AlterLab_GameForge](https://github.com/AlterLab-IEU/AlterLab_GameForge)'s
`game-technical-director` agent, written for engine selection, build
pipelines and multi-platform targets. This project is one Next.js static
export with no server and no engine, so this version is a map of the real
layering plus the constraints that actually bite.

## The layering

```
game/          pure simulation and data — no DOM, no React, no imports from app/
  content/     heroes, monsters, traps, treasure, statuses, interactions,
               stages, worldEvents, names
  state/       save (localStorage), economy, roster, world
  sim/         hero instances, ai decisions, raid loop, offline batch, rng
app/game/      presentation — the only layer that knows what a pixel is
  GameShell    composition and handlers
  useGameState load, save, offline report, visibility, reset
  DungeonView  the scrolling six-room world
  useRaidDirector  turns RaidEvent[] into timed animation and sound
  panels/      Sheet primitive + Build, Upgrade, Codex, World, Settings
  overlays.tsx Result, Offline, Coach, HeroTeaser
  art.ts, audio.ts, styles/{tokens,chrome,dungeon,panels}.css
scripts/art/   regenerates every sprite and UI frame from assets-src/room/
```

**The contract that holds it together:** `simulateRaid()` in
`game/sim/raid.ts` returns an ordered `RaidEvent[]` and nothing else. The
presentation layer replays that list with timing. The same function runs the
offline batch with `collectEvents: false`. Never let simulation reach for the
DOM, and never let presentation recompute an outcome.

## Where a change goes

- **Tuning a number or adding content** → `game/content/*.ts`. Adding a trap,
  monster, hero or world event should be a data change only.
- **New combat behaviour** → `game/sim/`. If it needs a new lever the sim
  reads, add it to the type in `game/types.ts` first.
- **New persisted field** → `game/state/save.ts`, and give `normalize()` a
  fallback for saves written before the field existed. This has already bitten
  once: the King→Lord rename needed a `kingLevel` → `lordLevel` migration or
  every existing player would have lost their upgrades.
- **New screen or sheet** → a file in `app/game/panels/`, exported through
  `panels/index.ts`, built on the shared `Sheet`.
- **New styling** → the matching file in `app/game/styles/`. They are imported
  in order by `index.css` and the cascade depends on that order.

## Constraints that actually bite

- **Static export, no server.** `next.config.ts` sets `output: 'export'` for
  GitHub Pages. No API routes, no server components doing IO, no runtime that
  assumes Node. All persistence is `localStorage` under `own_a_dungeon_v1`.
- **basePath.** On Pages the app is served from `/<repo>/`. Asset URLs go
  through `app/game/art.ts`, which prefixes `NEXT_PUBLIC_BASE_PATH`. A raw
  `/art/foo.png` string works in dev and 404s in production — always go
  through `art()`.
- **Sprites are referenced dynamically.** `art(\`hero-${id}.png\`)` and friends
  mean a grep for a filename finds nothing. Never conclude a sprite is unused
  from a basename search; check the content ids instead.
- **Dependencies.** The runtime dependency list is `next`, `react`,
  `react-dom`. Adding anything else needs a reason that survives "could this be
  twenty lines instead"; the art pipeline's Pillow is a dev-time script
  dependency, not shipped.

## Not applicable here

Engine selection, render pipelines, multi-platform build targets, CI matrices,
server scaling. If a request seems to need one, it is a bigger change than
"where does this file go" — say so before building it.
