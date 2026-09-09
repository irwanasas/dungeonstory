import type { HeroRecord } from '../types';
import { STAGES, stageDef } from '../content/stages';
import { HEROES } from '../content/heroes';
import { toDungeon } from '../state/economy';
import type { GameState } from '../state/save';
import { absorbResult, pickRaider } from '../state/roster';
import { simulateRaid } from './raid';
import { seeded } from './rng';

const OFFLINE_RAID_MS = 10 * 60 * 1000;
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
const OFFLINE_MAX_RAIDS = 30;
const OFFLINE_GOLD_RATE = 0.3;

export interface OfflineReport {
  raids: number;
  defeated: number;
  escaped: number;
  breached: number;
  gold: number;
  souls: number;
  goldStolen: number;
  elapsedMs: number;
  roster: HeroRecord[];
}

export function offlineReport(state: GameState, now: number): OfflineReport | null {
  if (state.campaign && state.campaign.status === 'active') return null;
  const elapsed = Math.max(0, now - state.lastSeenAt);
  const capped = Math.min(elapsed, OFFLINE_CAP_MS);
  const raids = Math.min(OFFLINE_MAX_RAIDS, Math.floor(capped / OFFLINE_RAID_MS));
  if (raids < 1) return null;

  const filled = state.rooms.some((r) => r.kind !== 'empty');
  if (!filled) return null;

  const rng = seeded(Math.floor(state.lastSeenAt / 1000) ^ 0x9e3779b9);
  const dungeon = toDungeon(state);
  const stage = stageDef(state.mode === 'rush' ? state.stage : STAGES.length);
  const pool = state.mode === 'arcade' ? HEROES.map((h) => h.id) : stage.heroPool;
  const tier = state.mode === 'arcade' ? state.wave : state.stage;

  const report: OfflineReport = {
    raids,
    defeated: 0,
    escaped: 0,
    breached: 0,
    gold: 0,
    souls: 0,
    goldStolen: 0,
    elapsedMs: capped,
    roster: state.roster
  };

  for (let i = 0; i < raids; i++) {
    const raider = pickRaider(report.roster, pool, stage.heroLevel, rng);
    const result = simulateRaid(dungeon, raider, tier, { rng, collectEvents: false });
    report.roster = absorbResult(report.roster, raider, result);
    report.gold += result.gold;
    report.souls += result.souls;
    report.goldStolen += result.goldStolen;
    if (result.outcome === 'dungeonWin') report.defeated += 1;
    else if (result.outcome === 'heroEscape') report.escaped += 1;
    else report.breached += 1;
  }

  report.gold = Math.round(report.gold * OFFLINE_GOLD_RATE);
  report.souls = Math.round(report.souls * OFFLINE_GOLD_RATE);
  return report;
}
