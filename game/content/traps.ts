import type { TrapDef } from '../types';

export const TRAPS: TrapDef[] = [
  {
    id: 'spike',
    name: 'Spike Pit',
    tag: 'physical',
    damage: 14,
    dmgPerLevel: 3,
    applies: null,
    desc: 'One hard burst the moment they step in. Kills fragile heroes before their plan begins.',
    goldCost: 12
  },
  {
    id: 'poison',
    name: 'Poison Gas',
    tag: 'poison',
    damage: 4,
    dmgPerLevel: 1,
    applies: { kind: 'poison', rooms: 3 },
    desc: 'Bleeds them for three rooms. Ticks ignore armour, so tanks rot in it.',
    goldCost: 16
  },
  {
    id: 'oil',
    name: 'Oil Slick',
    tag: 'oil',
    damage: 0,
    dmgPerLevel: 0,
    applies: { kind: 'oiled', rooms: 3 },
    desc: 'Harmless on its own. Put fire after it.',
    goldCost: 8
  },
  {
    id: 'fire',
    name: 'Fire Jet',
    tag: 'fire',
    damage: 11,
    dmgPerLevel: 2.5,
    applies: { kind: 'burn', rooms: 2 },
    desc: 'Sets them alight. Against an oiled hero it more than doubles.',
    goldCost: 18
  },
  {
    id: 'frost',
    name: 'Frost Trap',
    tag: 'frost',
    damage: 7,
    dmgPerLevel: 1.5,
    applies: { kind: 'chill', rooms: 2 },
    desc: 'Chills them: dodge collapses and armour thins. Set up anything that swings.',
    goldCost: 16
  },
  {
    id: 'net',
    name: 'Net Trap',
    tag: 'bind',
    damage: 3,
    dmgPerLevel: 0.5,
    applies: { kind: 'bound', rooms: 2 },
    desc: 'Binds them fast. No dodging, no raging, and physical hits land half again as hard.',
    goldCost: 18
  }
];

export function trapDef(id: string): TrapDef {
  const t = TRAPS.find((x) => x.id === id);
  return t || TRAPS[0];
}
