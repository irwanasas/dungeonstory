import type { TrapDef } from '../types';

export const TRAPS: TrapDef[] = [
  {
    id: 'spike',
    name: 'Spike Pit',
    tag: 'physical',
    damage: 14,
    dmgPerLevel: 3,
    applies: { kind: 'bleed', days: 3 },
    desc: 'One hard burst the moment they step in, and the wound keeps bleeding after.',
    goldCost: 12
  },
  {
    id: 'poison',
    name: 'Poison Gas',
    tag: 'poison',
    damage: 4,
    dmgPerLevel: 1,
    applies: { kind: 'poison', days: 3 },
    desc: 'Rots them for three days. Ticks ignore armour, so tanks rot in it.',
    goldCost: 16
  },
  {
    id: 'fire',
    name: 'Fire Jet',
    tag: 'fire',
    damage: 11,
    dmgPerLevel: 2.5,
    applies: { kind: 'burn', days: 3 },
    desc: 'Sets them alight. Against an oiled hero it more than doubles.',
    goldCost: 18
  },
  {
    id: 'frost',
    name: 'Frost Trap',
    tag: 'frost',
    damage: 7,
    dmgPerLevel: 1.5,
    applies: { kind: 'chill', days: 3 },
    desc: 'Chills them: dodge collapses and armour thins. Set up anything that swings.',
    goldCost: 16
  }
];

export function trapDef(id: string): TrapDef {
  const t = TRAPS.find((x) => x.id === id);
  return t || TRAPS[0];
}
