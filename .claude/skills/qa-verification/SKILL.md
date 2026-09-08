---
name: qa-verification
description: >-
  Use before calling any code change in Own a Dungeon "done" — codifies
  the type-check + build + real-browser verification pass this project
  already relies on. Triggers on "is this done", "verify", "test this",
  "did it work", or automatically before wrapping up a code change.
  Adapted from AlterLab-IEU/AlterLab_GameForge's game-qa-lead agent,
  trimmed from a formal test-plan/acceptance-criteria process to this
  project's actual lightweight verification habit.
license: MIT
---

# Own a Dungeon — Verification Pass

Source: condensed from
[AlterLab-IEU/AlterLab_GameForge](https://github.com/AlterLab-IEU/AlterLab_GameForge)'s
`game-qa-lead` agent, written for formal test plans and a dedicated QA
subagent. This project has no committed test suite and one maintainer, but it
does have a real, repeatedly-used verification habit — this writes it down.

## The standing bar for "done"

1. **`npm run type-check`** — zero errors. Strict TypeScript throughout.
   When a change renames a union member or a shared type, this is most of the
   proof: the compiler enumerates every consumer for you.
2. **`npx tsc --noEmit --noUnusedLocals --noUnusedParameters`** for cleanup
   work — catches unused imports and dead parameters that the normal pass
   allows.
3. **`npm run build`** — the static export must succeed. It is also the only
   way to catch basePath and asset-path problems, since `next dev` does not
   apply the GitHub Pages `basePath`.
4. **A real browser pass.** `npm run dev`, then drive the actual feature with
   Playwright at `/opt/pw-browsers/chromium`, headless. Check **390×844 and
   360×640** — this is a portrait mobile game and the narrow viewport has
   caught real clipping the wide one hid.
5. **Console must be clean.** A `pageerror`, a `console.error` or a 404 is a
   failure even if the screenshot looks right.

## Measure, don't eyeball

The habits that have actually caught bugs in this repo:

- **Assert on geometry, not on a screenshot.** `scrollWidth <= clientWidth`
  for clipping, `getBoundingClientRect()` for overlap. A rendered name that
  "looks fine" at 390 can clip at 360.
- **Give every simulated raid its own seed.** Sharing one RNG stream across a
  batch means any change to draw order diverges the whole run, and the numbers
  become noise. This produced a completely wrong balance conclusion once —
  weaker heroes appeared to produce *fewer* kills.
- **Read state from `localStorage`, not from the DOM**, when checking that
  something persisted.
- **Select by `aria-label` or text, not `nth-child`.** Positional selectors
  silently break when a tab is added to the row.

## Scoping the pass

Verify the golden path through what changed, plus what it visibly touches:

- **Content or balance** (`game/content/*`) → run the simulation directly in a
  harness (compile `game/**` with `tsc --module commonjs` and drive
  `simulateRaid`) over enough raids to be statistically meaningful, then one
  browser pass to confirm the numbers reach the UI.
- **A new sheet or overlay** → open it, exercise its controls, close it, at
  both viewports.
- **Raid presentation** (`useRaidDirector`) → watch a full raid end to end.
  Timing bugs live in the handoff between beats, not in one beat.
- **CSS** → confirm the change did not leak into another surface sharing the
  class, and that `border-image` frames still render.
- **A persisted field** → load a save written *before* the change and assert
  the migration path, not just the fresh-save path.

## Reporting

Name the commands run, the viewports checked, and what was confirmed. If
something could not be checked, say so rather than implying coverage. Do not
call a change verified from reading the diff.
