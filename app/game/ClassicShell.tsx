'use client';

import { useRef, useState } from 'react';
import type { HeroRecord, RaidResult, RoomSlot, WorldEvent } from '../../game/types';
import { EDITABLE_ROOMS } from '../../game/types';
import { STAGE_MAX, stageDef, unlockStageOf } from '../../game/content/stages';
import { rushRamp, toDungeon, unlockSoulCost } from '../../game/state/economy';
import { tickWorld, worldModifiers } from '../../game/state/world';
import { canPlace, unlockedFor, type GameState } from '../../game/state/save';
import { classicStageCleared, settleClassicRaid } from '../../game/state/classicOutcome';
import { pickRaider } from '../../game/state/roster';
import { HEROES } from '../../game/content/heroes';
import { simulateRaid } from '../../game/sim/raid';
import { systemRng } from '../../game/sim/rng';
import DungeonView from './DungeonView';
import { BuildSheet } from './panels/BuildSheet';
import { CodexSheet } from './panels/CodexSheet';
import { SettingsSheet } from './panels/SettingsSheet';
import { ClassicHomePanel } from './panels/ClassicHomePanel';
import { ClassicShopPanel } from './panels/ClassicShopPanel';
import { ContentLevelPanel } from './panels/ContentLevelPanel';
import { RoomGrid } from './panels/RoomGrid';
import { MilestoneToast, ResultPanel } from './overlays';
import { useMilestoneToasts } from './useMilestoneToasts';
import { ICON, artVars } from './art';
import { useRaidDirector } from './useRaidDirector';
import { play as sfx, startAmbient } from './audio';

type ClassicTab = 'shop' | 'classic' | 'upgrade';
type ClassicSheet = 'build' | 'codex' | 'settings' | null;

const CLASSIC_TABS: { id: ClassicTab; label: string; icon: string }[] = [
  { id: 'shop', label: 'Shop', icon: ICON.gold },
  { id: 'classic', label: 'Classic', icon: ICON.raid },
  { id: 'upgrade', label: 'Upgrade', icon: ICON.upgrade }
];

interface ClassicShellProps {
  state: GameState;
  update: (fn: (s: GameState) => GameState) => void;
  onExit: () => void;
  onReset: () => void;
}

