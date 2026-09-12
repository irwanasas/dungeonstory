import type { Challenge, Dungeon, RaidResult, RoomSlot } from '../types';
import { CAMPAIGN_MAX } from '../types';
import { LORD } from './monsters';

export const CHALLENGES: Challenge[] = [
  {
    id: 'bare-hands',
    title: 'Bare Hands',
    desc: 'Win a raid without a single trap in the dungeon.',
    stageMin: 5,
    soulReward: 4
  },
  {
    id: 'one-idea',
    title: 'One Idea',
    desc: 'Win a raid where every filled room holds a monster and nothing else.',
    stageMin: 10,
    soulReward: 5
  },
  {
    id: 'lord-alone',
    title: `${LORD.short} Alone`,
    desc: `Win with every filled room holding the same thing — two rooms at most — and ${LORD.short} at level 5.`,
    soulReward: 8
  },
  {
    id: 'no-loot-needed',
    title: 'Untouched Hoard',
    desc: 'Win a raid with treasure in the dungeon that the hero never stopped to take.',
    soulReward: 4
  },
  {
    id: 'full-house',
    title: 'Full House',
    desc: 'Win a raid with all five rooms filled.',
    stageMin: 15,
    soulReward: 6
  },
  {
    id: 'frostbitten-kill',
    title: 'Frostbitten',
    desc: 'Crack a chilled hero with a physical hit, then finish a monster off in the same raid.',
    soulReward: 3
  },
  {
    id: 'campaign-ten',
    title: 'The Tenth Siege',
    desc: 'Clear Campaign 10.',
    soulReward: 10
  }
];

type FilledSlot = Exclude<RoomSlot, { kind: 'empty' }>;

function filledSlots(dungeon: Dungeon): FilledSlot[] {
  return dungeon.rooms.map((r) => r.slot).filter((s): s is FilledSlot => s.kind !== 'empty');
}

function frostbitten(result: RaidResult): boolean {
  const chill = result.events.findIndex((e) => e.t === 'interaction' && e.id === 'chill-physical');
  return chill >= 0 && result.events.some((e, i) => i > chill && e.t === 'monsterDown');
}

function passes(id: string, dungeon: Dungeon, result: RaidResult, campaignNumber?: number): boolean {
  const filled = filledSlots(dungeon);
  const won = result.outcome === 'dungeonWin' && filled.length > 0;
  switch (id) {
    case 'bare-hands':
      return won && filled.every((s) => s.kind !== 'trap');
    case 'one-idea':
      return won && filled.every((s) => s.kind === 'monster');
    case 'lord-alone':
      return won && dungeon.lordLevel >= 5 && filled.every((s) => s.id === filled[0].id);
    case 'no-loot-needed':
      return won && filled.some((s) => s.kind === 'treasure') && !result.events.some((e) => e.t === 'treasureTaken');
    case 'full-house':
      return won && filled.length === dungeon.rooms.length;
    case 'frostbitten-kill':
      return frostbitten(result);
    case 'campaign-ten':
      return result.outcome === 'dungeonWin' && campaignNumber === CAMPAIGN_MAX;
    default:
      return false;
  }
}

export function challengesFrom(dungeon: Dungeon, stage: number, result: RaidResult, campaignNumber?: number): string[] {
  return CHALLENGES.filter((c) => stage >= (c.stageMin || 1) && passes(c.id, dungeon, result, campaignNumber)).map(
    (c) => c.id
  );
}

export function challengeSouls(ids: string[]): number {
  return CHALLENGES.filter((c) => ids.includes(c.id)).reduce((n, c) => n + c.soulReward, 0);
}
