---
name: feature-brainstorm
description: >-
  Use when the user wants to explore ideas for new content or features in Own
  a Dungeon without a settled direction yet — "what could we add", "ideas for
  a new trap", "what should the next stage arc be". Triggers on "brainstorm",
  "ideas for", "what should we add", "not sure what to build next". Adapted
  from Donchitos/Claude-Code-Game-Studios' brainstorm skill — the original is
  a from-zero "invent a new game" process; this version points the same
  facilitation at an already-shipped game.
license: MIT
---

# Own a Dungeon — Feature & Content Brainstorm

Source: condensed from
[Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)'
`brainstorm`, which walks from zero to a new game concept. Own a Dungeon has
a settled concept — build a dungeon, send in an autonomous hero, watch. This
keeps the facilitation discipline and points it at what to add next.

## Principles

- Generate before filtering; "yes, and" over "but".
- Use the real constraints as fuel: no server, `localStorage` only, one
  portrait screen plus sheets, six rooms with a two-per-room cap, 6 heroes ×
  5 monsters × 6 traps × 2 treasures, one interaction table, a world event
  layer, Stage and Arcade. A good idea works inside those, or names the one
  it wants to change.
- Anchor every idea to a gap: does it add a **decision** to the room-order
  puzzle, a **sink** for gold or souls, a **progression hook**, or a **reason
  to come back**?

## Techniques worth keeping

**Mashup** — combine an existing system with a new angle and see if the
tension produces a hook. Scoped to this game: "the interaction table + a
consumable one-shot trap" (scarcity makes placement harder), "world events +
a player choice about which rumour to encourage", "the persistent hero roster
+ a named rival who keeps coming back stronger", "the Throne fight + a second
phase once Nekrokos drops below half".

**Push the existing systems before adding one.** Most good additions here are
data, not code: a new status with a `blocksTraits`, a new interaction row, a
new world event chain. Ask whether the idea can be expressed that way before
proposing a new subsystem — it usually can, and it stays balanced for free.

## Output

Two or three concrete directions, each with the gap it fills and roughly what
it would touch. Then hand off: `dungeon-content-design` for the specifics,
`design-review` before implementing, `game-design-loop` if it is really a
balance question.
