'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeroRecord, RoomSlot, WorldEvent } from '../../game/types';
import { EDITABLE_ROOMS } from '../../game/types';
import { stageDef } from '../../game/content/stages';
import { effectCount } from '../../game/state/world';
import type { GameState } from '../../game/state/save';
import { settleRaid, stageCleared as didClearStage } from '../../game/state/raidOutcome';
import {
  activeParty,
  advanceDay,
  beginCampaign,
  commitChoice,
  endCampaign,
  campaignIntel,
  isCheckpointDay,
  isFinalDay,
  levelRunContent,
  placeRunRoom,
  type CampaignState
} from '../../game/state/campaign';
import { HEROES } from '../../game/content/heroes';
import { TALENT_MAX } from '../../game/content/talents';
import { systemRng } from '../../game/sim/rng';
import DungeonView from './DungeonView';
import { ClassicShell } from './ClassicShell';
import { CodexSheet } from './panels/CodexSheet';
import { StatusPanel } from './panels/StatusPanel';
import { RoomPrepView } from './panels/RoomPrepView';
import { PastEventPanel } from './panels/PastEventPanel';
import { PrepBuildSheet } from './panels/PrepBuildSheet';
import { CampaignSheet } from './panels/CampaignSheet';
import { ArmoryView } from './panels/ArmoryView';
import { CampaignIdle } from './panels/CampaignIdle';
import { ExploreView } from './panels/ExploreView';
import { IntelSheet } from './panels/IntelSheet';
import { SettingsSheet } from './panels/SettingsSheet';
import { UpgradePanel } from './panels/UpgradePanel';
import { TalentPanel } from './panels/TalentPanel';
import { LordPickerSheet } from './panels/LordPickerSheet';
import { ShopPanel } from './panels/ShopPanel';
import { WorldSheet } from './panels/WorldSheet';
import { Coach, MilestoneToast, OfflinePanel, TUTORIAL } from './overlays';
import { useMilestoneToasts } from './useMilestoneToasts';
import { ICON, artVars } from './art';
import { useRaidDirector } from './useRaidDirector';
import { useGameState } from './useGameState';
import { play as sfx, startAmbient } from './audio';

type SheetKind = 'prepBuild' | 'codex' | 'settings' | 'world' | 'report' | 'intel' | 'guardian' | null;

type Tab = 'shop' | 'equipment' | 'campaign' | 'talent' | 'explore';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'shop', label: 'Shop', icon: ICON.gold },
  { id: 'equipment', label: 'Armory', icon: ICON.build },
  { id: 'campaign', label: 'Campaign', icon: ICON.raid },
  { id: 'talent', label: 'Talents', icon: ICON.lord },
  { id: 'explore', label: 'Explore', icon: ICON.world }
];

type CampTab = 'status' | 'roomPrep' | 'pastEvent';

const CAMP_TABS: { id: CampTab; label: string; icon: string }[] = [
  { id: 'status', label: 'Status', icon: ICON.raid },
  { id: 'roomPrep', label: 'Room Prep', icon: ICON.build },
  { id: 'pastEvent', label: 'Past Event', icon: ICON.codex }
];

