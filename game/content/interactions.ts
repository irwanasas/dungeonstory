import type { Interaction } from '../types';

export const INTERACTIONS: Interaction[] = [
  {
    id: 'oil-fire',
    incomingTag: 'fire',
    requiresStatus: 'oiled',
    consumes: true,
    dmgMult: 2.2,
    applies: 'burn',
    name: 'IGNITION',
    hint: 'Oil Slick then Fire Jet: the hero goes up like a torch.'
  },
  {
    id: 'bound-physical',
    incomingTag: 'physical',
    requiresStatus: 'bound',
    consumes: false,
    dmgMult: 1.5,
    name: 'PINNED',
    hint: 'A bound hero cannot dodge — physical hits land clean.'
  },
  {
    id: 'chill-physical',
    incomingTag: 'physical',
    requiresStatus: 'chill',
    consumes: false,
    dmgMult: 1.2,
    name: 'BRITTLE',
    hint: 'Chilled armour cracks. Frost first, then anything that swings.'
  },
  {
    id: 'poison-stack',
    incomingTag: 'poison',
    requiresStatus: 'poison',
    consumes: false,
    dmgMult: 1.3,
    applies: 'poison',
    name: 'CONCENTRATED',
    hint: 'A second dose of poison bites deeper and lasts longer.'
  },
  {
    id: 'burn-frost',
    incomingTag: 'frost',
    requiresStatus: 'burn',
    consumes: true,
    dmgMult: 0.5,
    name: 'DOUSED',
    hint: 'Frost puts out a burning hero. Do not stack them.'
  },
  {
    id: 'oil-frost',
    incomingTag: 'frost',
    requiresStatus: 'oiled',
    consumes: false,
    dmgMult: 1.0,
    applies: 'bound',
    name: 'FROZEN SLICK',
    hint: 'Frost over oil sets solid and holds the hero fast.'
  }
];

export function findInteraction(tag: string, has: (k: string) => boolean): Interaction | null {
  for (const i of INTERACTIONS) {
    if (i.incomingTag === tag && has(i.requiresStatus)) return i;
  }
  return null;
}
