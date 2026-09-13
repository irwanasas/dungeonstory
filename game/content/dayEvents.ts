import type { DayEvent, WorldEffect } from '../types';

export const DAY_EVENTS: DayEvent[] = [
  {
    id: 'quiet-road',
    kind: 'narrative',
    category: 'neutral',
    title: 'A Quiet Stretch',
    body: 'Nothing on the road but wind and old cart tracks. They make good ground and camp early.',
    weight: 10,
    tiers: ['early', 'mid', 'late'],
    options: []
  },
  {
    id: 'cold-camp',
    kind: 'narrative',
    category: 'neutral',
    title: 'Cold Camp',
    body: 'No dry wood for a fire. They sleep in their armour and wake stiff, but they wake.',
    weight: 8,
    tiers: ['early', 'mid', 'late'],
    options: []
  },
  {
    id: 'crow-omen',
    kind: 'narrative',
    category: 'omen',
    title: 'Crows Going The Other Way',
    body: 'Every bird on the ridge is flying away from your gate. One of them is carrying something bright.',
    weight: 6,
    tiers: ['early', 'mid', 'late'],
    options: []
  },
  {
    id: 'spilled-lamp',
    kind: 'choice',
    category: 'cursed',
    title: 'The Overturned Cart',
    body: 'A merchant cart lies broken across the path, lamp oil spreading dark and slow across the stones.',
    weight: 7,
    tiers: ['early', 'mid', 'late'],
    tags: ['oil', 'fire'],
    options: [
      {
        id: 'wade',
        label: 'Wade through it',
        hint: 'Faster, but they come out soaked to the knee.',
        applyStatus: { kind: 'oiled', to: 'party' }
      },
      {
        id: 'around',
        label: 'Go around the wreck',
        hint: 'Clean boots, lost hours — and something in the deep hall stirs uneasily.',
        lordHpDelta: -0.05
      }
    ]
  },
  {
    id: 'bramble-hollow',
    kind: 'choice',
    category: 'cursed',
    title: 'Bramble Hollow',
    body: 'The shortcut runs through a hollow of black thorn. It would save a day. It would also cost skin.',
    weight: 7,
    tiers: ['early', 'mid', 'late'],
    tags: ['bind', 'physical'],
    options: [
      {
        id: 'cut-through',
        label: 'Cut through the thorns',
        hint: 'The vines catch and hold. Bound.',
        applyStatus: { kind: 'bound', to: 'party' }
      },
      {
        id: 'long-way',
        label: 'Take the long way',
        hint: 'No thorns. No rest either — and word of the delay reaches the deep hall.',
        lordHpDelta: -0.05
      }
    ]
  },
  {
    id: 'roadside-shrine',
    kind: 'choice',
    category: 'blessed',
    title: 'Roadside Shrine',
    body: 'A saint\'s shrine, cracked but tended. Someone still leaves bread here.',
    weight: 6,
    tiers: ['early', 'mid'],
    options: [
      {
        id: 'pray',
        label: 'Kneel and pray',
        hint: 'Something in the deep hall rests easier.',
        lordHpDelta: 0.08
      },
      {
        id: 'rob',
        label: 'Take the offerings',
        hint: 'Fed and emboldened, and something notices.',
        effect: { monsterAtk: 1.06 }
      }
    ]
  },
  {
    id: 'hedge-witch',
    kind: 'choice',
    category: 'neutral',
    title: 'The Hedge Witch',
    body: 'An old woman at a crossroads fire offers to read what waits ahead — for a price she will not name.',
    weight: 5,
    tiers: ['early', 'mid', 'late'],
    options: [
      {
        id: 'listen',
        label: 'Let her read the road',
        hint: 'Forewarned. Something in the deep hall rests easier for it.',
        lordHpDelta: 0.06
      },
      {
        id: 'refuse',
        label: 'Refuse her',
        hint: 'She smiles. That is worse.',
        applyStatus: { kind: 'fear', to: 'party' }
      }
    ]
  },
  {
    id: 'ember-altar',
    kind: 'altar',
    category: 'blessed',
    title: 'Altar of the Ember',
    body: 'A basalt altar, still warm. Laying hands on it leaves a heat under the skin that does not fade.',
    weight: 4,
    tiers: ['early', 'mid', 'late'],
    tags: ['fire'],
    options: [
      {
        id: 'take-ember',
        label: 'Take the Ember Aura',
        hint: 'Fire bites deeper for the rest of the road.',
        effect: { tagDamage: { fire: 1.18 } }
      },
      {
        id: 'take-forge',
        label: 'Take the Forge Aura',
        hint: 'Your monsters take the heat into themselves and harden.',
        effect: { monsterHp: 1.12 }
      }
    ]
  },
  {
    id: 'frost-altar',
    kind: 'altar',
    category: 'blessed',
    title: 'Altar of the Long Winter',
    body: 'Frost spreads from this stone in a perfect circle, in a season that has no business being cold.',
    weight: 4,
    tiers: ['early', 'mid', 'late'],
    tags: ['frost'],
    options: [
      {
        id: 'take-frost',
        label: 'Take the Frost Aura',
        hint: 'Frost bites deeper for the rest of the road.',
        effect: { tagDamage: { frost: 1.18 } }
      },
      {
        id: 'take-warding',
        label: 'Take the Warding Aura',
        hint: 'Your monsters hit harder instead.',
        effect: { monsterAtk: 1.12 }
      }
    ]
  },
  {
    id: 'rot-altar',
    kind: 'altar',
    category: 'blessed',
    title: 'Altar of Slow Rot',
    body: 'Something died on this stone a long time ago and never finished dying.',
    weight: 4,
    tiers: ['mid', 'late'],
    tags: ['poison'],
    options: [
      {
        id: 'take-rot',
        label: 'Take the Rot Aura',
        hint: 'Poison bites deeper for the rest of the road.',
        effect: { tagDamage: { poison: 1.18 } }
      },
      {
        id: 'take-stone',
        label: 'Take the Stonebound Aura',
        hint: 'Your traps hit harder instead.',
        effect: { trapDamage: 1.15 }
      }
    ]
  },
  {
    id: 'plague-dragon',
    kind: 'ecosystem',
    category: 'cursed',
    title: 'Something Passes Overhead',
    body: 'A zombie dragon drags itself across the sky, low and wrong, shedding a fine grey ash over everything below — the road and your halls alike.',
    weight: 3,
    tiers: ['mid', 'late'],
    tags: ['poison'],
    options: [
      {
        id: 'let-it-pass',
        label: 'Let it be',
        hint: 'Everything breathes it in. Everything. The Skeleton Archer has no lungs.',
        applyStatus: { kind: 'poison', to: 'both', except: ['archer'] }
      },
      {
        id: 'raise-barrier',
        label: 'Raise a barrier',
        hint: 'Your halls stay clean. It costs you.',
        effect: { monsterHp: 0.92 }
      }
    ]
  },
  {
    id: 'creeping-damp',
    kind: 'ecosystem',
    category: 'cursed',
    title: 'The Creeping Damp',
    body: 'Groundwater rises through the lower halls and out across the fields. Everything is slick. Everything is cold.',
    weight: 3,
    tiers: ['early', 'mid', 'late'],
    tags: ['oil', 'frost'],
    options: [
      {
        id: 'let-it-rise',
        label: 'Let it rise',
        hint: 'Party and monsters alike go slick underfoot.',
        applyStatus: { kind: 'oiled', to: 'both' }
      },
      {
        id: 'pump-it',
        label: 'Pump it out',
        hint: 'Dry halls, exhausted monsters.',
        effect: { monsterAtk: 0.93 }
      }
    ]
  },
  {
    id: 'infected-wound',
    kind: 'choice',
    category: 'cursed',
    title: 'The Wound Goes Bad',
    body: 'Someone in the party is grey and sweating. The cut from your halls has gone sour under the bandage.',
    weight: 6,
    tiers: ['early', 'mid', 'late'],
    requiresStatus: ['poison', 'burn'],
    options: [
      {
        id: 'camp-and-heal',
        label: 'They camp and treat it',
        hint: 'Days lost, and something in the deep hall rests easier for the delay.',
        lordHpDelta: 0.1
      },
      {
        id: 'push-on',
        label: 'They push on regardless',
        hint: 'Ground gained, fever worse — the strain reaches all the way down.',
        lordHpDelta: -0.08,
        effect: { monsterAtk: 1.08 }
      }
    ]
  },
  {
    id: 'deserters',
    kind: 'narrative',
    category: 'cursed',
    title: 'Deserters On The Road',
    body: 'They pass three of their own walking the other way, weaponless, refusing to say what they saw.',
    weight: 5,
    tiers: ['mid', 'late'],
    options: []
  },
  {
    id: 'supply-train',
    kind: 'choice',
    category: 'blessed',
    title: 'The Supply Train',
    body: 'A relief column catches up with them: fresh arrows, dry rations, a smith who works through the night.',
    weight: 5,
    tiers: ['mid', 'late'],
    options: [
      {
        id: 'take-arms',
        label: 'Re-arm',
        hint: 'Sharper steel for the rest of the road.',
        effect: { trapDamage: 1.08 }
      },
      {
        id: 'take-food',
        label: 'Eat and rest',
        hint: 'They arrive whole, and something in the deep hall rests easier.',
        lordHpDelta: 0.1
      }
    ]
  },
  {
    id: 'war-drums',
    kind: 'narrative',
    category: 'omen',
    title: 'Drums In The Valley',
    body: 'Drums start at dusk and do not stop. They are not your drums, and they are not the party\'s either.',
    weight: 4,
    tiers: ['mid', 'late'],
    options: []
  },
  {
    id: 'kings-banner',
    kind: 'narrative',
    category: 'omen',
    title: 'A Banner On The Ridge',
    body: 'A single banner crests the far ridge at midday and is gone by evening. Gold thread. Very old design.',
    weight: 4,
    tiers: ['late'],
    options: []
  },
  {
    id: 'cursed-spring',
    kind: 'choice',
    category: 'cursed',
    title: 'The Black Spring',
    body: 'Clean-looking water in a country with none. It tastes of iron and something older.',
    weight: 6,
    tiers: ['early', 'mid', 'late'],
    tags: ['poison'],
    options: [
      {
        id: 'drink',
        label: 'Drink deep',
        hint: 'Thirst gone. Something else arrives.',
        applyStatus: { kind: 'poison', to: 'party' }
      },
      {
        id: 'ration',
        label: 'Ration what they carry',
        hint: 'Parched and slower to swing — the deep hall feels it too.',
        lordHpDelta: -0.05
      }
    ]
  },
  {
    id: 'pilgrim-blessing',
    kind: 'choice',
    category: 'blessed',
    title: 'Pilgrims Heading Home',
    body: 'A column of pilgrims, footsore and cheerful, insist on blessing every one of them.',
    weight: 5,
    tiers: ['early', 'mid'],
    options: [
      {
        id: 'accept',
        label: 'Accept the blessing',
        hint: 'Wounds close on the road, and something in the deep hall rests easier.',
        lordHpDelta: 0.06
      },
      {
        id: 'question',
        label: 'Question them about the road',
        hint: 'They learn where your gate is weakest.',
        effect: { monsterHp: 1.05 }
      }
    ]
  },
  {
    id: 'burning-village',
    kind: 'choice',
    category: 'cursed',
    title: 'The Village Is Burning',
    body: 'Not your doing. The smoke is on their line of march either way.',
    weight: 5,
    tiers: ['mid', 'late'],
    tags: ['fire'],
    options: [
      {
        id: 'through-the-fire',
        label: 'March through the burn',
        hint: 'They come out smoking.',
        applyStatus: { kind: 'burn', to: 'party' }
      },
      {
        id: 'help',
        label: 'Stop and help',
        hint: 'Days spent, spirits high, and something in the deep hall rests easier.',
        lordHpDelta: 0.08
      }
    ]
  },
  {
    id: 'scout-returns',
    kind: 'narrative',
    category: 'neutral',
    title: 'The Scout Comes Back',
    body: 'Their forward scout returns at a dead run, says nothing, and will not go out again.',
    weight: 5,
    tiers: ['early', 'mid', 'late'],
    options: []
  },
  {
    id: 'grave-field',
    kind: 'choice',
    category: 'omen',
    title: 'The Grave Field',
    body: 'Row after row of fresh markers, all cut the same week. All of them naming your dungeon.',
    weight: 4,
    tiers: ['mid', 'late'],
    options: [
      {
        id: 'read-names',
        label: 'Read every name',
        hint: 'They learn what killed the last lot, and something in the deep hall rests easier.',
        lordHpDelta: 0.08
      },
      {
        id: 'march-past',
        label: 'March past without looking',
        hint: 'Discipline holds. Nerves do not.',
        applyStatus: { kind: 'fear', to: 'party' }
      }
    ]
  },
  {
    id: 'lord-stirs',
    kind: 'narrative',
    category: 'blessed',
    title: 'Nekrokos Stirs',
    body: 'Word reaches the road that something in the deep hall has started counting down.',
    weight: 4,
    tiers: ['late'],
    options: []
  },
  {
    id: 'starving-week',
    kind: 'choice',
    category: 'cursed',
    title: 'A Starving Week',
    body: 'Supplies are gone and the country is stripped bare. There is a horse. There is also a decision.',
    weight: 4,
    tiers: ['late'],
    options: [
      {
        id: 'eat-the-horse',
        label: 'Eat the horses',
        hint: 'Fed, but the pace collapses — and something in the deep hall goes with it.',
        lordHpDelta: -0.06,
        effect: { monsterHp: 1.06 }
      },
      {
        id: 'forced-march',
        label: 'Forced march on empty',
        hint: 'They arrive fast and hollow, and the deep hall feels thinner for it.',
        lordHpDelta: -0.1
      }
    ]
  }
];

