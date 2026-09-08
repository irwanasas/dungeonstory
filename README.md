# Own a Dungeon

A mobile-first browser game. You do not play the hero — you own the dungeon
they walk into.

Build five rooms, leave the Throne Room to Nekrokos, press RAID, and watch an
autonomous hero try to get through. They decide what to fight, what to loot,
and when to run. You only get to decide what is waiting for them.

Play: <https://irwanasas.github.io/ownadungeon/>

## What is this game?

Own a Dungeon flips the usual roguelike around. Instead of controlling a hero
who explores a dungeon, you are the dungeon owner. You place traps, monsters,
and treasure ahead of time, then a hero walks in on their own and you watch
what happens. Win by killing or breaking the hero before they reach your
Throne Room; lose gold if they get through.

## How to play

1. **Build** — tap Build and fill your rooms with traps, monsters, and
   treasure. Each raid tests the layout you leave behind.
2. **Raid** — press RAID. A hero enters and moves through your rooms on
   their own, room by room, making their own choices.
3. **Watch** — the raid plays out automatically with full combat animation.
   You cannot intervene once it starts.
4. **Reward** — when the raid ends you collect gold and souls based on how
   far the hero got and how it ended.
5. **Upgrade** — spend gold and souls to level up your rooms, your content,
   and the Dungeon Lord himself.
6. **Redesign** — go back to Build and rethink the layout for the next raid.

## Core gameplay loop

```
BUILD -> RAID -> WATCH -> REWARD -> UPGRADE -> REDESIGN
```

The depth of the game isn't bigger numbers, it's combinations. Every trap and
monster carries a damage type, and most leave something behind — a hero can be
slick with oil, chilled, bound, poisoned or burning when they walk into the next
room. What's already on them changes what the next room does to them, and a
hero's own traits (armour, dodge, rage, healing) decide the rest.

The strongest of these pairings have names, and the game will announce one the
moment you cause it. Working out what goes with what is the actual game — the
Codex keeps a list, but every entry stays blank until you've pulled it off
yourself.

A Cursed Relic is the sharpest tool available: a hero who loots it can no
longer flee, so they have to die in your dungeon instead of walking out with
your gold.

Each trap or monster can only be placed in **two rooms per raid**, so a good
dungeon needs variety, not one trick repeated five times.

## Heroes and archetypes

Heroes are autonomous — you never control them. Each one has a real identity
and a real counter, so knowing who is coming (or building to handle any of
them) is the whole strategic layer:

| Hero | Identity | Counter |
| --- | --- | --- |
| Paladin | Mitigates most direct hits, immune to fear | Poison and burn tick past his armour |
| Berserker | Rages when badly wounded, never retreats | A Net stops him from raging |
| Trickster | Dodges roughly half of everything, disarms traps | Chill or Net strips her dodge |
| Assassin | Devastating opening strike, very fragile | Anything that survives the opener kills him |
| Druid | Heals every round, shrugs off poison | Burning shuts her healing off |
| Elementalist | Grows stronger every round of a fight | Kill him fast, or slow the ramp with a Net or a debuff |

Heroes are named and remembered. They persist between raids, gain levels over
time, and come back scarred by what killed them — a hero who nearly died to
poison once may return more resistant to it. Your dungeon shapes who they
become.

## Dungeon / room system

Your dungeon is a fixed corridor you scroll through horizontally:

```
ENTRANCE -> ROOM 1..5 (yours to design) -> THRONE ROOM (permanent)
```

- The five rooms in the middle are yours: fill each with a trap, a monster,
  treasure, or leave it empty.
- The Throne Room can't be edited — it's always the final encounter, guarded
  by **Nekrokos the Demon Lord**, who grows stronger as you upgrade him.
- A hero enters at the Entrance and moves room by room toward the Throne
  Room, reacting to whatever they find along the way.

## Progression and resources

- **Gold** is earned from raids and spent leveling up the traps, monsters,
  and treasure you own.
- **Souls** are the rarer currency, used to upgrade the Dungeon Lord and to
  unlock content early, ahead of the stage that would normally grant it —
  the further ahead you reach, the more it costs. Raids pay a few; mastery
  challenges pay the rest.
- **Stage mode** — 20 handcrafted stages, each one built around teaching or
  testing a specific idea, with unlocks tied to progress.
- **Arcade mode** — endless waves with escalating difficulty and a random
  hero each time, for testing your dungeon without a script. Your best wave
  is tracked.
- **Offline progress** — your dungeon keeps raiding while you're away, for up
  to 8 hours, and reports what happened when you return.

## Trophies, records and challenges

Three things are kept for you in the Codex, on top of the stage ladder.

- **Trophies** — eight discoveries, one for each of the game's named
  combinations plus a couple of other notable moments. Every trophy reads `???`
  until you actually cause it, then reveals its name and what it was. They cost
  nothing and grant nothing; they're a record of what you've figured out.
- **Hall of Fame** — heroes who had a real career in your dungeon: one who
  reached their peak without you ever killing them, one who walked out alive
  carrying two scars, one who came back for a twentieth raid. Entries stay after
  the hero dies or drops out of your active roster. It's a memorial, not a
  roster.
- **Mastery challenges** — six constraint puzzles, listed openly so you can aim
  at them, each paying souls the first time you clear it. One asks you to win a
  raid without a single trap in the dungeon; others want a specific dungeon
  shape, or a hero who never touched your treasure. They're checked in Stage
  mode, and a few only open up from a later stage.

## World Announcer / events

Every few raids, a herald brings news from outside your dungeon: rumours,
wars, plagues, discoveries, festivals, and other fantasy events. Some news is
pure flavour. Other events temporarily change the rules for a handful of
raids — a war might make warriors hit harder, a drought might make fire bite
deeper, a pilgrim season might swell the souls you earn. Some events lead
into later ones, so a small skirmish can escalate into a war and then fade
into something else entirely.

At most two effects are active at once, and every effect is temporary and
capped, so the world nudges your strategy without ever locking you out of a
raid. Open the World tab any time to see what's currently in effect and what
has happened before.

## Controls

- **Build** (bottom left) — open the build panel to place or change what's in
  your rooms.
- **RAID** (bottom center) — start a raid with your current layout.
- **Upgrade** (bottom right) — spend gold and souls on upgrades.
- **The World** (top left icon) — see active world events and past ones.
- **Stage / Arcade** (top tabs) — switch between the two modes.
- **Codex** (top icon) — three tabs: Dungeon (this stage's brief and your
  trophies), Heroes (the archetypes, your veterans, the Hall of Fame), and
  Challenges.
- **Settings** (top right icon) — records, language, reset game, and credits.
- Swipe or scroll left and right to look through your dungeon's rooms.

## Credits

Created by **xanaksetan**.

- Instagram: <https://www.instagram.com/xanaksetan>
- GitHub: <https://github.com/irwanasas>

All Rights Reserved 2026.
