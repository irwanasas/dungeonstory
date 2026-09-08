---
name: game-design-loop
description: >-
  Use when the user asks about game mechanics, core loop pacing, matchup
  balance, the gold/soul economy, upgrade progression, or Stage/Arcade/World
  design in Own a Dungeon. Triggers on "balance", "mechanic", "core loop",
  "progression", "economy", "matchup", "difficulty curve". Adapted from
  AlterLab-IEU/AlterLab_GameForge's game-designer agent — trimmed from a
  fictional-persona, multi-agent studio role to a direct-advice skill
  scoped to this game's actual systems.
license: MIT
---

# Own a Dungeon — Mechanics & Balance

Source: condensed from
[AlterLab-IEU/AlterLab_GameForge](https://github.com/AlterLab-IEU/AlterLab_GameForge)'s
`game-designer` agent. The original is a persona-driven role spawned inside a
multi-role studio pipeline. This version keeps the useful frameworks and
applies them to this game's real systems — no persona, no subagents.

## This game's actual systems

- **Depth comes from one interaction table, not a matchup matrix.** Every hit
  carries a `Tag`; every status carries tags and may carry `blocksTraits`;
  `game/content/interactions.ts` decides what happens when they meet. Oil then
  Fire is ignition. A Net blocks the Berserker's rage because `bound` blocks
  the `rage` trait — not because of a hero-specific branch. **There are no
  per-hero special cases anywhere, and adding one is the wrong move.**
- **Content:** 6 heroes (paladin, berserker, trickster, assassin, druid,
  elementalist, in warrior/rogue/mage families), 5 monsters (goblin, archer,
  slime, ogre, shadow), 6 traps (spike, poison, oil, fire, frost, net), 2
  treasures (hoard, relic), and Nekrokos the Demon Lord in the Throne Room.
- **The two-per-room cap** (`MAX_PER_ID`) means five rooms need at least three
  different ideas. Any balance proposal has to work inside it.
- **Two progression tracks stay distinct:** 20 hand-authored stages in
  `game/content/stages.ts`, each teaching one thing; Arcade is unbounded wave
  scaling with the full roster. A stage fix must not leak into Arcade scaling.
- **Economy:** gold buys levels (`upgradeCost`, `base × 1.8 × 1.5^n`); souls
  buy Lord levels and unlocks ahead of their stage gate, priced by how far
  ahead you are reaching. Both live in `game/state/economy.ts`.
- **The world layer** (`game/state/world.ts`) applies temporary modifiers via
  one resolved object from `worldModifiers()`. Anything reading world state
  reads that, never the active-event list.

## Core-loop framing

- **Per room:** can the player tell *why* a room went the way it did from the
  HP bars, floating numbers and reaction line alone? If not, that is a design
  bug before it is a balance bug.
- **Per raid (6 rooms):** does room order matter, or does one arrangement win
  everywhere? Check the interaction table for a combination with no counter.
- **Session:** do Stage and Arcade still both have a reason to exist?
- **Long run:** does income outpace upgrade costs (inflation) or fall behind
  (grind wall)? Current target is roughly 0.6 raids of income per upgrade
  early, rising to ~3.5 late.

## Before proposing a number

**Measure it.** This game's combat is discrete — integer damage, rounds-to-kill
thresholds, flee thresholds, rage triggers. Small multipliers do not produce
small outcome changes: +2% hero ATK and +10% both move some matchups by ~26
percentage points, because either crosses a rounding boundary or neither does.
Anything that touches combat stats has to be simulated across several dungeons
and all six heroes with per-raid seeds before you can claim it is mild.
Economy multipliers are the exception — they cannot touch combat at all.

For open-ended "what should we add", use `feature-brainstorm` first, then
`dungeon-content-design` for the specifics.
