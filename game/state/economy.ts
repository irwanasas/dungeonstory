import type { CampaignTier, Outcome, WorldModifiers } from '../types';
import { talentBonus } from '../content/talents';
import type { GameState } from './save';

export function upgradeCost(baseCost: number, level: number): number {
  return Math.round(baseCost * 1.8 * Math.pow(1.25, level - 1));
}

export const RUSH_RAMP_TOTAL = 1.8;

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

export function tierScaleFactor(tier: number): number {
  return 1 + (tier - 1) * 0.11;
}

export function raidRewards(
  outcome: Outcome,
  roomsEntered: number,
  tier: number,
  world: WorldModifiers
): { gold: number; souls: number } {
  const scale = tierScaleFactor(tier);
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
  const scale = tierScaleFactor(tier);
  const gold = Math.round((held ? 14 : 6) * scale * world.gold);
  const souls = held ? Math.round((1 + Math.floor(tier / 6)) * world.souls) : 0;
  return { gold, souls };
}

export function dungeonPower(state: GameState): number {
  return state.lordLevel + state.talentLevel + Math.max(0, state.unlockedLordWeapons.length - 1);
}

export interface PerformanceInputs {
  outcome: Outcome;
  daysSurvived: number;
  totalDays: number;
  milestonesCleared: number;
  milestonesTotal: number;
  checkpointsCleared: number;
  wavesLost: number;
  goldEarned: number;
  soulsEarned: number;
  goldStolen: number;
  eventsResolved: number;
  tier: CampaignTier;
  campaignNumber: number;
}

const TIER_MULT: Record<CampaignTier, number> = { early: 1, mid: 1.4, late: 1.9 };
const MIN_ON_LOSS = { gold: 8, souls: 1 };

export const PERF_WEIGHTS = {
  survival: 18,
  milestone: 22,
  battle: 14,
  economy: 0.35,
  events: 2,
  soulsPerMilestone: 2,
  soulsPerBattle: 0.6
};

export function campaignPerformanceReward(input: PerformanceInputs): { gold: number; souls: number } {
  const survivalPct = Math.max(0, Math.min(1, input.daysSurvived / Math.max(1, input.totalDays)));
  const milestonePct = input.milestonesTotal > 0 ? input.milestonesCleared / input.milestonesTotal : 0;
  const battleHeld = Math.max(0, input.checkpointsCleared - input.wavesLost);
  const tierMult = TIER_MULT[input.tier];

  let gold =
    (survivalPct * PERF_WEIGHTS.survival +
      milestonePct * PERF_WEIGHTS.milestone +
      battleHeld * PERF_WEIGHTS.battle +
      input.eventsResolved * PERF_WEIGHTS.events) *
      tierMult +
    Math.max(0, input.goldEarned - input.goldStolen) * PERF_WEIGHTS.economy;

  let souls = (input.milestonesCleared * PERF_WEIGHTS.soulsPerMilestone + battleHeld * PERF_WEIGHTS.soulsPerBattle) * tierMult;

  if (input.outcome === 'dungeonWin') {
    gold *= 0.55;
    souls *= 0.55;
  }

  gold = Math.max(MIN_ON_LOSS.gold * tierMult, Math.round(gold));
  souls = Math.max(MIN_ON_LOSS.souls, Math.round(souls));
  return { gold, souls };
}

export function toDungeon(state: {
  rooms: import('../types').RoomSlot[];
  levels: Record<string, number>;
  lordLevel: number;
  talentLevel: number;
  equippedLordWeapon: string;
}): import('../types').Dungeon {
  return {
    rooms: state.rooms.map((slot) => ({
      slot,
      level: slot.kind === 'empty' ? 1 : state.levels[slot.id] || 1
    })),
    lordLevel: state.lordLevel,
    lordWeaponId: state.equippedLordWeapon,
    talents: talentBonus(state.talentLevel)
  };
}