export default function GameShell() {
  const { state, raider, offline, setOffline, update, rollRaider, resetState } = useGameState();
  const [selected, setSelected] = useState(0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [news, setNews] = useState<WorldEvent | null>(null);
  const [report, setReport] = useState<CampaignState | null>(null);
  const [reportPayout, setReportPayout] = useState<{ gold: number; souls: number } | null>(null);
  const [stepping, setStepping] = useState(false);
  const [battleStep, setBattleStep] = useState(false);
  const [tab, setTab] = useState<Tab>('campaign');
  const [equipTab, setEquipTab] = useState<'rooms' | 'upgrades'>('rooms');
  const [campTab, setCampTab] = useState<CampTab>('status');
  const [prepRoom, setPrepRoom] = useState(0);
  const [arthur, setArthur] = useState<string | null>(null);
  const [classicOpen, setClassicOpen] = useState(false);
  const { activeToast, queueToasts } = useMilestoneToasts();

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

  useEffect(() => {
    if (camp?.pending) setCampTab('status');
  }, [camp?.pending]);

  if (!state || !raider) {
    return (
      <div className="app" style={artVars}>
        <div className="stage" />
      </div>
    );
  }

  if (classicOpen) {
    return <ClassicShell state={state} update={update} onExit={() => setClassicOpen(false)} onReset={resetGame} />;
  }

  const stage = stageDef(state.stage);

  function placeInPrep(slot: RoomSlot) {
    if (!camp) return;
    update((s) => (s.campaign ? { ...s, campaign: placeRunRoom(s.campaign, prepRoom, slot) } : s));
    setSheet(null);
    sfx('place');
  }

  function levelPrep(id: string, goldCost: number) {
    update((s) => (s.campaign ? { ...s, campaign: levelRunContent(s.campaign, id, goldCost) } : s));
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

  function buyTalent(index: number, souls: number) {
    update((s) =>
      s.talentLevel !== index || s.souls < souls || index >= TALENT_MAX
        ? s
        : { ...s, souls: s.souls - souls, talentLevel: index + 1 }
    );
    sfx('lord');
  }

  function openSheet(kind: SheetKind) {
    if (busy) return;
    setSheet(kind);
    sfx('tap');
    if (kind === 'world') update((s) => (s.world.unread === 0 ? s : { ...s, world: { ...s.world, unread: 0 } }));
  }

  function openUpgrades() {
    setEquipTab('upgrades');
    sfx('tap');
    if (state && state.tutorial === 4) advanceTutorial(4);
  }

  function openIntel() {
    if (locked || !state) return;
    if (arthur === null) setArthur(HEROES[Math.floor(Math.random() * HEROES.length)].id);
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
    const king = arthur || HEROES[Math.floor(Math.random() * HEROES.length)].id;
    setArthur(null);
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
    const fromRoom = isFinalDay(camp) ? EDITABLE_ROOMS - 1 : -1;
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
    const earned = done.state.unlockedMilestones.filter((id) => !state.unlockedMilestones.includes(id));
    update(() => done.state);
    setReport(camp);
    setReportPayout(done.payout);
    setNews(done.fired);
    setSheet('report');
    sfx(camp.outcome === 'dungeonWin' ? 'win' : camp.outcome === 'heroEscape' ? 'escape' : 'lose');
    queueToasts(earned);
    if (state.tutorial === 3) advanceTutorial(3);
    rollRaider(done.state);
  }

  function resetGame() {
    resetState();
    setSelected(0);
    setSheet(null);
    setReport(null);
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
            {state.gold}
          </span>
          <span className="coin souls">
            <img src={ICON.soul} alt="Souls" />
            {state.souls}
          </span>
        </div>
      </header>

      <nav className="tabs">
        <button className="tab tab-icon btn" onClick={() => openSheet('world')} disabled={busy} aria-label="Announcements">
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
        rooms={camp ? camp.runRooms : state.rooms}
        levels={camp ? camp.runLevels : state.levels}
        selected={selected}
        justPlaced={-1}
        view={view}
        scrollRef={scrollRef}
        onSelect={setSelected}
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
              Overview
            </button>
            <button
              className={'subtab btn' + (equipTab === 'upgrades' ? ' on' : '')}
              onClick={() => openUpgrades()}
            >
              Upgrades
            </button>
          </div>
          {equipTab === 'rooms' ? (
            <ArmoryView
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
            />
          ) : (
            <UpgradePanel state={state} onLord={upgradeLord} />
          )}
        </div>
      )}

      {!takeover && tab === 'shop' && (
        <ShopPanel state={state} onBuy={buyLordWeapon} onEquip={equipLordWeapon} />
      )}
      {!takeover && tab === 'talent' && <TalentPanel state={state} onBuy={buyTalent} />}
      {!takeover && tab === 'explore' && (
        <ExploreView locked={locked} onClassic={() => setClassicOpen(true)} />
      )}

      {campaignMode && camp && (
        <>
          {campTab === 'status' && (
            <StatusPanel camp={camp} busy={busy} onChoose={choose} onNextDay={nextDay} onFinish={finishCampaign} />
          )}
          {campTab === 'roomPrep' && (
            <RoomPrepView
              camp={camp}
              onPickRoom={(i) => {
                setPrepRoom(i);
                openSheet('prepBuild');
              }}
              onLevel={levelPrep}
            />
          )}
          {campTab === 'pastEvent' && <PastEventPanel camp={camp} />}
          <nav className="tabbar">
            {CAMP_TABS.map((t) => (
              <button
                key={t.id}
                className={'navtab' + (campTab === t.id ? ' on' : '')}
                onClick={() => {
                  setCampTab(t.id);
                  sfx('tap');
                }}
                aria-pressed={campTab === t.id}
              >
                <img src={t.icon} alt="" />
                {t.label}
              </button>
            ))}
          </nav>
        </>
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

      {camp && (
        <PrepBuildSheet
          open={sheet === 'prepBuild'}
          room={Math.max(0, Math.min(EDITABLE_ROOMS - 1, prepRoom))}
          rooms={camp.runRooms}
          levels={camp.runLevels}
          unlocked={camp.runUnlocked}
          onClose={closeSheet}
          onPlace={placeInPrep}
        />
      )}
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
        intel={arthur ? campaignIntel(state, arthur) : null}
        guardianId={state.guardianId}
        onStart={startCampaign}
        onClose={closeSheet}
      />
      <CampaignSheet
        open={sheet === 'report'}
        camp={report}
        payout={reportPayout}
        news={sheet === 'report' ? news : null}
        onClose={closeSheet}
      />
      <OfflinePanel report={offline} onClose={() => setOffline(null)} />
      <Coach step={state.tutorial} hidden={coachHidden || state.tutorial >= TUTORIAL.length} />
      <MilestoneToast item={activeToast} />
    </div>
  );
}
