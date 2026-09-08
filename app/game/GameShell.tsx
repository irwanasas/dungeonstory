'use client';

import { useCallback, useRef, useState } from 'react';
import type { HeroRecord, RaidResult, RoomSlot, WorldEvent } from '../../game/types';
import { EDITABLE_ROOMS } from '../../game/types';
import { STAGE_MAX, stageDef, unlockStageOf } from '../../game/content/stages';
import { LORD } from '../../game/content/monsters';
import { legacyFrom, trophiesFrom } from '../../game/content/milestones';
import { challengeSouls, challengesFrom } from '../../game/content/challenges';
import { dungeonPower, toDungeon, unlockSoulCost } from '../../game/state/economy';
import { effectCount, tickWorld, worldModifiers } from '../../game/state/world';
import { FAME_MAX, canPlace, unlockedFor, type GameState } from '../../game/state/save';
import { absorbResult, returningNote } from '../../game/state/roster';
import { simulateRaid } from '../../game/sim/raid';
import { systemRng } from '../../game/sim/rng';
import DungeonView from './DungeonView';
import { BuildSheet } from './panels/BuildSheet';
import { CodexSheet } from './panels/CodexSheet';
import { SettingsSheet } from './panels/SettingsSheet';
import { UpgradeSheet } from './panels/UpgradeSheet';
import { WorldSheet } from './panels/WorldSheet';
import { Coach, HeroTeaser, OfflinePanel, ResultPanel, TUTORIAL } from './overlays';
import { ICON, artVars, contentArt, heroArt } from './art';
import { CELL, useRaidDirector } from './useRaidDirector';
import { useGameState } from './useGameState';
import { play as sfx, startAmbient } from './audio';

const MIN_WORLD_STAGE = 3;

type SheetKind = 'build' | 'upgrade' | 'codex' | 'settings' | 'world' | null;

