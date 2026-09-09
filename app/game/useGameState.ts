'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HeroRecord } from '../../game/types';
import { HEROES } from '../../game/content/heroes';
import { stageDef } from '../../game/content/stages';
import { worldModifiers } from '../../game/state/world';
import { defaultState, loadState, saveState, type GameState } from '../../game/state/save';
import { pickRaider } from '../../game/state/roster';
import { offlineReport, type OfflineReport } from '../../game/sim/offline';
import { systemRng } from '../../game/sim/rng';

function heroPoolOf(s: GameState): string[] {
  return s.mode === 'arcade' ? HEROES.map((h) => h.id) : stageDef(s.stage).heroPool;
}

function withOffline(s: GameState, report: OfflineReport | null): GameState {
  if (!report) return { ...s, lastSeenAt: Date.now() };
  return {
    ...s,
    gold: s.gold + report.gold,
    souls: s.souls + report.souls,
    roster: report.roster,
    lastSeenAt: Date.now(),
    stats: {
      ...s.stats,
      raids: s.stats.raids + report.raids,
      defeated: s.stats.defeated + report.defeated,
      escaped: s.stats.escaped + report.escaped,
      lost: s.stats.lost + report.breached,
      goldEarned: s.stats.goldEarned + report.gold,
      goldStolen: s.stats.goldStolen + report.goldStolen
    }
  };
}

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [raider, setRaider] = useState<HeroRecord | null>(null);
  const [offline, setOffline] = useState<OfflineReport | null>(null);

  const rollRaider = useCallback((s: GameState) => {
    const next = pickRaider(
      s.roster,
      heroPoolOf(s),
      stageDef(s.stage).heroLevel,
      systemRng,
      worldModifiers(s.world).heroBias
    );
    setRaider(next);
    return next;
  }, []);

  useEffect(() => {
    const loaded = loadState();
    const report = offlineReport(loaded, Date.now());
    const next = withOffline(loaded, report);
    if (report) setOffline(report);
    setState(next);
    saveState(next);
    rollRaider(next);
  }, [rollRaider]);

  useEffect(() => {
    const hide = () => {
      setState((s) => {
        if (!s) return s;
        const next = { ...s, lastSeenAt: Date.now() };
        saveState(next);
        return next;
      });
    };
    const show = () => {
      setState((s) => {
        if (!s) return s;
        const report = offlineReport(s, Date.now());
        if (report) setOffline(report);
        const next = withOffline(s, report);
        saveState(next);
        return next;
      });
    };
    const onVis = () => (document.visibilityState === 'hidden' ? hide() : show());
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const update = useCallback((fn: (s: GameState) => GameState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      saveState(next);
      return next;
    });
  }, []);

  const resetState = useCallback(() => {
    const fresh = defaultState();
    setState(fresh);
    saveState(fresh);
    rollRaider(fresh);
    setOffline(null);
  }, [rollRaider]);

  return { state, raider, offline, setOffline, update, rollRaider, resetState, heroPoolOf };
}
