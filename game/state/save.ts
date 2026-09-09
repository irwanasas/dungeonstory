import type { HeroRecord, RoomSlot, WorldState } from '../types';
import { EDITABLE_ROOMS, FAME_MAX, MAX_PER_ID } from '../types';
import type { CampaignState } from './campaign';
import { normalizeCampaign } from './campaign';
import { STAGES } from '../content/stages';
import { TRAPS } from '../content/traps';
import { MONSTERS } from '../content/monsters';
import { TREASURES } from '../content/treasure';
import { defaultWorld, normalizeWorld } from './world';

export interface GameStats {
  raids: number;
  defeated: number;
  escaped: number;
  lost: number;
  goldEarned: number;
  goldStolen: number;
}

export interface LegacyEntry {
  uid: string;
  heroName: string;
  title: string;
  milestoneId: string;
  achievedAt: number;
}

export interface GameState {
  version: number;
  gold: number;
  souls: number;
  mode: 'stage' | 'arcade';
  stage: number;
  maxStageCleared: number;
  wave: number;
  bestWave: number;
  lordLevel: number;
  rooms: RoomSlot[];
  levels: Record<string, number>;
  unlocked: string[];
  bought: string[];
  stats: GameStats;
  roster: HeroRecord[];
  tutorial: number;
  lastSeenAt: number;
  world: WorldState;
  unlockedMilestones: string[];
  hallOfFame: LegacyEntry[];
  equippedLordWeapon: string;
  unlockedLordWeapons: string[];
  campaign: CampaignState | null;
}

const KEY = 'own_a_dungeon_v1';
export const SAVE_VERSION = 2;
export { FAME_MAX };
const DEFAULT_LORD_WEAPON = 'lord-physical';

const RETIRED_CONTENT = new Set(['oil', 'net']);

function contentIds(kind: RoomSlot['kind']): string[] {
  if (kind === 'trap') return TRAPS.map((x) => x.id);
  if (kind === 'monster') return MONSTERS.map((x) => x.id);
  if (kind === 'treasure') return TREASURES.map((x) => x.id);
  return [];
}

export function unlockedFor(_stage: number): string[] {
  return [...contentIds('trap'), ...contentIds('monster'), ...contentIds('treasure')];
}

function keepSlot(slot: RoomSlot): boolean {
  if (slot.kind === 'empty') return true;
  if (RETIRED_CONTENT.has(slot.id)) return false;
  return contentIds(slot.kind).includes(slot.id);
}

function emptyRooms(): RoomSlot[] {
  return Array.from({ length: EDITABLE_ROOMS }, () => ({ kind: 'empty' as const }));
}

export function idCounts(rooms: RoomSlot[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slot of rooms) {
    if (slot.kind === 'empty') continue;
    counts[slot.id] = (counts[slot.id] || 0) + 1;
  }
  return counts;
}

export function canPlace(rooms: RoomSlot[], targetIndex: number, id: string): boolean {
  let used = 0;
  rooms.forEach((slot, i) => {
    if (i !== targetIndex && slot.kind !== 'empty' && slot.id === id) used += 1;
  });
  return used < MAX_PER_ID;
}

function enforceCaps(rooms: RoomSlot[]): RoomSlot[] {
  const used: Record<string, number> = {};
  return rooms.map((slot) => {
    if (slot.kind === 'empty') return slot;
    const next = (used[slot.id] || 0) + 1;
    if (next > MAX_PER_ID) return { kind: 'empty' as const };
    used[slot.id] = next;
    return slot;
  });
}

export function defaultState(): GameState {
  return {
    version: SAVE_VERSION,
    gold: 30,
    souls: 0,
    mode: 'stage',
    stage: 1,
    maxStageCleared: 0,
    wave: 1,
    bestWave: 0,
    lordLevel: 1,
    rooms: emptyRooms(),
    levels: {},
    unlocked: unlockedFor(1),
    bought: [],
    stats: { raids: 0, defeated: 0, escaped: 0, lost: 0, goldEarned: 0, goldStolen: 0 },
    roster: [],
    tutorial: 0,
    lastSeenAt: Date.now(),
    world: defaultWorld(),
    unlockedMilestones: [],
    hallOfFame: [],
    equippedLordWeapon: DEFAULT_LORD_WEAPON,
    unlockedLordWeapons: [DEFAULT_LORD_WEAPON],
    campaign: null
  };
}

function normalize(input: (Partial<GameState> & { kingLevel?: number }) | null): GameState {
  const base = defaultState();
  if (!input) return base;
  const { kingLevel, ...saved } = input;
  const merged: GameState = {
    ...base,
    ...saved,
    stats: { ...base.stats, ...(input.stats || {}) },
    levels: { ...(input.levels || {}) },
    roster: Array.isArray(input.roster) ? input.roster : [],
    bought: Array.isArray(input.bought) ? input.bought : [],
    world: normalizeWorld(input.world),
    unlockedMilestones: Array.isArray(saved.unlockedMilestones) ? saved.unlockedMilestones : [],
    hallOfFame: Array.isArray(saved.hallOfFame) ? saved.hallOfFame.slice(0, FAME_MAX) : [],
    equippedLordWeapon: saved.equippedLordWeapon || DEFAULT_LORD_WEAPON,
    unlockedLordWeapons: Array.isArray(saved.unlockedLordWeapons) ? saved.unlockedLordWeapons : [DEFAULT_LORD_WEAPON],
    lordLevel:
      typeof saved.lordLevel === 'number' ? saved.lordLevel : typeof kingLevel === 'number' ? kingLevel : base.lordLevel
  };
  const rooms = (Array.isArray(input.rooms) ? input.rooms.slice(0, EDITABLE_ROOMS) : []).map((slot) =>
    keepSlot(slot) ? slot : { kind: 'empty' as const }
  );
  while (rooms.length < EDITABLE_ROOMS) rooms.push({ kind: 'empty' });
  merged.version = SAVE_VERSION;
  merged.mode = 'stage';
  merged.campaign = normalizeCampaign(saved.campaign);
  merged.rooms = enforceCaps(rooms);
  merged.stage = Math.max(1, Math.min(STAGES.length, merged.stage));
  merged.bought = merged.bought.filter((id) => !RETIRED_CONTENT.has(id));
  merged.unlocked = unlockedFor(merged.stage);
  return merged;
}

export function loadState(): GameState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultState();
  }
}

export function saveState(state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

