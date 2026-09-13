import type { Dungeon, HeroRecord, RaidResult, WorldState } from '../types';
import { STAGE_MAX } from '../content/stages';
import { legacyFrom, trophiesFrom } from '../content/milestones';
import { challengeSouls, challengesFrom } from '../content/challenges';
import { absorbResult } from './roster';
import { FAME_MAX, type GameState } from './save';

export interface ClassicSettlement {
  mode: 'rush' | 'arcade';
  record: HeroRecord;
  dungeon: Dungeon;
  result: RaidResult;
  world: WorldState;
}

export function classicStageCleared(state: GameState, s: ClassicSettlement): boolean {
  return s.mode !== 'arcade' && s.result.outcome === 'dungeonWin' && state.classic.stage > state.classic.maxStageCleared;
}

export function settleClassicRaid(state: GameState, s: ClassicSettlement): GameState {
  const { mode, record, dungeon, result, world } = s;
  const arcade = mode === 'arcade';
  const roster = absorbResult(state.roster, record, result);
  const hero = roster[0];
  const earned = [
    ...trophiesFrom(result.events, result.outcome === 'dungeonWin'),
    ...(arcade ? [] : challengesFrom(dungeon, state.classic.stage, result))
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
    world,
    classic: {
      ...state.classic,
      mode,
      gold: state.classic.gold + result.gold,
      souls: state.classic.souls + result.souls + challengeSouls(earned)
    },
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
      next.classic.maxStageCleared = Math.max(state.classic.maxStageCleared, state.classic.stage);
      if (state.classic.stage < STAGE_MAX) next.classic.stage = state.classic.stage + 1;
    }
  } else if (result.outcome === 'dungeonWin') {
    next.classic.bestWave = Math.max(state.classic.bestWave, state.classic.wave);
    next.classic.wave = state.classic.wave + 1;
  } else {
    next.classic.wave = 1;
  }

  return next;
}
