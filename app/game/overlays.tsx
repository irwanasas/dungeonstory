'use client';

import type { Outcome, RaidResult, RoomKind, WorldEvent } from '../../game/types';
import { heroDef } from '../../game/content/heroes';
import { LORD, monsterDef } from '../../game/content/monsters';
import { trapDef } from '../../game/content/traps';
import type { OfflineReport } from '../../game/sim/offline';
import { ICON, heroArt } from './art';

export const OUTCOME_COPY: Record<Outcome, { title: string; desc: string; cls: string }> = {
  dungeonWin: {
    title: 'DUNGEON HELD',
    desc: 'They never reached the throne. Your dungeon ate them.',
    cls: 'win'
  },
  heroEscape: {
    title: 'THEY RAN',
    desc: 'Hurt, empty-handed, and alive. They will be back.',
    cls: 'escape'
  },
  heroVictory: {
    title: 'DUNGEON BREACHED',
    desc: `They cut through everything and put ${LORD.short} down. Rebuild.`,
    cls: 'loss'
  }
};

function summarize(result: RaidResult): string[] {
  const lines: string[] = [];
  const hero = heroDef(result.hero.defId);
  lines.push(`${result.hero.name} the ${hero.name} came in at level ${result.hero.level}.`);

  let lastRoom = -1;
  let lastKind: RoomKind = 'empty';
  let lastId: string | null = null;
  const seen = new Set<string>();

  for (const e of result.events) {
    if (e.t === 'enterRoom') {
      lastRoom = e.room;
      lastKind = e.kind;
      lastId = e.contentId;
    }
    if (e.t === 'interaction' && !seen.has(e.id)) {
      seen.add(e.id);
      lines.push(`${e.name} triggered — ${e.hint}`);
    }
    if (e.t === 'trapFire' && e.disarmed) lines.push(`Disarmed your ${trapDef(e.trapId).name} in room ${lastRoom + 1}.`);
    if (e.t === 'monsterDown' && e.monsterId !== 'lord') lines.push(`Your ${monsterDef(e.monsterId).name} fell in room ${lastRoom + 1}.`);
    if (e.t === 'treasureTaken') lines.push(`Pocketed ${e.gold} gold and kept walking.`);
    if (e.t === 'ability' && e.id === 'rage') lines.push('Went into a rage instead of dying quietly.');
  }

  if (result.outcome === 'dungeonWin') {
    const where = lastKind === 'throne' ? 'at the throne' : `in room ${lastRoom + 1}`;
    const by = lastKind === 'trap' && lastId ? ` on your ${trapDef(lastId).name}` : lastKind === 'monster' && lastId ? ` to your ${monsterDef(lastId).name}` : '';
    lines.push(`Died ${where}${by}.`);
  } else if (result.outcome === 'heroEscape') {
    lines.push(`Turned back after ${result.roomsCleared} room${result.roomsCleared === 1 ? '' : 's'}.`);
  } else {
    lines.push('Walked out through the Throne Room.');
  }

  return lines.slice(0, 6);
}

interface ResultProps {
  open: boolean;
  result: RaidResult | null;
  stageCleared: boolean;
  nextBrief: string | null;
  news: WorldEvent | null;
  onClose: () => void;
}

