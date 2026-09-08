import type { StageDef } from '../types';

interface Seed {
  title: string;
  teaches: string;
  heroes: string[];
  traps?: string[];
  monsters?: string[];
  treasure?: string[];
  lord: number;
  heroLevel: number;
}

const SEEDS: Seed[] = [
  { title: 'First Blood', teaches: 'A trap hits once. A monster fights back. Put both in, press RAID, and watch.', heroes: ['paladin'], traps: ['spike'], monsters: ['goblin'], lord: 2, heroLevel: 1 },
  { title: 'The Long Cough', teaches: 'Poison ticks for three rooms and ignores armour. Tanks rot in it.', heroes: ['paladin'], traps: ['poison'], lord: 2, heroLevel: 1 },
  { title: 'Only So Many', teaches: 'The same trap or monster fits in two rooms at most. Mix them, or leave a room empty.', heroes: ['paladin', 'druid'], lord: 1, heroLevel: 2 },
  { title: 'The Green Mender', teaches: 'The Druid heals every round. Out-damage her or burst her down.', heroes: ['druid'], lord: 2, heroLevel: 2 },
  { title: 'Slick', teaches: 'Oil does nothing alone.', heroes: ['paladin', 'druid'], traps: ['oil'], lord: 2, heroLevel: 2 },
  { title: 'Ignition', teaches: 'Oil Slick, then Fire Jet. Order is the whole trick.', heroes: ['paladin', 'druid', 'berserker'], traps: ['fire'], lord: 2, heroLevel: 3 },
  { title: 'Bloodmane', teaches: 'Wounding the Berserker makes him stronger. He never retreats.', heroes: ['berserker'], lord: 2, heroLevel: 3 },
  { title: 'Deep Cold', teaches: 'Frost strips dodge and thins armour. It sets up everything else.', heroes: ['berserker', 'trickster'], traps: ['frost'], lord: 3, heroLevel: 3 },
  { title: 'The Unseen', teaches: 'The Trickster dodges half of everything and disarms traps. Chill her first.', heroes: ['trickster'], lord: 3, heroLevel: 4 },
  { title: 'Two Quick Hands', teaches: 'Goblins swing twice. Against a chilled hero that is four chances to land.', heroes: ['trickster', 'paladin'], monsters: ['archer'], lord: 3, heroLevel: 4 },
  { title: 'Tangled', teaches: 'A Net binds. Bound heroes cannot dodge and cannot rage.', heroes: ['berserker', 'trickster'], traps: ['net'], lord: 3, heroLevel: 4 },
  { title: 'Nightfall', teaches: 'The Assassin deletes one monster instantly, then has nothing left.', heroes: ['assassin'], monsters: ['slime'], lord: 4, heroLevel: 5 },
  { title: 'Split Decision', teaches: 'A Slime splits and keeps coming. Burst heroes cannot finish it.', heroes: ['assassin', 'trickster'], lord: 4, heroLevel: 5 },
  { title: 'Bait', teaches: 'Treasure makes greedy heroes linger — right inside whatever is killing them.', heroes: ['trickster', 'assassin'], treasure: ['hoard'], lord: 4, heroLevel: 5 },
  { title: 'The Rising Storm', teaches: 'The Elementalist grows every round. End fights fast or deny the ramp.', heroes: ['elementalist'], lord: 4, heroLevel: 6 },
  { title: 'Heavy Hands', teaches: 'The Ogre winds up, then removes most of a hero. Healers cannot keep up.', heroes: ['druid', 'elementalist'], monsters: ['ogre'], lord: 5, heroLevel: 6 },
  { title: 'No Way Out', teaches: 'A Cursed Relic makes a hero unable to flee. They die in your dungeon instead.', heroes: ['trickster', 'assassin', 'elementalist'], treasure: ['relic'], lord: 5, heroLevel: 6 },
  { title: 'Things That Watch', teaches: 'The Shadow frightens heroes into running early — unless they are fearless.', heroes: ['assassin', 'druid', 'elementalist'], monsters: ['shadow'], lord: 5, heroLevel: 7 },
  { title: 'Everything At Once', teaches: 'Six rooms, one chain. Make each room set up the next.', heroes: ['paladin', 'berserker', 'trickster', 'assassin', 'druid', 'elementalist'], lord: 4, heroLevel: 8 },
  { title: 'The Throne', teaches: 'They all come. Only Nekrokos stands behind you now.', heroes: ['paladin', 'berserker', 'trickster', 'assassin', 'druid', 'elementalist'], lord: 5, heroLevel: 9 }
];

export const STAGES: StageDef[] = SEEDS.map((s, i) => ({
  id: i + 1,
  title: s.title,
  teaches: s.teaches,
  heroPool: s.heroes,
  unlockTraps: s.traps || [],
  unlockMonsters: s.monsters || [],
  unlockTreasure: s.treasure || [],
  lordLevel: s.lord,
  heroLevel: s.heroLevel
}));

export const STAGE_MAX = STAGES.length;

export function unlockStageOf(id: string): number {
  for (const s of STAGES) {
    if (s.unlockTraps.includes(id) || s.unlockMonsters.includes(id) || s.unlockTreasure.includes(id)) return s.id;
  }
  return 1;
}

export function stageDef(id: number): StageDef {
  return STAGES[Math.min(Math.max(1, id), STAGE_MAX) - 1];
}
