import type { TreasureDef } from '../types';

export const TREASURES: TreasureDef[] = [
  {
    id: 'hoard',
    name: 'Gold Hoard',
    gold: 30,
    goldPerLevel: 10,
    lure: 0.35,
    applies: null,
    desc: 'Bait. Greedy heroes stop to fill their pockets, and lingering costs them a round of whatever is already killing them.',
    goldCost: 20
  },
  {
    id: 'relic',
    name: 'Cursed Relic',
    gold: 12,
    goldPerLevel: 4,
    lure: 0.5,
    applies: { kind: 'greedy', rooms: 99 },
    desc: 'Whoever takes it will not leave without more. A looted hero can never flee — they die here instead.',
    goldCost: 28
  }
];

export function treasureDef(id: string): TreasureDef {
  const t = TREASURES.find((x) => x.id === id);
  return t || TREASURES[0];
}
