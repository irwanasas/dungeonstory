---
name: design-review
description: >-
  Use when reviewing a proposed mechanic, balance change, or content addition
  in Own a Dungeon before implementing it — checks completeness, internal
  consistency, and implementability. Triggers on "review this design", "does
  this make sense", "before I build this". Adapted from
  Donchitos/Claude-Code-Game-Studios' design-review skill — the original
  reviews a formal GDD against a design/gdd/ tree and spawns specialist
  subagents; this version reviews a change directly against the game's real
  systems, single-session.
license: MIT
---

# Own a Dungeon — Design Review

Source: condensed from
[Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)'
`design-review`. No GDD directory and no subagents here — same checks, one
pass, against the real data files.

## What to check

**Completeness**
- What changes on screen, in the outcome, or in the economy?
- What is the exact rule, not the intent? "Stronger against poison" is not
  implementable; "`resist: ['poison']`, which halves duration and potency in
  `applyStatus`" is.
- Edge cases: at 0 HP, at max level, on the first stage it exists, under the
  two-per-room cap, in Arcade, with a world effect active.
- What does it depend on and what depends on it?

**Consistency**
- Does it express itself through the generic systems — a `Tag`, a status with
  `blocksTraits`, an `INTERACTIONS` entry — or does it want a hero-specific
  branch in `game/sim/`? The second is a red flag; the whole depth model
  exists to avoid it.
- Does it stack with an existing interaction into something with no counter?
- Does it hold in both Stage and Arcade?
- Can the player *see* it happen? An effect with no visible tell is a UX
  problem regardless of the maths.

**Implementability**
- Does it fit `game/content` → `game/sim` → `app/game`, or does it imply a new
  layer that should be called out first?
- Is any part a hand-wave — a described effect with no mechanism?
- **Does it touch combat stats?** If so it cannot be reviewed on intuition.
  Discrete damage rounding means small multipliers do not produce small
  outcome changes; it needs simulating across several dungeons and all six
  heroes with per-raid seeds before anyone can claim it is balanced.

## Output

```
## Review: [change]

Completeness: [specified / missing]
Consistency: [conflicts with the interaction table or an existing status]
Implementability: [fits the layers, or not]

Blocking:
- ...
Recommended:
- ...

Verdict: [ready / needs another pass on X]
```

Escalate a genuine architecture question to `tech-architecture`, and a
half-formed idea to `feature-brainstorm` rather than reviewing it into shape.
