'use client';

import { useCallback, useRef, useState } from 'react';
import type { RoomSlot, WorldEvent } from '../../game/types';
import { EDITABLE_ROOMS } from '../../game/types';
import { STAGE_MAX, stageDef, unlockStageOf } from '../../game/content/stages';
import { LORD } from '../../game/content/monsters';
import { dungeonPower, unlockSoulCost } from '../../game/state/economy';
import { effectCount } from '../../game/state/world';
import { canPlace, unlockedFor } from '../../game/state/save';
import { returningNote } from '../../game/state/roster';
import {
  activeParty,
  advanceDay,
  beginExpedition,
  commitChoice,
  endExpedition,
  expeditionIntel,
  isCheckpointDay,
  type ExpeditionState
} from '../../game/state/expedition';
import { HEROES } from '../../game/content/heroes';
import { MONSTERS } from '../../game/content/monsters';
import { systemRng } from '../../game/sim/rng';
import DungeonView from './DungeonView';
import { BuildSheet } from './panels/BuildSheet';
import { CodexSheet } from './panels/CodexSheet';
import { DayPanel } from './panels/DayPanel';
import { ExpeditionSheet } from './panels/ExpeditionSheet';
import { IntelSheet } from './panels/IntelSheet';
import { SettingsSheet } from './panels/SettingsSheet';
import { UpgradeSheet } from './panels/UpgradeSheet';
import { WorldSheet } from './panels/WorldSheet';
import { Coach, HeroTeaser, OfflinePanel, TUTORIAL } from './overlays';
import { ICON, artVars, contentArt, heroArt } from './art';
import { CELL, useRaidDirector } from './useRaidDirector';
import { useGameState } from './useGameState';
import { play as sfx, startAmbient } from './audio';

type SheetKind = 'build' | 'upgrade' | 'codex' | 'settings' | 'world' | 'report' | 'intel' | null;

export default function GameShell() {
  const { state, raider, offline, setOffline, update, rollRaider, resetState } = useGameState();
  const [selected, setSelected] = useState(0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [justPlaced, setJustPlaced] = useState(-1);
  const [news, setNews] = useState<WorldEvent | null>(null);
  const [report, setReport] = useState<ExpeditionState | null>(null);
  const [stepping, setStepping] = useState(false);
  const [battleStep, setBattleStep] = useState(false);
  const [guardian, setGuardian] = useState(MONSTERS[0].id);
  const [arthur, setArthur] = useState(() => HEROES[Math.floor(Math.random() * HEROES.length)].id);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { view, play, speed, setSpeed } = useRaidDirector(scrollRef);
  const exp = state ? state.expedition : null;
  const onExpedition = exp !== null && exp.status === 'active';
  const busy = view.raiding || stepping;
  const locked = busy || onExpedition;
  // Three layouts: building the dungeon, reading the road, watching a fight.
  const battleMode = view.raiding || battleStep;
  const storyMode = exp !== null && !battleMode;


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
    if (kind === 'upgrade' && state && state.tutorial === 4) advanceTutorial(4);
    if (kind === 'world') update((s) => (s.world.unread === 0 ? s : { ...s, world: { ...s.world, unread: 0 } }));
  }

  function openIntel() {
    if (locked || !state) return;
    setArthur(HEROES[Math.floor(Math.random() * HEROES.length)].id);
    setSheet('intel');
    sfx('tap');
  }

  function startExpedition() {
    if (locked || !state || !raider) return;
    startAmbient();
    sfx('door');
    setSheet(null);
    if (state.tutorial === 2) advanceTutorial(2);
    const chosen = guardian;
    const king = arthur;
    update((s) => {
      const exp = beginExpedition(s, raider, systemRng, chosen);
      exp.setup.arthurDefId = king;
      return { ...s, expedition: exp };
    });
  }

  async function nextDay() {
    if (busy || !state || !exp || exp.pending) return;
    const battle = isCheckpointDay(exp);
    const wave = activeParty(exp);
    const fromRoom = Math.max(-1, exp.checkpoint - 1);
    setStepping(true);
    if (battle) {
      // Mount the dungeon before playback: the director captures scrollRef
      // synchronously, so it has to exist before play() is called.
      setBattleStep(true);
      await new Promise((r) => setTimeout(r, 0));
    }
    const outcome = advanceDay(exp, state.world);
    update((s) => ({ ...s, expedition: outcome.exp }));
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
    if (busy || !state || !exp) return;
    const outcome = commitChoice(exp, optionId, state.world);
    update((s) => ({ ...s, expedition: outcome.exp }));
    sfx('place');
  }

  function finishExpedition() {
    if (busy || !state || !exp || exp.status !== 'complete') return;
    const done = endExpedition(state, exp, systemRng);
    update(() => done.state);
    setReport(exp);
    setNews(done.fired);
    setSheet('report');
    sfx(exp.outcome === 'dungeonWin' ? 'win' : exp.outcome === 'heroEscape' ? 'escape' : 'lose');
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

  const veteranNote = returningNote(raider);
  const coachHidden = busy || sheet !== null || offline !== null || exp !== null;

  return (
    <div className="app" style={artVars}>
      <header className="hud plate">
        <div className="hud-left">
          <div className="hud-title">OWN A DUNGEON</div>
          <div className="hud-sub">
            {`Stage ${state.stage}/${STAGE_MAX} · ${stage.title}`}
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
        <button className="tab tab-icon btn" onClick={() => openSheet('codex')} disabled={busy} aria-label="Codex">
          <img src={ICON.codex} alt="" />
        </button>
        <button className="tab tab-icon btn" onClick={() => openSheet('settings')} disabled={busy} aria-label="Settings">
          <img src={ICON.settings} alt="" />
        </button>
      </nav>

      {!storyMode && (
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

      {!storyMode && !battleMode && (
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
      )}

      {storyMode && exp ? (
        <DayPanel exp={exp} busy={busy} onChoose={choose} onNextDay={nextDay} onFinish={finishExpedition} />
      ) : battleMode ? null : (
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
      )}

      {!battleMode && !storyMode && (
        <div className="bottom">
          {
            <>
              <button
                className="side btn"
                onClick={() => {
                  if (selected < 0 || selected >= EDITABLE_ROOMS) {
                    setSelected(0);
                    scrollToRoom(0);
                  }
                  openSheet('build');
                }}
                disabled={locked}
                aria-label="Build"
              >
                <img src={ICON.build} alt="" />
              </button>
              <button className="raid btn" onClick={openIntel} disabled={locked}>
                <img src={ICON.raid} alt="" />
                EXPEDITION
              </button>
              <button className="side btn" onClick={() => openSheet('upgrade')} disabled={locked} aria-label="Upgrade">
                <img src={ICON.upgrade} alt="" />
              </button>
            </>
          }
        </div>
      )}

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

      <IntelSheet
        open={sheet === 'intel'}
        intel={expeditionIntel(state, arthur)}
        guardianId={guardian}
        onPick={(id) => {
          setGuardian(id);
          sfx('tap');
        }}
        onStart={startExpedition}
        onClose={closeSheet}
      />
      <ExpeditionSheet open={sheet === 'report'} exp={report} onClose={closeSheet} />
      <OfflinePanel report={offline} onClose={() => setOffline(null)} />
      <Coach step={state.tutorial} hidden={coachHidden || state.tutorial >= TUTORIAL.length} />
    </div>
  );
}
