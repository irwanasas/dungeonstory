---
name: dungeon-content-design
description: >-
  Use when designing or tuning new dungeon content in Own a Dungeon — a new
  Stage puzzle, a new hero/monster/trap/treasure, a new world event, or
  Arcade scaling. Triggers on "level design", "new stage", "design a puzzle",
  "new room", "new event". Adapted from Donchitos/Claude-Code-Game-Studios'
  team-level workflow — the original spawns a six-agent studio team against a
  design/gdd/ document tree that does not exist here. This version is a
  single-session content pass against this game's real data files.
license: MIT
---

# Own a Dungeon — Content Design

Source: condensed from
[Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)'
`team-level` skill. There are no spatial levels here — a "level" is a Stage
entry, and content is data in `game/content/`. Solo work, no subagent team.

## Designing a Stage entry

1. **Read the neighbours** in `game/content/stages.ts` — a few before and
   after — so the new stage sits in the existing ramp.
2. **Name the teaching point in one sentence.** Every stage teaches exactly
   one thing ("a Net binds, and bound heroes cannot rage"). If you cannot say
   it, the stage has no identity yet.
3. **Check it is winnable under the two-per-room cap.** With fewer than three
   unlocked items the player cannot fill five rooms. This has already broken a
   stage once: after the cap landed, stage 1 offered only Spike and its
   best possible build won 0% of raids.
4. **Simulate before shipping.** Sample legal builds against the stage's own
   hero pool and Lord level; the best build should win comfortably and a
   careless one should not.
5. Set `unlockTraps` / `unlockMonsters` / `unlockTreasure` and `lordLevel`
   consistently with the neighbours.

## Designing new content

- **Where it lives:** `game/content/traps.ts`, `monsters.ts`, `heroes.ts`,
  `treasure.ts` for the definition; `statuses.ts` and `interactions.ts` for
  how it combines.
- **Express it through the generic system.** A new trap that applies an
  existing status, or a new status with `blocksTraits`, is right. A new
  hardcoded branch in `game/sim/` is wrong — that is the design rule the whole
  interaction table exists to protect.
- **Justify it against what exists.** New content should create a decision,
  not be a strictly better version of something already there.
- **Wire the whole path:** definition, any interaction entry, a sprite in
  `scripts/art/gen_entities.py`, and the Codex text if it needs explaining.
- **Check Arcade**, where everything is unlocked and the full roster shows up.

## Designing a world event

`game/content/worldEvents.ts`. An event with no `effect` is lore-only — that
is the entire lore/gameplay split, there is no second type. Keep durations
2–4 raids, and remember effects are clamped and capped at two active at once.
Chains are `leadsTo` entries rolled when an event expires; an event only
reachable through a chain is automatically kept out of the random pool.
