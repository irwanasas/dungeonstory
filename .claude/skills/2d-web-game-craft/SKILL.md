---
name: 2d-web-game-craft
description: >-
  Use when working on sprite/animation presentation, the scrolling dungeon
  view, or browser-runtime concerns (asset loading, tab visibility,
  performance of the raid playback) in Own a Dungeon. Triggers on "sprite",
  "animation", "hero movement", "asset loading", "frame rate", "juice".
  Adapted from davila7/claude-code-templates' web-games and 2d-games skills —
  trimmed to what applies to a DOM/CSS-rendered game (no canvas, no physics
  engine, no tilemap engine).
license: MIT
---

# 2D Web Game Craft — DOM/CSS Edition

Source: condensed from
[davila7/claude-code-templates](https://github.com/davila7/claude-code-templates)'
web-games and 2d-games skills, which assume a canvas engine, WebGPU and a
physics engine — none of which exist or are wanted here. Own a Dungeon renders
as styled DOM elements in one horizontally-scrolling strip, so this keeps only
the parts that transfer.

## Animation feel

- **Timing is owned by one place.** `useRaidDirector` in `app/game/` holds
  every beat duration and the playback-speed multiplier. Add new pacing there
  rather than scattering `setTimeout` calls.
- **Anticipation → action → follow-through.** A hero step, a hit reaction, a
  door opening should each have a distinct start, impact and settle. The
  keyframes in `styles/dungeon.css` (`lunge`, `shake`, `die`, `pop-in`) are
  the established vocabulary.
- **The camera and the actor move together.** Traversal is a CSS transform on
  the hero plus a rAF tween of the scroll container over the same duration.
  Change one and you must change the other or the hero drifts off centre.
- **`image-rendering: pixelated`** everywhere, always.
- **9-slice over stretching** for any resizable pixel-art surface.

## Movement

The dungeon is one `overflow-x: auto` strip of seven fixed-width cells with
`touch-action: pan-x`. Actors are absolutely positioned inside the track by
world x, so cell index maps to position arithmetically. Two things to respect:
the track is offset by a measured pad so the first and last cell can centre,
and **cell index is not room index** — the entrance is cell 0, room *n* is
cell *n+1*. Getting that wrong has already caused a real off-by-one where
swiping selected the wrong room.

## Browser-runtime constraints

- **Tab visibility.** `useGameState` treats time away as first class and runs
  the offline batch on return. Any new timer-driven system must survive being
  backgrounded mid-sequence.
- **Asset loading.** Everything in `public/art/` ships in the static export;
  there is no lazy loading. Keep new sprites small and purpose-generated.
- **Mobile input.** Portrait, touch-first, 390×844 target with 360×640 as the
  narrow case. Every interactive element needs a real tap target.
- **Audio needs a gesture.** `app/game/audio.ts` creates the `AudioContext`
  lazily and ambience starts on the RAID tap. Never try to start audio on load.

## Not applicable

Sprite atlases, draw-call batching, WebGPU, physics, tilemap auto-tiling,
service workers. If a request seems to need one, it wants a bigger
architectural change than "add a 2D feature" — flag that.
