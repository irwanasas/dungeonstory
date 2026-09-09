'use client';

import { CHECKPOINTS } from '../../../game/types';
import type { ExpeditionState } from '../../../game/state/expedition';
import { daysToCheckpoint, isCheckpointDay } from '../../../game/state/expedition';

interface DayPanelProps {
  exp: ExpeditionState;
  busy: boolean;
  onNextDay: () => void;
  onChoose: (optionId: string) => void;
  onFinish: () => void;
}

export function DayPanel({ exp, busy, onNextDay, onChoose, onFinish }: DayPanelProps) {
  const pending = exp.pending;
  const done = exp.status === 'complete';
  const gap = daysToCheckpoint(exp);
  const aura = exp.aura;

  return (
    <div className="day">
      <div className="day-head">
        <span className="day-count">
          Day {exp.day}/{exp.setup.totalDays}
        </span>
        <span className="day-meta">
          Checkpoint {Math.min(exp.checkpoint + 1, CHECKPOINTS)}/{CHECKPOINTS}
          {done ? ' · over' : isCheckpointDay(exp) ? ' · today' : gap === 1 ? ' · tomorrow' : ` · in ${gap} days`}
        </span>
      </div>

      <div className="day-title">{exp.dayTitle}</div>
      <div className="day-body">{exp.dayBody}</div>

      {aura && <div className="day-aura">{aura.label}</div>}

      {done ? (
        <button className="day-btn btn" onClick={onFinish} disabled={busy}>
          See the report
        </button>
      ) : pending ? (
        <div className="day-options">
          {pending.options.map((o) => (
            <button key={o.id} className="row inset" onClick={() => onChoose(o.id)} disabled={busy}>
              <div className="row-body">
                <span className="row-name">{o.label}</span>
                <span className="row-desc">{o.hint}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <button className="day-btn btn" onClick={onNextDay} disabled={busy}>
          {isCheckpointDay(exp) ? 'They reach your gate' : 'Next Day'}
        </button>
      )}
    </div>
  );
}
