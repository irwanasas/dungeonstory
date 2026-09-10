import type { Outcome, WorldModifiers } from '../types';
import type { GameState } from './save';

export function upgradeCost(baseCost: number, level: number): number {
  return Math.round(baseCost * 1.8 * Math.pow(1.25, level - 1));
}

export const RUSH_RAMP_TOTAL = 1.3;

export function rushRamp(stage: number, stageMax: number): number {
  if (stageMax <= 1) return 1;
  const t = (Math.max(1, Math.min(stageMax, stage)) - 1) / (stageMax - 1);
  return 1 + (RUSH_RAMP_TOTAL - 1) * t;
}

export function lordSoulCost(level: number): number {
  return Math.round(3 * Math.pow(1.35, level - 1));
}

export function unlockSoulCost(goldCost: number, unlockStage: number, currentStage: number): number {
  const early = Math.max(0, unlockStage - currentStage);
  return Math.max(2, Math.round((goldCost / 5) * (1 + early * 0.35)));
}

export function raidRewards(
  outcome: Outcome,
  roomsEntered: number,
  tier: number,
  world: WorldModifiers
): { gold: number; souls: number } {
  const scale = 1 + (tier - 1) * 0.11;
  const toll = roomsEntered * 4;
  const g = world.gold;
  const sl = world.souls;
  if (outcome === 'dungeonWin') {
    return { gold: Math.round((30 + toll) * scale * g), souls: Math.round((1 + Math.floor(tier / 3)) * sl) };
  }
  if (outcome === 'heroEscape') {
    return { gold: Math.round((11 + toll) * scale * g), souls: Math.round(1 * sl) };
  }
  return { gold: Math.round(5 * scale * g), souls: 0 };
}

export function checkpointReward(tier: number, world: WorldModifiers, held: boolean): { gold: number; souls: number } {
  const scale = 1 + (tier - 1) * 0.11;
  const gold = Math.round((held ? 14 : 6) * scale * world.gold);
  const souls = held ? Math.round((1 + Math.floor(tier / 6)) * world.souls) : 0;
  return { gold, souls };
}

export function dungeonPower(state: GameState): number {
  return (
    state.rooms.reduce((sum, slot) => (slot.kind === 'empty' ? sum : sum + (state.levels[slot.id] || 1)), 0) +
    state.lordLevel
  );
}

export function toDungeon(state: {
  rooms: import('../types').RoomSlot[];
  levels: Record<string, number>;
  lordLevel: number;
  equippedLordWeapon: string;
}): import('../types').Dungeon {
  return {
    rooms: state.rooms.map((slot) => ({
      slot,
      level: slot.kind === 'empty' ? 1 : state.levels[slot.id] || 1
    })),
    lordLevel: state.lordLevel,
    lordWeaponId: state.equippedLordWeapon
  };
}