export default function GameShell() {
  const { state, raider, offline, setOffline, update, rollRaider, resetState } = useGameState();
  const [selected, setSelected] = useState(0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [result, setResult] = useState<RaidResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [stageCleared, setStageCleared] = useState(false);
  const [justPlaced, setJustPlaced] = useState(-1);
  const [news, setNews] = useState<WorldEvent | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { view, play, speed, setSpeed } = useRaidDirector(scrollRef);
  const busy = view.raiding;


  const advanceTutorial = useCallback(
    (from: number) => {
      update((s) => (s.tutorial === from ? { ...s, tutorial: s.tutorial + 1 } : s));
    },
    [update]
  );

  const scrollToRoom = useCallback((room: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: (room + 1) * CELL, behavior: 'smooth' });
  }, []);

  if (!state || !raider) {
    return (
      <div className="app" style={artVars}>
        <div className="stage" />
      </div>
    );
  }

  const stage = stageDef(state.stage);
  const tier = state.mode === 'arcade' ? state.wave : state.stage;
  const filled = state.rooms.filter((r) => r.kind !== 'empty').length;

  function place(slot: RoomSlot) {
    if (selected < 0 || selected >= EDITABLE_ROOMS) return;
    const target = selected;
    update((s) => {
      if (slot.kind !== 'empty' && !canPlace(s.rooms, target, slot.id)) return s;
      const rooms = s.rooms.slice();
      rooms[target] = slot;
      return { ...s, rooms };
    });
    setJustPlaced(target);
    setTimeout(() => setJustPlaced(-1), 400);
    setSheet(null);
    sfx('place');
    if (state && state.tutorial === 0) advanceTutorial(0);
    else if (state && state.tutorial === 1 && filled + 1 >= 3) advanceTutorial(1);
  }

  function buyUnlock(id: string, goldCost: number) {
    update((s) => {
      if (s.bought.includes(id)) return s;
      const price = unlockSoulCost(goldCost, unlockStageOf(id), s.stage);
      if (s.souls < price) return s;
      const bought = [...s.bought, id];
      return {
        ...s,
        souls: s.souls - price,
        bought,
        unlocked: [...new Set([...unlockedFor(Math.max(s.stage, s.maxStageCleared + 1)), ...bought])]
      };
    });
    sfx('coin');
  }

  function upgrade(id: string, cost: number) {
    update((s) => (s.gold < cost ? s : { ...s, gold: s.gold - cost, levels: { ...s.levels, [id]: (s.levels[id] || 1) + 1 } }));
    sfx('place');
  }

  function buyLordWeapon(id: string, cost: number) {
    update((s) =>
      s.gold < cost || s.unlockedLordWeapons.includes(id)
        ? s
        : { ...s, gold: s.gold - cost, unlockedLordWeapons: [...s.unlockedLordWeapons, id] }
    );
    sfx('coin');
  }

  function equipLordWeapon(id: string) {
    update((s) => (s.unlockedLordWeapons.includes(id) ? { ...s, equippedLordWeapon: id } : s));
    sfx('lord');
  }

  function upgradeLord(souls: number) {
    update((s) => (s.souls < souls ? s : { ...s, souls: s.souls - souls, lordLevel: s.lordLevel + 1 }));
    sfx('lord');
  }

  function setMode(mode: 'stage' | 'arcade') {
    if (busy || !state) return;
    update((s) => ({ ...s, mode }));
    rollRaider({ ...state, mode });
    sfx('tap');
  }

  function openSheet(kind: SheetKind) {
    if (busy) return;
    setSheet(kind);
    sfx('tap');
    if (kind === 'upgrade' && state && state.tutorial === 4) advanceTutorial(4);
    if (kind === 'world') update((s) => (s.world.unread === 0 ? s : { ...s, world: { ...s.world, unread: 0 } }));
  }

  async function startRaid() {
    if (busy || !state || !raider) return;
    startAmbient();
    sfx('tap');
    if (state.tutorial === 2) advanceTutorial(2);

    const heroLevel = state.mode === 'arcade' ? 1 + Math.floor((state.wave - 1) / 2) : stage.heroLevel;
    const record: HeroRecord = { ...raider, level: Math.max(raider.level, heroLevel) };
    const lordLevel = state.mode === 'arcade' ? state.lordLevel + Math.floor(state.wave / 4) : Math.max(state.lordLevel, stage.lordLevel);
    const dungeon = { ...toDungeon(state), lordLevel };
    const raidResult = simulateRaid(dungeon, record, tier, {
      world: worldModifiers(state.world)
    });

    await play(raidResult, heroArt(record.defId));

    const turned = tickWorld(state.world, state.mode === 'arcade' ? MIN_WORLD_STAGE : state.stage, systemRng);
    const cleared =
      state.mode === 'stage' && raidResult.outcome === 'dungeonWin' && state.stage > state.maxStageCleared;

    update((s) => {
      const roster = absorbResult(s.roster, record, raidResult);
      const hero = roster[0];
      const earned = [
        ...trophiesFrom(raidResult.events),
        ...(s.mode === 'stage' ? challengesFrom(dungeon, s.stage, raidResult) : [])
      ].filter((id) => !s.unlockedMilestones.includes(id));
      const fame = legacyFrom(hero, raidResult)
        .filter((id) => !s.hallOfFame.some((e) => e.uid === hero.uid && e.milestoneId === id))
        .map((id) => ({
          uid: hero.uid,
          heroName: hero.name,
          title: hero.title,
          milestoneId: id,
          achievedAt: Date.now()
        }));

      const next: GameState = {
        ...s,
        world: turned.world,
        gold: s.gold + raidResult.gold,
        souls: s.souls + raidResult.souls + challengeSouls(earned),
        roster,
        unlockedMilestones: [...s.unlockedMilestones, ...earned],
        hallOfFame: [...fame, ...s.hallOfFame].slice(0, FAME_MAX),
        stats: {
          ...s.stats,
          raids: s.stats.raids + 1,
          defeated: s.stats.defeated + (raidResult.outcome === 'dungeonWin' ? 1 : 0),
          escaped: s.stats.escaped + (raidResult.outcome === 'heroEscape' ? 1 : 0),
          lost: s.stats.lost + (raidResult.outcome === 'heroVictory' ? 1 : 0),
          goldEarned: s.stats.goldEarned + raidResult.gold,
          goldStolen: s.stats.goldStolen + raidResult.goldStolen
        }
      };
      if (s.mode === 'stage') {
        if (raidResult.outcome === 'dungeonWin') {
          next.maxStageCleared = Math.max(s.maxStageCleared, s.stage);
          if (s.stage < STAGE_MAX) next.stage = s.stage + 1;
          next.unlocked = [...new Set([...unlockedFor(next.stage), ...next.bought])];
        }
      } else if (raidResult.outcome === 'dungeonWin') {
        next.bestWave = Math.max(s.bestWave, s.wave);
        next.wave = s.wave + 1;
      } else {
        next.wave = 1;
      }
      return next;
    });

    setResult(raidResult);
    setStageCleared(cleared);
    setNews(turned.fired);
    setResultOpen(true);
  }

  function closeResult() {
    if (!state) return;
    setResultOpen(false);
    sfx('tap');
    if (state.tutorial === 3) advanceTutorial(3);
    rollRaider(state);
  }

  function resetGame() {
    resetState();
    setSelected(0);
    setSheet(null);
    setResult(null);
    setResultOpen(false);
    sfx('lose');
  }

  function closeSheet() {
    setSheet(null);
    sfx('tap');
    if (state && state.tutorial === 5) advanceTutorial(5);
  }

  const veteranNote = returningNote(raider);
  const coachHidden = busy || sheet !== null || resultOpen || offline !== null;

  return (
    <div className="app" style={artVars}>
      <header className="hud plate">
        <div className="hud-left">
          <div className="hud-title">OWN A DUNGEON</div>
          <div className="hud-sub">
            {state.mode === 'stage'
              ? `Stage ${state.stage}/${STAGE_MAX} · ${stage.title}`
              : `Wave ${state.wave} · Best ${state.bestWave}`}
            {` · Power ${dungeonPower(state)}`}
          </div>
        </div>
        <div className="hud-right">
          <span className="coin">
            <img src={ICON.gold} alt="Gold" />
            {state.gold}
          </span>
          <span className="coin souls">
            <img src={ICON.soul} alt="Souls" />
            {state.souls}
          </span>
        </div>
      </header>

      <nav className="tabs">
        <button className="tab tab-icon btn" onClick={() => openSheet('world')} disabled={busy} aria-label="The World">
          <img src={ICON.world} alt="" />
          {(state.world.unread > 0 || effectCount(state.world) > 0) && (
            <span className={'tab-dot' + (state.world.unread === 0 ? ' live' : '')} />
          )}
        </button>
        <button className={'tab btn' + (state.mode === 'stage' ? ' on' : '')} onClick={() => setMode('stage')} disabled={busy}>
          Stage
        </button>
        <button className={'tab btn' + (state.mode === 'arcade' ? ' on' : '')} onClick={() => setMode('arcade')} disabled={busy}>
          Arcade
        </button>
        <button className="tab tab-icon btn" onClick={() => openSheet('codex')} disabled={busy} aria-label="Codex">
          <img src={ICON.codex} alt="" />
        </button>
        <button className="tab tab-icon btn" onClick={() => openSheet('settings')} disabled={busy} aria-label="Settings">
          <img src={ICON.settings} alt="" />
        </button>
      </nav>

      <DungeonView
        rooms={state.rooms}
        levels={state.levels}
        selected={selected}
        justPlaced={justPlaced}
        view={view}
        scrollRef={scrollRef}
        onSelect={(i) => {
          setSelected(i);
          if (i >= 0 && i < EDITABLE_ROOMS) openSheet('build');
        }}
        onScrollRoom={setSelected}
        speed={speed}
        onSpeed={() => setSpeed(speed >= 8 ? 1 : speed * 2)}
      />

      <div className="strip">
        {state.rooms.map((slot, i) => (
          <button
            key={i}
            className={'pip' + (slot.kind !== 'empty' ? ' on' : '') + (selected === i ? ' here' : '')}
            onClick={() => {
              if (busy) return;
              setSelected(i);
              scrollToRoom(i);
              sfx('tap');
            }}
            aria-label={`Room ${i + 1}`}
          >
            {slot.kind === 'empty' ? <span className="pip-n">{i + 1}</span> : <img src={contentArt(slot.kind, slot.id)} alt="" />}
          </button>
        ))}
        <button
          className={'pip throne' + (selected === EDITABLE_ROOMS ? ' here' : '')}
          onClick={() => {
            if (busy) return;
            setSelected(EDITABLE_ROOMS);
            scrollToRoom(EDITABLE_ROOMS);
            sfx('tap');
          }}
          aria-label="Throne Room"
        >
          <img src={ICON.lord} alt="" />
        </button>
      </div>

      <HeroTeaser
        defId={raider.defId}
        name={raider.name}
        title={raider.title}
        note={veteranNote}
        raiding={busy}
        status={
          view.litRoom < 0
            ? 'At the entrance.'
            : view.litRoom >= EDITABLE_ROOMS
              ? `Throne Room — facing ${LORD.short}.`
              : `Room ${view.litRoom + 1} of ${EDITABLE_ROOMS}.`
        }
      />

      <div className="bottom">
        <button
          className="side btn"
          onClick={() => {
            if (selected < 0 || selected >= EDITABLE_ROOMS) {
              setSelected(0);
              scrollToRoom(0);
            }
            openSheet('build');
          }}
          disabled={busy}
          aria-label="Build"
        >
          <img src={ICON.build} alt="" />
        </button>
        <button className="raid btn" onClick={startRaid} disabled={busy}>
          <img src={ICON.raid} alt="" />
          RAID
        </button>
        <button className="side btn" onClick={() => openSheet('upgrade')} disabled={busy} aria-label="Upgrade">
          <img src={ICON.upgrade} alt="" />
        </button>
      </div>

      <BuildSheet
        open={sheet === 'build'}
        room={Math.max(0, Math.min(EDITABLE_ROOMS - 1, selected))}
        state={state}
        onClose={closeSheet}
        onPlace={place}
        onBuy={buyUnlock}
      />
      <UpgradeSheet
        open={sheet === 'upgrade'}
        state={state}
        onClose={closeSheet}
        onUpgrade={upgrade}
        onLord={upgradeLord}
        onBuyLordWeapon={buyLordWeapon}
        onEquipLordWeapon={equipLordWeapon}
      />
      <CodexSheet open={sheet === 'codex'} state={state} onClose={closeSheet} />
      <WorldSheet open={sheet === 'world'} state={state} onClose={closeSheet} />
      <SettingsSheet open={sheet === 'settings'} state={state} onClose={closeSheet} onReset={resetGame} />

      <ResultPanel
        open={resultOpen}
        result={result}
        stageCleared={stageCleared}
        nextBrief={stage.teaches}
        news={news}
        onClose={closeResult}
      />
      <OfflinePanel report={offline} onClose={() => setOffline(null)} />
      <Coach step={state.tutorial} hidden={coachHidden || state.tutorial >= TUTORIAL.length} />
    </div>
  );
}
