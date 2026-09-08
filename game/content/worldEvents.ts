import type { WorldEvent } from '../types';

const WORLD_EVENTS: WorldEvent[] = [
  {
    id: 'two-moons',
    headline: 'Two Moons Over the Vale',
    body: 'Farmers swear a second moon rose beside the first and set an hour early. The temple calls it weather.',
    category: 'rumor',
    tone: 'neutral',
    duration: 3
  },
  {
    id: 'wandering-bard',
    headline: 'A Bard Sings of Your Halls',
    body: 'Somewhere in a tavern, a song is being sung about a dungeon that eats heroes. The details are wrong. The number is not.',
    category: 'rumor',
    tone: 'neutral',
    duration: 3
  },
  {
    id: 'star-fell',
    headline: 'Something Fell in the North',
    body: 'A light crossed the sky and did not come back up. Three villages are arguing about who owns the hole.',
    category: 'rumor',
    tone: 'neutral',
    duration: 2
  },
  {
    id: 'king-cough',
    headline: 'The Old King Is Coughing',
    body: 'Not yours. The other one, above ground, with the throne nobody has to fight for.',
    category: 'news',
    tone: 'neutral',
    duration: 3
  },
  {
    id: 'tax-collector',
    headline: 'The Collector Rides Again',
    body: 'He has a ledger, an escort, and no idea which road leads to your door. Yet.',
    category: 'politics',
    tone: 'neutral',
    duration: 2
  },
  {
    id: 'market-day',
    headline: 'Market Day in Hollowbrook',
    body: 'Cattle, cloth, and a man selling maps to dungeons he has never seen. One of them is nearly right.',
    category: 'celebration',
    tone: 'neutral',
    duration: 2
  },

  {
    id: 'border-skirmish',
    headline: 'Skirmish on the Marches',
    body: 'Two banners met at a river crossing. Both claim they were provoked. Neither has gone home.',
    category: 'news',
    tone: 'neutral',
    duration: 2,
    leadsTo: [{ id: 'marches-burn', chance: 0.7 }]
  },
  {
    id: 'marches-burn',
    headline: 'The Marches Burn',
    body: 'It is a war now. Every hall from here to the coast is drilling warriors and calling it defence.',
    category: 'war',
    tone: 'bad',
    duration: 4,
    effect: { familyAtk: { warrior: 1.1 } },
    leadsTo: [{ id: 'levy-spent', chance: 0.8 }]
  },
  {
    id: 'levy-spent',
    headline: 'The Levy Is Spent',
    body: 'The swords are all at the front. What comes looking for your gold now reads books.',
    category: 'war',
    tone: 'neutral',
    duration: 3,
    effect: { familyAtk: { mage: 1.12 }, heroBias: ['elementalist', 'druid'] }
  },

  {
    id: 'bad-harvest',
    headline: 'The Grain Came In Thin',
    body: 'Barns half full, prices climbing, and a cold month still ahead.',
    category: 'news',
    tone: 'neutral',
    duration: 2,
    leadsTo: [{ id: 'grey-fever', chance: 0.6 }]
  },
  {
    id: 'grey-fever',
    headline: 'Grey Fever in the Lowlands',
    body: 'It takes the strong first. Whoever comes down your stairs this month came down them sick.',
    category: 'disaster',
    tone: 'good',
    duration: 3,
    effect: { heroHp: 0.9 },
    leadsTo: [{ id: 'fever-breaks', chance: 0.9 }]
  },
  {
    id: 'fever-breaks',
    headline: 'The Fever Breaks',
    body: 'The survivors are spending like people who did not expect to. Even down here, it shows.',
    category: 'celebration',
    tone: 'good',
    duration: 3,
    effect: { gold: 1.15 }
  },

  {
    id: 'old-map',
    headline: 'A Map Changes Hands',
    body: 'Vellum, water-stained, three seals broken. Someone paid a year of wages for it in a back room.',
    category: 'rumor',
    tone: 'neutral',
    duration: 2,
    leadsTo: [{ id: 'vault-rush', chance: 0.75 }]
  },
  {
    id: 'vault-rush',
    headline: 'They Say There Is a Vault',
    body: 'Every light-fingered opportunist within a hundred miles is suddenly very interested in old stonework.',
    category: 'discovery',
    tone: 'neutral',
    duration: 3,
    effect: { heroBias: ['trickster', 'assassin'], gold: 1.1 },
    leadsTo: [{ id: 'vault-emptied', chance: 0.85 }]
  },
  {
    id: 'vault-emptied',
    headline: 'The Vault Was Empty',
    body: 'Or it never existed. The maps are firewood now and nobody will admit what they paid.',
    category: 'discovery',
    tone: 'neutral',
    duration: 2
  },

  {
    id: 'crown-tax',
    headline: 'A Levy on Buried Gold',
    body: 'The crown has decided that treasure underground is still treasure. Collection is theoretical. The paperwork is not.',
    category: 'politics',
    tone: 'neutral',
    duration: 3,
    effect: { gold: 0.9, souls: 1.15 }
  },
  {
    id: 'long-drought',
    headline: 'The Long Drought',
    body: 'Wells down, rivers low, and everything above ground dry enough to take a spark.',
    category: 'disaster',
    tone: 'good',
    duration: 3,
    effect: { tagDamage: { fire: 1.2, frost: 0.9 } }
  },
  {
    id: 'deep-winter',
    headline: 'Winter Came Early',
    body: 'Frost in the stone, frost in the air. Everything down here moves a little slower — yours included.',
    category: 'disaster',
    tone: 'neutral',
    duration: 3,
    effect: { tagDamage: { frost: 1.2, fire: 0.9 }, monsterAtk: 0.95 }
  },
  {
    id: 'mercenary-fair',
    headline: 'The Hiring Fair at Ashford',
    body: 'Every sellsword with a working arm is taking contracts. The ones who take yours are better than usual.',
    category: 'news',
    tone: 'bad',
    duration: 3,
    effect: { heroAtk: 1.08, heroBias: ['berserker', 'assassin'] }
  },
  {
    id: 'harvest-feast',
    headline: 'Three Days of Feasting',
    body: 'The whole valley is drunk. Adventurers included. They still come — they just come badly.',
    category: 'celebration',
    tone: 'good',
    duration: 2,
    effect: { heroAtk: 0.9, gold: 1.1 }
  },
  {
    id: 'arcane-tide',
    headline: 'The Ley Lines Are Loud',
    body: 'Candles gutter the wrong way. Anyone who can feel it is suddenly much more dangerous.',
    category: 'discovery',
    tone: 'bad',
    duration: 3,
    effect: { familyAtk: { mage: 1.15 }, tagDamage: { arcane: 1.1 } }
  },
  {
    id: 'beast-migration',
    headline: 'Something Is Moving South',
    body: 'The deep things are on the move, and some of them have decided your walls are home.',
    category: 'news',
    tone: 'good',
    duration: 3,
    effect: { monsterHp: 1.12 }
  },
  {
    id: 'smiths-guild',
    headline: 'The Smiths Break Their Guild',
    body: 'Fittings, springs and good iron are cheap for the first time in a generation. Your mechanisms bite harder.',
    category: 'politics',
    tone: 'good',
    duration: 3,
    effect: { trapDamage: 1.15 }
  },
  {
    id: 'pilgrim-season',
    headline: 'The Pilgrim Roads Are Full',
    body: 'Faith moves through the valley in long grey lines. What it leaves behind is thicker than usual.',
    category: 'celebration',
    tone: 'good',
    duration: 3,
    effect: { souls: 1.2 }
  },
  {
    id: 'bounty-posted',
    headline: 'A Bounty on Your Door',
    body: 'Someone has put a number on your head and nailed it to every notice board in the province. The number is flattering.',
    category: 'politics',
    tone: 'neutral',
    duration: 3,
    effect: { heroHp: 1.1, gold: 1.15 },
    minStage: 6
  },
  {
    id: 'goblin-uprising',
    headline: 'The Warrens Are Restless',
    body: 'Word has gone round the under-tunnels that there is work here. They arrive angry and stay angry.',
    category: 'war',
    tone: 'good',
    duration: 3,
    effect: { monsterAtk: 1.12, monsterHp: 0.95 }
  }
];

const CHAINED = new Set<string>(
  WORLD_EVENTS.flatMap((e) => (e.leadsTo || []).map((l) => l.id))
);

export function worldEvent(id: string): WorldEvent | null {
  return WORLD_EVENTS.find((e) => e.id === id) || null;
}

export const ROLLABLE = WORLD_EVENTS.filter((e) => !CHAINED.has(e.id));