export function dayEvent(id: string): DayEvent | null {
  return DAY_EVENTS.find((e) => e.id === id) || null;
}

export interface ProcFlavour {
  title: string;
  body: string;
  amp: { label: string; hint: string };
}

const PROC_FALLBACK: ProcFlavour = {
  title: 'The Wound Turns',
  body: 'What your room left in them is still working. It will only get worse from here.',
  amp: { label: 'Make it bite deeper', hint: 'It will not stop until it runs its course.' }
};

const PROC_FLAVOUR: Record<string, ProcFlavour> = {
  spike: {
    title: 'The Wound Festers',
    body: 'The gash from your spikes has not closed. Something is getting into it.',
    amp: { label: 'Infection', hint: 'The bleeding runs harder until it finally closes.' }
  },
  poison: {
    title: 'The Toxin Settles',
    body: 'Your gas is in their lungs and has not finished with them.',
    amp: { label: 'Concentrate it', hint: 'Every tick of poison bites harder until it burns out.' }
  },
  fire: {
    title: 'The Fire Takes Hold',
    body: 'They put the flames out. The burn underneath is another matter.',
    amp: { label: 'Flare', hint: 'The burn sears harder each round until it is spent.' }
  },
  frost: {
    title: 'The Cold Sinks In',
    body: 'The chill is past their armour and into the joints.',
    amp: { label: 'Deep freeze', hint: 'The cold cuts harder every round until it thaws.' }
  }
};

export function procFlavour(trapId: string): ProcFlavour {
  return PROC_FLAVOUR[trapId] || PROC_FALLBACK;
}

export interface MysteryVariant {
  id: string;
  weight: number;
  effect: WorldEffect;
  hint: string;
}

export const MYSTERY_VARIANTS: MysteryVariant[] = [
  { id: 'mystery-atk', weight: 5, effect: { heroAtk: 1.15 }, hint: 'Something shifts, unseen. The party feels stronger for it.' },
  { id: 'mystery-hp', weight: 5, effect: { heroHp: 1.15 }, hint: 'A strange warmth settles over them.' },
  { id: 'mystery-both', weight: 1, effect: { heroAtk: 1.1, heroHp: 1.1 }, hint: 'Everything sharpens at once.' }
];

export function pickMysteryVariant(rng: () => number): MysteryVariant {
  const total = MYSTERY_VARIANTS.reduce((sum, v) => sum + v.weight, 0);
  let roll = rng() * total;
  for (const v of MYSTERY_VARIANTS) {
    roll -= v.weight;
    if (roll <= 0) return v;
  }
  return MYSTERY_VARIANTS[MYSTERY_VARIANTS.length - 1];
}
