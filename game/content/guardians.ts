import type { StatusKind } from '../types';

export interface GuardianKit {
  id: string;
  name: string;
  count: number;
  effect: string;
  counters: string;
  lordHp: number;
  lordAtk: number;
  lordPierce: number;
  guardHp: number;
  guardAtk: number;
  guardPierce: number;
  guardRegen: number;
  keepSplit: boolean;
  opener: { kind: StatusKind; days: number } | null;
}

const BASE = {
  count: 1,
  lordHp: 1,
  lordAtk: 1,
  lordPierce: 0,
  guardHp: 1,
  guardAtk: 1,
  guardPierce: 0,
  guardRegen: 0,
  keepSplit: false,
  opener: null
};

export const GUARDIANS: GuardianKit[] = [
  {
    ...BASE,
    id: 'goblin',
    name: 'Goblin Pair',
    count: 2,
    guardAtk: 1.15,
    effect: 'Two goblins, swinging 15% harder. Early pressure before a ramp can start.',
    counters: 'Elementalist'
  },
  {
    ...BASE,
    id: 'archer',
    name: 'Skeleton Marksman',
    lordPierce: 0.3,
    guardPierce: 0.3,
    effect: 'Nekrokos and the archer both punch 30% further through armour.',
    counters: 'Paladin'
  },
  {
    ...BASE,
    id: 'ogre',
    name: 'Ogre Bulwark',
    lordHp: 1.2,
    guardHp: 1.2,
    effect: 'Nekrokos and the ogre each carry 20% more health. Nothing bursts them down.',
    counters: 'Assassin'
  },
  {
    ...BASE,
    id: 'slime',
    name: 'Twin Slimes',
    count: 2,
    guardRegen: 0.04,
    keepSplit: true,
    effect: 'Two slimes that still split when wounded, and knit themselves back together slowly.',
    counters: 'Sustain and attrition'
  },
  {
    ...BASE,
    id: 'shadow',
    name: 'Shadow Warden',
    opener: { kind: 'paralyzed', days: 2 },
    effect: 'The shadow opens with paralysis instead of fear — there is nowhere to run at the Throne.',
    counters: 'A generalist opener'
  }
];

export function guardianKit(id: string): GuardianKit {
  return GUARDIANS.find((g) => g.id === id) || GUARDIANS[0];
}
