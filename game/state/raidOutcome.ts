import type { Dungeon, HeroRecord, RaidResult, WorldState } from '../types';
import { STAGE_MAX } from '../content/stages';
import { legacyFrom, trophiesFrom } from '../content/milestones';
import { challengeSouls, challengesFrom } from '../content/challenges';
import { absorbResult } from './roster';
import { FAME_MAX, unlockedFor, type GameState } from './save';

export interface RaidSettlement {
  mode: GameState['mode'];
  record: HeroRecord;
  dungeon: Dungeon;
  result: RaidResult;
  world: WorldState;
}

export function stageCleared(state: GameState, s: RaidSettlement): boolean {
  return s.mode !== 'arcade' && s.result.outcome === 'dungeonWin' && state.stage > state.maxStageCleared;
}

export function settleRaid(state: GameState, s: RaidSettlement): GameState {
  const { mode, record, dungeon, result, world } = s;
  const arcade = mode === 'arcade';
  const roster = absorbResult(state.roster, record, result);
  const hero = roster[0];
  const earned = [
    ...trophiesFrom(result.events, result.outcome === 'dungeonWin'),
    ...(arcade ? [] : challengesFrom(dungeon, state.stage, result))
  ].filter((id) => !state.unlockedMilestones.includes(id));
  const fame = legacyFrom(hero, result)
    .filter((id) => !state.hallOfFame.some((e) => e.uid === hero.uid && e.milestoneId === id))
    .map((id) => ({
      uid: hero.uid,
      heroName: hero.name,
      title: hero.title,
      milestoneId: id,
      achievedAt: Date.now()
    }));

  const next: GameState = {
    ...state,
    mode,
    world,
    gold: state.gold + result.gold,
    souls: state.souls + result.souls + challengeSouls(earned),
    roster,
    unlockedMilestones: [...state.unlockedMilestones, ...earned],
    hallOfFame: [...fame, ...state.hallOfFame].slice(0, FAME_MAX),
    stats: {
      ...state.stats,
      raids: state.stats.raids + 1,
      defeated: state.stats.defeated + (result.outcome === 'dungeonWin' ? 1 : 0),
      escaped: state.stats.escaped + (result.outcome === 'heroEscape' ? 1 : 0),
      lost: state.stats.lost + (result.outcome === 'heroVictory' ? 1 : 0),
      goldEarned: state.stats.goldEarned + result.gold,
      goldStolen: state.stats.goldStolen + result.goldStolen
    }
  };

  if (!arcade) {
    if (result.outcome === 'dungeonWin') {
      next.maxStageCleared = Math.max(state.maxStageCleared, state.stage);
      if (state.stage < STAGE_MAX) next.stage = state.stage + 1;
      next.unlocked = [...new Set([...unlockedFor(next.stage), ...next.bought])];
    }
  } else if (result.outcome === 'dungeonWin') {
    next.bestWave = Math.max(state.bestWave, state.wave);
    next.wave = state.wave + 1;
  } else {
    next.wave = 1;
  }

  return next;
}
