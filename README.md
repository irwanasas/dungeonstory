# Own a Dungeon

A mobile-first browser game. You do not play the hero — you own the dungeon
they walk into.

Build five rooms, leave the Throne Room to Nekrokos, send the heroes in, and
watch them try to get through. They decide what to fight, what to loot, and
when to run. You only get to decide what is waiting for them.

Play: <https://irwanasas.github.io/ownadungeon/>

## What is this game?

Own a Dungeon flips the usual roguelike around. Instead of controlling a hero
who explores a dungeon, you are the dungeon owner. You place traps, monsters,
and treasure ahead of time, then a hero walks in on their own and you watch
what happens. Win by killing or breaking the hero before they reach your
Throne Room; lose gold if they get through.

## How to play

1. **Build** — open the Rooms tab and fill your rooms with traps, monsters,
   and treasure. Every run tests the layout you leave behind.
2. **Send them in** — start a Campaign from the Campaign tab, or a one-off
   Rush or Arcade run from Explore. Heroes move through your rooms on their
   own, making their own choices.
3. **Watch** — fights play out automatically with full combat animation. You
   cannot intervene once one starts.
4. **Reward** — you collect gold and souls based on how far they got and how
   it ended.
5. **Upgrade** — spend gold and souls on the Upgrades sub-tab to level your
   content and the Dungeon Lord himself.
6. **Redesign** — go back to Rooms and rethink the layout.

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
| Berserker | Rages when badly wounded, never retreats | Bind him and the rage never starts |
| Trickster | Dodges roughly half of everything, disarms traps | Chill or bind strips her dodge |
| Assassin | Devastating opening strike, very fragile | Anything that survives the opener kills him |
| Druid | Heals every round, shrugs off poison | Burning shuts her healing off |
| Elementalist | Grows stronger every round of a fight | Kill him fast, or slow the ramp with a debuff |

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
- **Souls** are the rarer currency, spent on the Dungeon Lord's level, his
  weapons, and the talent ladder. Runs pay a few; mastery challenges pay the
  rest.
- **Campaign** — the main mode. Ten campaigns, each a multi-day march to your
  gate. See below.
- **Rush** — one hero, five rooms plus the Throne, settled in a single pass.
  Difficulty ramps across the 20 stages.
- **Arcade** — endless waves with escalating difficulty and a random hero from
  the full roster. Your best wave is tracked.
- **Offline progress** — your dungeon keeps raiding while you're away, for up
  to 8 hours, and reports what happened when you return.

## Campaign mode

A campaign is not one raid — it's a march. Heroes take days to reach you, and
the road does things to them before they arrive.

- **Six checkpoints.** Each one is a fight at the next room in your dungeon.
  Between them are narrative days: choices, altars, omens and ecosystem events
  that leave the party blessed, cursed, oiled, chilled or bleeding.
- **Ten campaigns.** Campaign number sets the length — 18 days for 1-3, 24 for
  4-6, 30 for 7-10 — the party size (one hero for 1-3, two for 4-7, three for
  8-10, three waves each) and which hero family leads the march, cycling
  warriors, rogues, mages.
- **King Arthur** arrives at the Throne. If your dungeon wipes the last wave
  before it, he comes alone and hits twice as hard.
- **Nekrokos's Guardian** is picked before the march and sets his kit for the
  Throne fight. It cannot be changed once the gate opens.
- Your best days-survived is kept per campaign number.

## Trophies, records and challenges

Three things are kept for you in the Codex, on top of the stage ladder.

- **Trophies** — 21 entries. Most are surprises: the game's named combinations,
  King Arthur arriving alone, Nekrokos landing a combo with his own attack.
  These read `???` until you actually cause them, then reveal their name and
  what happened. Two sets are chase-able instead — beat a Throne fight with
  each of the five Guardians, beat a King Arthur of each of the six hero
  classes — and show their name and goal up front so you can aim at them,
  just greyed out until earned. Unlocking any trophy pops a short toast. They
  cost nothing and grant nothing; they're a record of what you've figured out.
- **Hall of Fame** — heroes who had a real career in your dungeon: one who
  reached their peak without you ever killing them, one who walked out alive
  carrying two scars, one who came back for a twentieth raid. Entries stay after
  the hero dies or drops out of your active roster. It's a memorial, not a
  roster.
- **Mastery challenges** — seven constraint puzzles, listed openly so you can
  aim at them, each paying souls the first time you clear it. One asks you to
  win a raid without a single trap in the dungeon, another to clear the
  campaign ladder up through Campaign 10; others want a specific dungeon
  shape, or a hero who never touched your treasure. Most are checked in Stage
  mode (a few only open up from a later stage); the campaign one only clears
  from inside a march.

## World events

Every few runs, a herald brings news from outside your dungeon: rumours,
wars, plagues, discoveries, festivals, and other fantasy events. Some news is
pure flavour. Other events temporarily change the rules for a handful of
raids — a war might make warriors hit harder, a drought might make fire bite
deeper, a pilgrim season might swell the souls you earn. Some events lead
into later ones, so a small skirmish can escalate into a war and then fade
into something else entirely.

At most two effects are active at once, and every effect is temporary and
capped, so the world nudges your strategy without ever locking you out of a
raid. Campaign day-events cover the same ground from inside a march.

## Controls

Five tabs along the bottom:

- **Shop** — buy and equip Nekrokos's Lord Weapon, which sets the damage type
  his own blows carry at the Throne.
- **Rooms** — the room grid and your Dungeon Power, plus an Upgrades sub-tab
  for the Lord, his weapons and your content levels.
- **Campaign** — the campaign card and the start of a march.
- **Talents** — a 30-node ladder bought with souls; each node adds a flat
  HP/attack/defence/trap-damage bonus across everything you own.
- **Explore** — one-off Rush and Arcade runs.

Along the top: an announcements slot on the left, Codex and Settings on the
right. The Codex has three tabs — Dungeon, Heroes and Challenges. During a
fight, swipe left and right to look through your rooms.

## Credits

Created by **xanaksetan**.

- Instagram: <https://www.instagram.com/xanaksetan>
- GitHub: <https://github.com/irwanasas>

All Rights Reserved 2026.

---

## Version log

| When (UTC) | Change |
| --- | --- |
| 2026-09-12 19:57 | Campaign-era trophies (King Arthur solo, per-Guardian, per-King-class, full-circle) and the campaign-ten challenge |
| 2026-09-11 21:09 | Dungeon talent ladder added, bought with souls |
| 2026-09-10 14:22 | Lord weapons gated by price; Shop tab made functional |
| 2026-09-09 14:19 | Explore tab with Rush and Arcade unified under it |
| 2026-09-09 13:02 | Five-tab bottom nav replaces the three-button bar |
| 2026-09-09 06:17 | Expedition rework complete: King Arthur, Guardian kits, intel screen |
| 2026-09-09 05:39 | Status ailment procs and ecosystem events |
| 2026-09-09 05:04 | Squad combat, waves and tag knowledge |
| 2026-09-09 04:35 | Expedition skeleton replaces the single-raid loop |
| 2026-09-08 22:15 | Initial project import |
