'use client';

import { useCallback, useRef, useState } from 'react';
import type { HeroRecord, RaidResult, RoomSlot, WorldEvent } from '../../game/types';
import { EDITABLE_ROOMS } from '../../game/types';
import { STAGE_MAX, stageDef, unlockStageOf } from '../../game/content/stages';
import { rushRamp, toDungeon, unlockSoulCost } from '../../game/state/economy';
import { effectCount, tickWorld, worldModifiers } from '../../game/state/world';
import { canPlace, unlockedFor, type GameState } from '../../game/state/save';
import { settleRaid, stageCleared as didClearStage } from '../../game/state/raidOutcome';
import {
  activeParty,
  advanceDay,
  beginCampaign,
  commitChoice,
  endCampaign,
  campaignIntel,
  isCheckpointDay,
  type CampaignState
} from '../../game/state/campaign';
import { HEROES } from '../../game/content/heroes';
import { simulateRaid } from '../../game/sim/raid';
import { systemRng } from '../../game/sim/rng';
import DungeonView from './DungeonView';
import { BuildSheet } from './panels/BuildSheet';
import { CodexSheet } from './panels/CodexSheet';
import { DayPanel } from './panels/DayPanel';
import { CampaignSheet } from './panels/CampaignSheet';
import { RoomPlacementView } from './panels/RoomPlacementView';
import { CampaignIdle } from './panels/CampaignIdle';
import { ExploreView } from './panels/ExploreView';
import { StubView } from './panels/StubView';
import { IntelSheet } from './panels/IntelSheet';
import { SettingsSheet } from './panels/SettingsSheet';
import { UpgradePanel } from './panels/UpgradePanel';
import { LordPickerSheet } from './panels/LordPickerSheet';
import { ShopPanel } from './panels/ShopPanel';
import { WorldSheet } from './panels/WorldSheet';
import { Coach, OfflinePanel, ResultPanel, TUTORIAL } from './overlays';
import { ICON, artVars } from './art';
import { useRaidDirector } from './useRaidDirector';
import { useGameState } from './useGameState';
import { play as sfx, startAmbient } from './audio';

type SheetKind = 'build' | 'codex' | 'settings' | 'world' | 'report' | 'intel' | 'guardian' | null;

type Tab = 'shop' | 'equipment' | 'campaign' | 'talent' | 'explore';

const MIN_WORLD_STAGE = 3;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'shop', label: 'Shop', icon: ICON.gold },
  { id: 'equipment', label: 'Rooms', icon: ICON.build },
  { id: 'campaign', label: 'Campaign', icon: ICON.raid },
  { id: 'talent', label: 'Talents', icon: ICON.lord },
  { id: 'explore', label: 'Explore', icon: ICON.world }
];

