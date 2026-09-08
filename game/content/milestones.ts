import type { ComboTrophy, HeroRecord, RaidEvent, RaidResult } from '../types';
import { INTERACTIONS } from './interactions';

export const TROPHIES: ComboTrophy[] = [
  ...INTERACTIONS.map((i) => ({ id: i.id, name: i.name, desc: i.hint })),
  {
    id: 'first-split',
    name: 'DIVIDED',
    desc: 'A wounded Slime tore itself in half and kept coming.'
  },
  {
    id: 'first-disarm',
    name: 'PICKED CLEAN',
    desc: 'A hero spotted one of your traps and took it apart before it fired.'
  }
];

export function trophiesFrom(events: RaidEvent[]): string[] {
  const found = new Set<string>();
  for (const e of events) {
    if (e.t === 'interaction') found.add(e.id);
    else if (e.t === 'monsterSplit') found.add('first-split');
    else if (e.t === 'trapFire' && e.disarmed) found.add('first-disarm');
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
