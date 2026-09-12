import type { ComboTrophy, HeroRecord, RaidEvent, RaidResult } from '../types';
import { INTERACTIONS } from './interactions';
import { GUARDIANS } from './guardians';
import { HEROES } from './heroes';
import { CHALLENGES } from './challenges';

const GUARDIAN_TROPHIES: ComboTrophy[] = GUARDIANS.map((g) => ({
  id: `guardian-win-${g.id}`,
  name: `${g.name.toUpperCase()} HELD`,
  desc: `Won a Throne fight with the ${g.name} guarding it.`,
  discoveryType: 'collection'
}));

const KING_CLASS_TROPHIES: ComboTrophy[] = HEROES.map((h) => ({
  id: `king-class-${h.id}`,
  name: `${h.role.toUpperCase()} FALLEN`,
  desc: `Beat a King Arthur fighting as ${h.name}, the ${h.role}.`,
  discoveryType: 'collection'
}));

export const TROPHIES: ComboTrophy[] = [
  ...INTERACTIONS.map((i) => ({ id: i.id, name: i.name, desc: i.hint, discoveryType: 'surprise' as const })),
  {
    id: 'first-split',
    name: 'DIVIDED',
    desc: 'A wounded Slime tore itself in half and kept coming.',
    discoveryType: 'surprise'
  },
  {
    id: 'first-disarm',
    name: 'PICKED CLEAN',
    desc: 'A hero spotted one of your traps and took it apart before it fired.',
    discoveryType: 'surprise'
  },
  {
    id: 'king-alone',
    name: 'THE LAST KING',
    desc: 'King Arthur rode to the Throne with no one left beside him — and struck twice as hard for it.',
    discoveryType: 'surprise'
  },
  ...GUARDIAN_TROPHIES,
  ...KING_CLASS_TROPHIES,
  {
    id: 'full-circle',
    name: 'FULL CIRCLE',
    desc: "Nekrokos's own strike closed a combo a trap usually does.",
    discoveryType: 'surprise'
  }
];

export function milestoneLabel(id: string): { name: string; desc: string; kind: 'trophy' | 'challenge' } | null {
  const trophy = TROPHIES.find((t) => t.id === id);
  if (trophy) return { name: trophy.name, desc: trophy.desc, kind: 'trophy' };
  const challenge = CHALLENGES.find((c) => c.id === id);
  if (challenge) return { name: challenge.title, desc: challenge.desc, kind: 'challenge' };
  return null;
}

export function trophiesFrom(events: RaidEvent[], won: boolean): string[] {
  const found = new Set<string>();
  for (const e of events) {
    if (e.t === 'interaction') {
      found.add(e.id);
      if (e.source === 'lord') found.add('full-circle');
    } else if (e.t === 'monsterSplit') found.add('first-split');
    else if (e.t === 'trapFire' && e.disarmed) found.add('first-disarm');
    else if (e.t === 'kingArrives') {
      if (e.alone) found.add('king-alone');
      if (won) found.add(`king-class-${e.defId}`);
    } else if (e.t === 'throneGuardian' && won) found.add(`guardian-win-${e.id}`);
  }
  return [...found];
}

export const LEGACY: ComboTrophy[] = [
  {
    id: 'veteran-unscathed',
    name: 'Unscathed',
    desc: 'Reached the height of their career without ever falling in your dungeon.'
  },
  {
    id: 'twice-scarred-survivor',
    name: 'Twice Scarred',
    desc: 'Carries two scars from your dungeon and still walked out alive.'
  },
  {
    id: 'old-guard',
    name: 'Old Guard',
    desc: 'Twenty raids on the same dungeon, and still coming back.'
  }
];

export function legacyFrom(record: HeroRecord, result: RaidResult): string[] {
  const earned: string[] = [];
  if (record.level >= 15 && record.deaths === 0) earned.push('veteran-unscathed');
  if (record.scars.length === 2 && result.survived) earned.push('twice-scarred-survivor');
  if (record.raids >= 20) earned.push('old-guard');
  return earned;
}
