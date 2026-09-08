import type { StatusDef, StatusKind } from '../types';

function base(): Omit<StatusDef, 'kind' | 'name' | 'short' | 'desc'> {
  return {
    rooms: 2,
    dmgPerTick: 0,
    evasionDelta: 0,
    atkMult: 1,
    defMult: 1,
    fleeDelta: 0,
    blocksTraits: [],
    tags: []
  };
}

const STATUSES: Record<StatusKind, StatusDef> = {
  poison: {
    ...base(),
    kind: 'poison',
    name: 'Poisoned',
    short: 'PSN',
    rooms: 3,
    dmgPerTick: 5,
    tags: ['poison', 'nature'],
    desc: 'Loses health every round. Ticks ignore armour and mitigation.'
  },
  burn: {
    ...base(),
    kind: 'burn',
    name: 'Burning',
    short: 'BRN',
    rooms: 2,
    dmgPerTick: 8,
    blocksTraits: ['regen'],
    tags: ['fire'],
    desc: 'Heavy damage over time, and no wound closes while it burns. Frost puts it out.'
  },
  chill: {
    ...base(),
    kind: 'chill',
    name: 'Chilled',
    short: 'CHL',
    rooms: 2,
    evasionDelta: -0.28,
    defMult: 0.8,
    tags: ['frost'],
    desc: 'Slowed: much harder to dodge, thinner armour.'
  },
  weaken: {
    ...base(),
    kind: 'weaken',
    name: 'Weakened',
    short: 'WKN',
    rooms: 2,
    atkMult: 0.68,
    tags: ['arcane'],
    desc: 'Attacks hit far softer.'
  },
  oiled: {
    ...base(),
    kind: 'oiled',
    name: 'Oiled',
    short: 'OIL',
    rooms: 3,
    tags: ['oil'],
    desc: 'Drenched in oil. Anything on fire will catch.'
  },
  bound: {
    ...base(),
    kind: 'bound',
    name: 'Bound',
    short: 'BND',
    rooms: 2,
    evasionDelta: -1,
    blocksTraits: ['dodge', 'rage'],
    tags: ['bind'],
    desc: 'Tangled: cannot dodge and cannot work up a rage.'
  },
  fear: {
    ...base(),
    kind: 'fear',
    name: 'Afraid',
    short: 'FEAR',
    rooms: 2,
    atkMult: 0.8,
    fleeDelta: 0.2,
    tags: ['arcane'],
    desc: 'Shaken: strikes weakly and runs much sooner.'
  },
  greedy: {
    ...base(),
    kind: 'greedy',
    name: 'Greedy',
    short: 'GRD',
    rooms: 99,
    fleeDelta: -1,
    tags: [],
    desc: 'Will not leave the dungeon while there is loot in reach.'
  },
  brace: {
    ...base(),
    kind: 'brace',
    name: 'Bracing',
    short: 'BRC',
    rooms: 1,
    defMult: 2.2,
    tags: [],
    desc: 'Shield raised: the next room lands much softer.'
  },
  vanish: {
    ...base(),
    kind: 'vanish',
    name: 'Vanished',
    short: 'VAN',
    rooms: 1,
    evasionDelta: 0.6,
    tags: [],
    desc: 'Slipped into the dark: almost untouchable for a moment.'
  }
};

export function statusDef(kind: StatusKind): StatusDef {
  return STATUSES[kind];
}