export default function GameShell() {
  const { state, raider, offline, setOffline, update, rollRaider, resetState } = useGameState();
  const [selected, setSelected] = useState(0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [justPlaced, setJustPlaced] = useState(-1);
  const [news, setNews] = useState<WorldEvent | null>(null);
  const [report, setReport] = useState<CampaignState | null>(null);
  const [result, setResult] = useState<RaidResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [stageCleared, setStageCleared] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [battleStep, setBattleStep] = useState(false);
  const [tab, setTab] = useState<Tab>('campaign');
  const [equipTab, setEquipTab] = useState<'rooms' | 'upgrades'>('rooms');
  const [arthur, setArthur] = useState(() => HEROES[Math.floor(Math.random() * HEROES.length)].id);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { view, play, speed, setSpeed } = useRaidDirector(scrollRef);
  const camp = state ? state.campaign : null;
  const onCampaign = camp !== null && camp.status === 'active';
  const busy = view.raiding || stepping;
  const locked = busy || onCampaign;
  // A fight or an open road takes the whole screen; otherwise a tab owns it.
  const battleMode = view.raiding || battleStep;
  const campaignMode = camp !== null && !battleMode;
  const takeover = battleMode || campaignMode;

  const advanceTutorial = useCallback(
    (from: number) => {
      update((s) => (s.tutorial === from ? { ...s, tutorial: s.tutorial + 1 } : s));
    },
    [update]
  );

  if (!state || !raider) {
    return (
      <div className="app" style={artVars}>
        <div className="stage" />
      </div>
    );
  }

  const stage = stageDef(state.stage);
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

  function openSheet(kind: SheetKind) {
    if (busy) return;
    setSheet(kind);
    sfx('tap');
    if (kind === 'world') update((s) => (s.world.unread === 0 ? s : { ...s, world: { ...s.world, unread: 0 } }));
  }

  async function startRaid(mode: GameState['mode']) {
    if (locked || !state || !raider) return;
    startAmbient();
    sfx('door');

    const arcade = mode === 'arcade';
    // The hero pool is mode-dependent, so draw for the mode being started
    // rather than the one the save is still in.
    const drawn = mode === state.mode ? raider : rollRaider({ ...state, mode });
    const heroLevel = arcade ? 1 + Math.floor((state.wave - 1) / 2) : stage.heroLevel;
    const record: HeroRecord = { ...drawn, level: Math.max(drawn.level, heroLevel) };
    const lordLevel = arcade ? state.lordLevel + Math.floor(state.wave / 4) : Math.max(state.lordLevel, stage.lordLevel);
    const dungeon = { ...toDungeon(state), lordLevel };
    const tier = arcade ? state.wave : state.stage;
    const world = worldModifiers(state.world);
    if (!arcade) {
      const ramp = rushRamp(state.stage, STAGE_MAX);
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

    const turned = tickWorld(state.world, arcade ? MIN_WORLD_STAGE : state.stage, systemRng);
    const settlement = { mode, record, dungeon, result: raidResult, world: turned.world };
    const cleared = didClearStage(state, settlement);
    update((cur) => settleRaid(cur, settlement));

    setResult(raidResult);
    setStageCleared(cleared);
    setNews(turned.fired);
    setResultOpen(true);
  }

  function closeResult() {
    if (!state) return;
    setResultOpen(false);
    sfx('tap');
    rollRaider(state);
  }

  function openUpgrades() {
    setEquipTab('upgrades');
    sfx('tap');
    if (state && state.tutorial === 4) advanceTutorial(4);
  }

  function openIntel() {
    if (locked || !state) return;
    setArthur(HEROES[Math.floor(Math.random() * HEROES.length)].id);
    setSheet('intel');
    sfx('tap');
  }

  function startCampaign() {
    if (locked || !state || !raider) return;
    startAmbient();
    sfx('door');
    setSheet(null);
    if (state.tutorial === 2) advanceTutorial(2);
    const chosen = state.guardianId;
    const king = arthur;
    update((s) => {
      const camp = beginCampaign(s, raider, systemRng, chosen);
      camp.setup.arthurDefId = king;
      return { ...s, campaign: camp };
    });
  }

  async function nextDay() {
    if (busy || !state || !camp || camp.pending) return;
    const battle = isCheckpointDay(camp);
    const wave = activeParty(camp);
    const fromRoom = Math.max(-1, camp.checkpoint - 1);
    setStepping(true);
    if (battle) {
      // Mount the dungeon before playback: the director captures scrollRef
      // synchronously, so it has to exist before play() is called.
      setBattleStep(true);
      await new Promise((r) => setTimeout(r, 0));
    }
    const outcome = advanceDay(camp, state.world);
    update((s) => ({ ...s, campaign: outcome.camp }));
    sfx(battle ? 'door' : 'tap');

    if (battle && outcome.events.length > 0 && wave.length > 0) {
      const seeds = wave.map((m) => ({
        name: m.hero.name,
        defId: m.hero.defId,
        hp: m.hero.hp,
        maxHp: m.hero.maxHp
      }));
      await play(outcome.events, seeds, fromRoom);
    }
    setBattleStep(false);
    setStepping(false);
  }

  function choose(optionId: string) {
    if (busy || !state || !camp) return;
    const outcome = commitChoice(camp, optionId, state.world);
    update((s) => ({ ...s, campaign: outcome.camp }));
    sfx('place');
  }

  function finishCampaign() {
    if (busy || !state || !camp || camp.status !== 'complete') return;
    const done = endCampaign(state, camp, systemRng);
    update(() => done.state);
    setReport(camp);
    setNews(done.fired);
    setSheet('report');
    sfx(camp.outcome === 'dungeonWin' ? 'win' : camp.outcome === 'heroEscape' ? 'escape' : 'lose');
    if (state.tutorial === 3) advanceTutorial(3);
    rollRaider(done.state);
  }

  function resetGame() {
    resetState();
    setSelected(0);
    setSheet(null);
    setReport(null);
    setResult(null);
    setResultOpen(false);
    sfx('lose');
  }

  function closeSheet() {
    setSheet(null);
    sfx('tap');
    if (state && state.tutorial === 5) advanceTutorial(5);
  }

  const coachHidden = busy || battleMode || sheet !== null || offline !== null;

  return (
    <div className="app" style={artVars}>
      <header className="hud plate">
        <div className="hud-left">
          <div className="hud-title">OWN A DUNGEON</div>
          <div className="hud-sub">
            {`Stage ${state.stage}/${STAGE_MAX} · ${stage.title}`}
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
        <button className="tab tab-icon btn" onClick={() => {}} disabled={busy} aria-label="Announcements">
          <img src={ICON.world} alt="" />
          {(state.world.unread > 0 || effectCount(state.world) > 0) && (
            <span className={'tab-dot' + (state.world.unread === 0 ? ' live' : '')} />
          )}
        </button>
        <button className="tab tab-icon btn push-right" onClick={() => openSheet('codex')} disabled={busy} aria-label="Codex">
          <img src={ICON.codex} alt="" />
        </button>
        <button className="tab tab-icon btn" onClick={() => openSheet('settings')} disabled={busy} aria-label="Settings">
          <img src={ICON.settings} alt="" />
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
          if (i >= 0 && i < EDITABLE_ROOMS) openSheet('build');
        }}
        onScrollRoom={setSelected}
        speed={speed}
        onSpeed={() => setSpeed(speed >= 8 ? 1 : speed * 2)}
        quiet={false}
        />
      )}

      {!takeover && tab === 'equipment' && (
        <div className="equip">
          <div className="subtabs">
            <button
              className={'subtab btn' + (equipTab === 'rooms' ? ' on' : '')}
              onClick={() => {
                setEquipTab('rooms');
                sfx('tap');
              }}
            >
              Rooms
            </button>
            <button
              className={'subtab btn' + (equipTab === 'upgrades' ? ' on' : '')}
              onClick={() => openUpgrades()}
            >
              Upgrades
            </button>
          </div>
          {equipTab === 'rooms' ? (
            <RoomPlacementView
              state={state}
              guardianLocked={onCampaign}
              onPickWeapon={() => {
                setTab('shop');
                sfx('tap');
              }}
              onPickGuardian={() => openSheet('guardian')}
              onOpenTalents={() => {
                setTab('talent');
                sfx('tap');
              }}
              onPickRoom={(i) => {
                if (i >= EDITABLE_ROOMS) {
                  openUpgrades();
                  return;
                }
                setSelected(i);
                openSheet('build');
              }}
            />
          ) : (
            <UpgradePanel
              state={state}
              onUpgrade={upgrade}
              onLord={upgradeLord}
            />
          )}
        </div>
      )}

      {!takeover && tab === 'shop' && (
        <ShopPanel state={state} onBuy={buyLordWeapon} onEquip={equipLordWeapon} />
      )}
      {!takeover && tab === 'talent' && (
        <StubView title="Talent Tree" note="Nekrokos has learned nothing new. Yet." />
      )}
      {!takeover && tab === 'explore' && (
        <ExploreView
          state={state}
          locked={locked}
          onRush={() => startRaid('rush')}
          onArcade={() => startRaid('arcade')}
        />
      )}

      {campaignMode && camp && (
        <DayPanel camp={camp} busy={busy} onChoose={choose} onNextDay={nextDay} onFinish={finishCampaign} />
      )}

      {!takeover && tab === 'campaign' && (
        <CampaignIdle
          campaignNumber={state.campaignNumber}
          bestDays={state.bestDaysByCampaign[state.campaignNumber] || 0}
          locked={locked}
          onStart={openIntel}
        />
      )}

      {!takeover && (
        <nav className="tabbar">
          {TABS.map((t) => (
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
        onClose={closeSheet}
        onPlace={place}
        onBuy={buyUnlock}
      />
      <LordPickerSheet
        open={sheet === 'guardian'}
        state={state}
        locked={onCampaign}
        onPick={(id) => {
          if (!onCampaign) update((cur) => ({ ...cur, guardianId: id }));
          setSheet(null);
        }}
        onClose={closeSheet}
      />
      <CodexSheet open={sheet === 'codex'} state={state} onClose={closeSheet} />
      <WorldSheet open={sheet === 'world'} state={state} onClose={closeSheet} />
      <SettingsSheet open={sheet === 'settings'} state={state} onClose={closeSheet} onReset={resetGame} />

      <IntelSheet
        open={sheet === 'intel'}
        intel={campaignIntel(state, arthur)}
        guardianId={state.guardianId}
        onStart={startCampaign}
        onClose={closeSheet}
      />
      <CampaignSheet open={sheet === 'report'} camp={report} onClose={closeSheet} />
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
