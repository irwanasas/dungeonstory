'use client';

import { CHECKPOINTS } from '../../../game/types';
import type { ExpeditionState } from '../../../game/state/expedition';
import { activeParty, daysToCheckpoint, isCheckpointDay } from '../../../game/state/expedition';

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
  const wave = activeParty(exp);

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

      <div className="day-party">
        {wave.length === 0 ? (
          <span className="day-party-none">No party on the road.</span>
        ) : (
          wave.map((m) => (
            <span key={m.hero.uid} className={'day-hero' + (m.hero.hp <= m.hero.maxHp * 0.3 ? ' hurt' : '')}>
              {m.hero.name}
              <span className="day-hero-hp">
                {Math.max(0, m.hero.hp)}/{m.hero.maxHp}
              </span>
              {m.hero.status.map((s) => (
                <span key={s.kind} className={'badge ' + s.kind}>
                  {s.kind.slice(0, 3).toUpperCase()}
                </span>
              ))}
            </span>
          ))
        )}
      </div>

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
