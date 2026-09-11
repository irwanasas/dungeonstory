const FIRST = [
  'William', 'Aldric', 'Bryn', 'Cassia', 'Doran', 'Elowen', 'Fenn', 'Gareth',
  'Hilde', 'Ivar', 'Joss', 'Kaela', 'Lucan', 'Mira', 'Nolan', 'Oriel',
  'Perrin', 'Quill', 'Rowan', 'Sable', 'Tam', 'Ulric', 'Vesper', 'Wren',
  'Yorick', 'Zara', 'Emeric', 'Isolde', 'Corin', 'Maeve'
];

const HONORIFIC: Record<string, string> = {
  paladin: 'Sir',
  berserker: '',
  trickster: '',
  assassin: '',
  druid: '',
  elementalist: ''
};

const TITLE: Record<string, string[]> = {
  paladin: ['the Unyielding', 'of the Silver Oath', 'Shieldbearer', 'the Steadfast'],
  berserker: ['Bloodmane', 'the Unbroken', 'Skullsplitter', 'the Furious'],
  trickster: ['Quickfingers', 'the Unseen', 'of the Long Shadow', 'Slipknife'],
  assassin: ['the Quiet', 'Nightfall', 'of the Last Breath', 'Redhand'],
  druid: ['Thornwarden', 'of the Deep Grove', 'Rootspeaker', 'the Verdant'],
  elementalist: ['Stormcaller', 'the Kindled', 'of the Rising Gale', 'Emberwright']
};

export const SCAR_TITLE: Record<string, string> = {
  poison: 'the Poison-Scarred',
  fire: 'the Fireburnt',
  frost: 'the Frostbitten',
  physical: 'the Broken-Boned',
  arcane: 'the Shadow-Touched'
};

let counter = 0;

export function makeName(defId: string, rand: () => number): { name: string; title: string } {
  const first = FIRST[Math.floor(rand() * FIRST.length)];
  const honorific = HONORIFIC[defId] || '';
  const titles = TITLE[defId] || [''];
  return {
    name: honorific ? `${honorific} ${first}` : first,
    title: titles[Math.floor(rand() * titles.length)]
  };
}

export function makeUid(): string {
  counter += 1;
  return `h${Date.now().toString(36)}${counter.toString(36)}`;
}
