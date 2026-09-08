---
name: perf-profile
description: >-
  Use when investigating performance in Own a Dungeon — jank during raid
  playback, slow initial load, or "is this going to be slow" before adding a
  system. Triggers on "performance", "slow", "janky", "frame rate", "profile
  this". Adapted from Donchitos/Claude-Code-Game-Studios' perf-profile skill,
  retargeted from engine Update()/draw-call analysis to this game's DOM/CSS
  model with no render loop.
license: MIT
---

# Own a Dungeon — Performance

Source: condensed from
[Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)'
`perf-profile` skill, which targets per-frame engine cost and draw calls.
This game has no render loop: it is DOM and CSS driven by discrete state
changes and awaited beats in `useRaidDirector`. This targets that surface.
Measurement only — for *where* code belongs see `tech-architecture`.

## What can actually be slow

**Initial load.** Everything in `public/art/` ships in the static export with
no lazy loading. The room backdrops are the heavy items (512×928 each, seven
of them). Check `npm run build` output before assuming.

**Raid playback.** `useRaidDirector` sets React state per beat and the whole
`DungeonView` subtree re-renders. That is fine at current volumes — a few
updates per hundred milliseconds — but a system that emitted events an order
of magnitude faster would need the floating-number list virtualised or moved
out of React state. Measure before assuming it is a problem.

**Camera tween.** Traversal drives `scrollLeft` from `requestAnimationFrame`
while a CSS transform moves the hero. Heavy synchronous work inside a beat
delays the tween visibly, because both are on the main thread.

**The offline batch.** `offlineReport` runs up to 30 full raids synchronously
on load with `collectEvents: false`. That cap is what keeps it off the
critical path; raising it, or turning events back on, would put real work in
front of first paint.

**Persistence.** `saveState` writes the whole state to `localStorage` on every
change. Fine per action; a system that wrote per animation beat would not be.

## How to check

1. `npm run build` and read the route sizes.
2. Serve `out/`, run a real raid under the DevTools Performance panel or
   Playwright tracing. Look for long tasks and layout thrash, not FPS — there
   is no frame clock to measure against.
3. **Throttle CPU 4–6×** before judging. This is a mobile game; a desktop
   profile hides real jank.

## Report

State what was profiled, what the measurement showed, and the specific fix.
If a suspicion cannot be confirmed with build output or a trace, say so rather
than presenting a guess as a finding.
