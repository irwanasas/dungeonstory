---
name: ux-design
description: >-
  Use when changing player-facing flow, onboarding, HUD legibility, or
  accessibility in Own a Dungeon — new sheets, new buttons or tabs, touch
  target sizing, or anything about whether a screen is clear on a small
  portrait viewport. Triggers on "onboarding", "UX", "accessibility",
  "confusing", "hard to tell", "mobile layout". Adapted from
  AlterLab-IEU/AlterLab_GameForge's game-ux-designer agent, trimmed to this
  project's single-screen mobile-first UI.
license: MIT
---

# Own a Dungeon — UX

Source: condensed from
[AlterLab-IEU/AlterLab_GameForge](https://github.com/AlterLab-IEU/AlterLab_GameForge)'s
`game-ux-designer` agent, written for multi-screen productions with formal
usability rounds. This game is one portrait screen plus sheets.

## The screen

Fixed vertical stack, no page scroll ever: HUD plate, tab row (World, Stage,
Arcade, Codex, Settings), the scrolling dungeon, the room pip strip, the hero
teaser, the bottom bar (Build, RAID, Upgrade). The dungeon takes the
remaining height, and **that is the budget** — adding a persistent row takes
height from the thing the game is about. Prefer folding new information into
the teaser, a pip, a badge on an existing tab, or a sheet.

Sheets slide from the bottom, at most one open at a time, built on the shared
`Sheet` primitive in `app/game/panels/`. Modals (result, offline) sit centred
above a scrim.

## Rules that hold here

- **Two viewports, always: 390×844 and 360×640.** The narrow one is where
  clipping shows up. Assert `scrollWidth <= clientWidth` rather than judging
  from a screenshot.
- **Touch targets ≥ 44px** on the short axis. The pip strip and the sheet
  close button have both had to grow to meet this.
- **No page scroll.** `body` is `overflow: hidden`; the dungeon scrolls
  horizontally with `touch-action: pan-x` so a vertical drag never moves the
  page.
- **Destructive actions arm first.** Reset Game turns the row into the danger
  frame with an explicit warning and a No/Erase pair. One tap never destroys
  data.
- **Say what changed and why.** The result panel names what killed the hero,
  which combination fired, and what the world did. A number moving without an
  explanation is a UX failure even when the maths is right.
- **Onboarding is the tutorial step machine**, not a wall of text: a coach
  bubble anchored near the relevant control, advanced by doing the thing.
  Steps live in `app/game/overlays.tsx`; the step index is persisted, so a
  change to the sequence has to consider players mid-tutorial.

## Before shipping a flow change

1. Can the player tell what happened without opening a sheet?
2. Does it survive 360×640 without clipping or overlap?
3. Is every new control ≥44px and reachable one-handed near the bottom?
4. Does anything irreversible have a confirmation step?
5. If it adds vertical furniture, what did it take height from?