export function ResultPanel({ open, result, stageCleared, nextBrief, news, onClose }: ResultProps) {
  const copy = result ? OUTCOME_COPY[result.outcome] : null;
  return (
    <>
      <div className={'scrim' + (open ? ' on' : '')} />
      <div className={'modal frame' + (open ? ' on' : '')} role="dialog">
        {result && copy && (
          <div className="modal-inner">
            <div className={'modal-title ' + copy.cls}>{copy.title}</div>
            <div className="modal-desc">{copy.desc}</div>
            <ul className="log">
              {summarize(result).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
            {news && (
              <div className="news">
                <span className={'tone-tag ' + news.tone}>{news.category}</span>
                <span>{news.headline}</span>
              </div>
            )}
            <div className="rewards">
              <span className="reward">
                <img src={ICON.gold} alt="" />+{result.gold}
              </span>
              <span className="reward souls">
                <img src={ICON.soul} alt="" />+{result.souls}
              </span>
              {result.goldStolen > 0 && (
                <span className="reward bad">
                  <img src={ICON.gold} alt="" />-{result.goldStolen}
                </span>
              )}
            </div>
            {stageCleared && (
              <div className="modal-desc">
                <strong style={{ color: 'var(--gold-lit)' }}>Stage cleared.</strong> {nextBrief}
              </div>
            )}
            <button className="modal-btn btn" onClick={onClose}>
              Continue
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function duration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function OfflinePanel({ report, onClose }: { report: OfflineReport | null; onClose: () => void }) {
  const open = report !== null;
  return (
    <>
      <div className={'scrim' + (open ? ' on' : '')} />
      <div className={'modal frame' + (open ? ' on' : '')} role="dialog">
        {report && (
          <div className="modal-inner">
            <div className="modal-title escape">YOUR DUNGEON WAS RAIDED</div>
            <div className="modal-desc">
              {duration(report.elapsedMs)} away &middot; {report.raids} raids while you were gone.
            </div>
            <ul className="log">
              <li>{report.defeated} heroes died in your rooms.</li>
              <li>{report.escaped} turned back and ran.</li>
              <li>{report.breached} reached the throne and beat {LORD.short}.</li>
              {report.goldStolen > 0 && <li>{report.goldStolen} gold walked out with them.</li>}
            </ul>
            <div className="rewards">
              <span className="reward">
                <img src={ICON.gold} alt="" />+{report.gold}
              </span>
              <span className="reward souls">
                <img src={ICON.soul} alt="" />+{report.souls}
              </span>
            </div>
            <button className="modal-btn btn" onClick={onClose}>
              Collect
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export interface CoachStep {
  text: string;
  pos: 'low' | 'mid' | 'high';
}

export const TUTORIAL: CoachStep[] = [
  { text: 'This is your dungeon. Six rooms. Swipe across them, then tap a room to put something inside.', pos: 'mid' },
  { text: 'Good. Fill another room or two — the order they meet things is the whole game.', pos: 'mid' },
  { text: 'A campaign is forming. Start it, then walk the days with them until they reach your gate.', pos: 'low' },
  { text: 'That was your dungeon working. Take what it earned.', pos: 'mid' },
  { text: 'Gold makes your traps and monsters hurt more. Spend it.', pos: 'low' },
  { text: 'Now change the dungeon and run it again. The same heroes come back smarter.', pos: 'low' }
];

export function Coach({ step, hidden }: { step: number; hidden: boolean }) {
  const item = TUTORIAL[step];
  const open = !!item && !hidden;
  return (
    <div className={'coach' + (open ? ' on' : '') + ' ' + (item ? item.pos : 'low')}>
      {item && (
        <div className="coach-inner frame">
          <span className="coach-step">{step + 1}/{TUTORIAL.length}</span>
          <span className="coach-text">{item.text}</span>
        </div>
      )}
    </div>
  );
}

export function HeroTeaser({
  defId,
  name,
  title,
  note,
  raiding,
  status
}: {
  defId: string;
  name: string;
  title: string;
  note: string | null;
  raiding: boolean;
  status: string;
}) {
  const def = heroDef(defId);
  if (raiding) {
    return (
      <div className="teaser">
        <img src={heroArt(defId)} alt="" />
        <div className="teaser-body">
          <div className="teaser-name">
            {name} {title}
          </div>
          <div className="teaser-note">{status}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="teaser">
      <img src={heroArt(defId)} alt="" />
      <div className="teaser-body">
        <div className="teaser-name">
          {name} {title} &middot; {def.name}
        </div>
        <div className="teaser-note">
          {note ? <span className="teaser-scar">{note} </span> : null}
          {def.strengths}
        </div>
      </div>
    </div>
  );
}
