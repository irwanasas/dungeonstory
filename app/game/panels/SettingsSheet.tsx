'use client';

import { useEffect, useState } from 'react';
import { STAGE_MAX } from '../../../game/content/stages';
import type { GameState } from '../../../game/state/save';
import { Sheet } from './Sheet';

interface SettingsProps {
  open: boolean;
  state: GameState;
  onClose: () => void;
  onReset: () => void;
}

const STATS: { label: string; value: (s: GameState) => string }[] = [
  { label: 'Raids run', value: (s) => String(s.stats.raids) },
  { label: 'Heroes killed', value: (s) => String(s.stats.defeated) },
  { label: 'Heroes escaped', value: (s) => String(s.stats.escaped) },
  { label: 'Dungeon breached', value: (s) => String(s.stats.lost) },
  { label: 'Gold earned', value: (s) => `${s.stats.goldEarned}g` },
  { label: 'Gold stolen from you', value: (s) => `${s.stats.goldStolen}g` },
  { label: 'Stages cleared', value: (s) => `${s.maxStageCleared}/${STAGE_MAX}` },
  { label: 'Best arcade wave', value: (s) => String(s.bestWave) },
  { label: 'Dungeon Lord level', value: (s) => `Lv${s.lordLevel}` },
  { label: 'Veterans remembered', value: (s) => String(s.roster.length) }
];

export function SettingsSheet({ open, state, onClose, onReset }: SettingsProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!open) setArmed(false);
  }, [open]);

  return (
    <Sheet open={open} title="Settings" onClose={onClose}>
      <div className="sheet-group">Records</div>
      <div className="row inset stats">
        <span className="row-body">
          {STATS.map((s) => (
            <span className="stat" key={s.label}>
              <span className="stat-label">{s.label}</span>
              <span className="stat-value">{s.value(state)}</span>
            </span>
          ))}
        </span>
      </div>

      <div className="sheet-group">Language</div>
      <div className="row inset">
        <span className="row-body">
          <span className="row-name">Language</span>
          <span className="row-desc">More to come.</span>
        </span>
        <select className="picker btn" value="en" onChange={() => undefined} aria-label="Language">
          <option value="en">English</option>
        </select>
      </div>

      <div className="sheet-group">Danger</div>
      <div className={'row ' + (armed ? 'danger' : 'inset')}>
        <span className="row-body">
          <span className="row-name">Reset Game</span>
          <span className="row-desc">
            {armed
              ? 'Erases everything — dungeon, gold, souls, unlocks, stages, heroes. No undo.'
              : 'Permanently deletes all player data and starts over.'}
          </span>
        </span>
        {armed ? (
          <>
            <button className="row-btn btn" onClick={() => setArmed(false)}>
              No
            </button>
            <button className="row-btn btn wipe" onClick={onReset}>
              Erase
            </button>
          </>
        ) : (
          <button className="row-btn btn warn" onClick={() => setArmed(true)}>
            Reset
          </button>
        )}
      </div>

      <div className="sheet-group">Credits</div>
      <div className="row inset">
        <span className="row-body">
          <span className="row-name">Created by xanaksetan</span>
          <span className="row-desc">Own a Dungeon — built as a mobile-first browser game.</span>
        </span>
      </div>
      <a className="row inset link" href="https://www.instagram.com/xanaksetan" target="_blank" rel="noopener noreferrer">
        <span className="row-body">
          <span className="row-name">Instagram</span>
          <span className="row-desc">@xanaksetan</span>
        </span>
        <span className="row-count">&#8599;</span>
      </a>
      <a className="row inset link" href="https://github.com/irwanasas" target="_blank" rel="noopener noreferrer">
        <span className="row-body">
          <span className="row-name">GitHub</span>
          <span className="row-desc">github.com/irwanasas</span>
        </span>
        <span className="row-count">&#8599;</span>
      </a>
      <div className="copyright">All Rights Reserved 2026</div>
    </Sheet>
  );
}