export function ClassicShell({ state, update, onExit, onReset }: ClassicShellProps) {
  const [raider, setRaider] = useState<HeroRecord>(() =>
    pickRaider(state.roster, heroPoolFor(state), stageDef(state.classic.stage).heroLevel, systemRng)
  );
  const [classicSub, setClassicSub] = useState<'rush' | 'arcade'>('rush');
  const [tab, setTab] = useState<ClassicTab>('classic');
  const [sheet, setSheet] = useState<ClassicSheet>(null);
  const [selected, setSelected] = useState(0);
  const [justPlaced, setJustPlaced] = useState(-1);
  const [stepping, setStepping] = useState(false);
  const [battleStep, setBattleStep] = useState(false);
  const [result, setResult] = useState<RaidResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [stageCleared, setStageCleared] = useState(false);
  const [news, setNews] = useState<WorldEvent | null>(null);
  const { activeToast, queueToasts } = useMilestoneToasts();

  const scrollRef = useRef<HTMLDivElement>(null);
  const { view, play, speed, setSpeed } = useRaidDirector(scrollRef);
  const busy = view.raiding || stepping;
  const battleMode = view.raiding || battleStep;
  const stage = stageDef(state.classic.stage);

  function heroPool(mode: 'rush' | 'arcade'): string[] {
    return mode === 'arcade' ? HEROES.map((h) => h.id) : stageDef(state.classic.stage).heroPool;
  }

  function rerollRaider(mode: 'rush' | 'arcade') {
    const next = pickRaider(state.roster, heroPool(mode), stage.heroLevel, systemRng);
    setRaider(next);
    return next;
  }

  async function startClassicRaid(mode: 'rush' | 'arcade') {
    if (busy) return;
    startAmbient();
    sfx('door');

    const arcade = mode === 'arcade';
    const drawn = mode === state.classic.mode ? raider : rerollRaider(mode);
    const heroLevel = arcade ? 1 + Math.floor((state.classic.wave - 1) / 2) : stage.heroLevel;
    const record: HeroRecord = { ...drawn, level: Math.max(drawn.level, heroLevel) };
    const lordLevel = arcade
      ? state.lordLevel + Math.floor(state.classic.wave / 4)
      : Math.max(state.lordLevel, stage.lordLevel);
    const dungeon = { ...toDungeon(state), lordLevel };
    const tier = arcade ? state.classic.wave : state.classic.stage;
    const world = worldModifiers(state.world);
    if (!arcade) {
      const ramp = rushRamp(state.classic.stage, STAGE_MAX);
      world.heroAtk *= ramp;
      world.heroHp *= ramp;
    }
    const raidResult = simulateRaid(dungeon, record, tier, { world });

    setStepping(true);
    setBattleStep(true);
    await new Promise((r) => setTimeout(r, 0));
    await play(raidResult.events, [
      { name: record.name, defId: record.defId, hp: raidResult.hero.maxHp, maxHp: raidResult.hero.maxHp }
    ]);
    setBattleStep(false);
    setStepping(false);

    const turned = tickWorld(state.world, state.classic.stage, systemRng);
    const settlement = { mode, record, dungeon, result: raidResult, world: turned.world };
    const cleared = classicStageCleared(state, settlement);
    const settled = settleClassicRaid(state, settlement);
    const earned = settled.unlockedMilestones.filter((id) => !state.unlockedMilestones.includes(id));
    update(() => settled);
    queueToasts(earned);

    setResult(raidResult);
    setStageCleared(cleared);
    setNews(turned.fired);
    setResultOpen(true);
  }

  function closeResult() {
    setResultOpen(false);
    sfx('tap');
    rerollRaider(classicSub);
  }

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
  }

  function buyUnlock(id: string, goldCost: number) {
    update((s) => {
      if (s.bought.includes(id)) return s;
      const price = unlockSoulCost(goldCost, unlockStageOf(id), s.classic.stage);
      if (s.classic.souls < price) return s;
      const bought = [...s.bought, id];
      return {
        ...s,
        classic: { ...s.classic, souls: s.classic.souls - price },
        bought,
        unlocked: [...new Set([...unlockedFor(Math.max(s.classic.stage, s.classic.maxStageCleared + 1)), ...bought])]
      };
    });
    sfx('coin');
  }

  function upgradeContent(id: string, cost: number) {
    update((s) =>
      s.classic.gold < cost
        ? s
        : { ...s, classic: { ...s.classic, gold: s.classic.gold - cost }, levels: { ...s.levels, [id]: (s.levels[id] || 1) + 1 } }
    );
    sfx('place');
  }

  return (
    <div className="app" style={artVars}>
      <header className="hud plate">
        <div className="hud-left hud-lord">
          <span className="hud-portrait inset">
            <img src={ICON.lord} alt="" />
          </span>
          <span className="hud-lord-info">
            <div className="hud-title">Nekrokos</div>
            <div className="hud-sub">{`Level: ${state.lordLevel}`}</div>
          </span>
        </div>
        <div className="hud-right">
          <span className="coin">
            <img src={ICON.gold} alt="Gold" />
            {state.classic.gold}
          </span>
          <span className="coin souls">
            <img src={ICON.soul} alt="Souls" />
            {state.classic.souls}
          </span>
        </div>
      </header>

      <nav className="tabs">
        <button className="tab tab-icon btn push-right" onClick={() => setSheet('codex')} disabled={busy} aria-label="Codex">
          <img src={ICON.codex} alt="" />
        </button>
        <button className="tab tab-icon btn" onClick={() => setSheet('settings')} disabled={busy} aria-label="Settings">
          <img src={ICON.settings} alt="" />
        </button>
        <button className="tab tab-icon btn" onClick={onExit} disabled={busy} aria-label="Back to Main">
          <img src={ICON.clear} alt="" />
        </button>
      </nav>

      {battleMode && (
        <DungeonView
          rooms={state.rooms}
          levels={state.levels}
          selected={selected}
          justPlaced={justPlaced}
          view={view}
          scrollRef={scrollRef}
          onSelect={(i) => {
            setSelected(i);
            if (i >= 0 && i < EDITABLE_ROOMS) setSheet('build');
          }}
          onScrollRoom={setSelected}
          speed={speed}
          onSpeed={() => setSpeed(speed >= 8 ? 1 : speed * 2)}
          quiet={false}
        />
      )}

      {!battleMode && tab === 'shop' && <ClassicShopPanel />}
      {!battleMode && tab === 'classic' && (
        <ClassicHomePanel
          state={state}
          locked={busy}
          onRush={() => {
            setClassicSub('rush');
            startClassicRaid('rush');
          }}
          onArcade={() => {
            setClassicSub('arcade');
            startClassicRaid('arcade');
          }}
        />
      )}
      {!battleMode && tab === 'upgrade' && (
        <div className="place">
          <RoomGrid
            rooms={state.rooms}
            levels={state.levels}
            onPickRoom={(i) => {
              setSelected(i);
              setSheet('build');
            }}
          />
          <p className="place-rule">Tap a room to change what waits in it.</p>
          <ContentLevelPanel unlocked={state.unlocked} levels={state.levels} gold={state.classic.gold} onUpgrade={upgradeContent} />
        </div>
      )}

      {!battleMode && (
        <nav className="tabbar">
          {CLASSIC_TABS.map((t) => (
            <button
              key={t.id}
              className={'navtab' + (tab === t.id ? ' on' : '')}
              onClick={() => {
                setTab(t.id);
                sfx('tap');
              }}
              aria-pressed={tab === t.id}
            >
              <img src={t.icon} alt="" />
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <BuildSheet
        open={sheet === 'build'}
        room={Math.max(0, Math.min(EDITABLE_ROOMS - 1, selected))}
        state={state}
        onClose={() => setSheet(null)}
        onPlace={place}
        onBuy={buyUnlock}
      />
      <CodexSheet open={sheet === 'codex'} state={state} onClose={() => setSheet(null)} />
      <SettingsSheet open={sheet === 'settings'} state={state} onClose={() => setSheet(null)} onReset={onReset} />
      <ResultPanel
        open={resultOpen}
        result={result}
        stageCleared={stageCleared}
        nextBrief={stage.teaches}
        news={news}
        onClose={closeResult}
      />
      <MilestoneToast item={activeToast} />
    </div>
  );
}

function heroPoolFor(state: GameState): string[] {
  return state.classic.mode === 'arcade' ? HEROES.map((h) => h.id) : stageDef(state.classic.stage).heroPool;
}
