import type { HeroRecord, RoomSlot, WorldState } from '../types';
import { EDITABLE_ROOMS, MAX_PER_ID } from '../types';
import { STAGES } from '../content/stages';
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
}

const KEY = 'own_a_dungeon_v1';
export const FAME_MAX = 20;
const DEFAULT_LORD_WEAPON = 'lord-physical';

export function unlockedFor(stage: number): string[] {
  const ids = new Set<string>(['spike']);
  for (const s of STAGES) {
    if (s.id > stage) break;
    s.unlockTraps.forEach((id) => ids.add(id));
    s.unlockMonsters.forEach((id) => ids.add(id));
    s.unlockTreasure.forEach((id) => ids.add(id));
  }
  return [...ids];
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
    unlockedLordWeapons: [DEFAULT_LORD_WEAPON]
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
  const rooms = Array.isArray(input.rooms) ? input.rooms.slice(0, EDITABLE_ROOMS) : [];
  while (rooms.length < EDITABLE_ROOMS) rooms.push({ kind: 'empty' });
  merged.rooms = enforceCaps(rooms);
  merged.stage = Math.max(1, Math.min(STAGES.length, merged.stage));
  merged.unlocked = [...new Set([...unlockedFor(Math.max(merged.stage, merged.maxStageCleared + 1)), ...merged.bought])];
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

