import type { Tag } from '../types';

export interface LordWeapon {
  id: string;
  name: string;
  tag: Tag;
  desc: string;
  goldCost: number;
}

export const LORD_WEAPONS: LordWeapon[] = [
  {
    id: 'lord-physical',
    name: "Nekrokos's Blade",
    tag: 'physical',
    desc: 'His weapon since the beginning. Punishes a Bound or Chilled hero.',
    goldCost: 0
  },
  {
    id: 'lord-fire',
    name: "Nekrokos's Brand",
    tag: 'fire',
    desc: 'Ignites a hero still slick with oil.',
    goldCost: 200
  },
  {
    id: 'lord-poison',
    name: "Nekrokos's Fang",
    tag: 'poison',
    desc: 'A second dose for a hero already poisoned.',
    goldCost: 150
  },
  {
    id: 'lord-frost',
    name: "Nekrokos's Chill",
    tag: 'frost',
    desc: 'Locks down an oiled hero solid — but puts out one already burning.',
    goldCost: 220
  }
];

export function lordWeapon(id: string): LordWeapon {
  return LORD_WEAPONS.find((w) => w.id === id) || LORD_WEAPONS[0];
}
