'use client';

import type { ExpeditionState } from '../../../game/state/expedition';
import { OUTCOME_COPY } from '../overlays';
import { Sheet } from './Sheet';

interface ExpeditionSheetProps {
  open: boolean;
  exp: ExpeditionState | null;
  onClose: () => void;
}

export function ExpeditionSheet({ open, exp, onClose }: ExpeditionSheetProps) {
  const copy = exp && exp.outcome ? OUTCOME_COPY[exp.outcome] : null;
  const gold = exp ? Math.max(0, exp.totals.gold - exp.totals.goldStolen) : 0;

  return (
    <Sheet open={open} title="Expedition Report" onClose={onClose}>
      {exp && copy && (
        <>
          <div className={'modal-title ' + copy.cls}>{copy.title}</div>
          <p className="sheet-rule">{copy.desc}</p>

          <div className="sheet-group">
            <div className="row inset stats">
              <span className="stat-label">Days</span>
              <span className="stat-value">{exp.setup.totalDays}</span>
            </div>
            <div className="row inset stats">
              <span className="stat-label">Checkpoints held</span>
              <span className="stat-value">
                {exp.setup.checkpointDays.length - exp.totals.checkpointsCleared}/{exp.setup.checkpointDays.length}
              </span>
            </div>
            <div className="row inset stats">
              <span className="stat-label">Waves lost</span>
              <span className="stat-value">{exp.totals.wavesLost}</span>
            </div>
            <div className="row inset stats">
              <span className="stat-label">Gold</span>
              <span className="stat-value">{gold}</span>
            </div>
            <div className="row inset stats">
              <span className="stat-label">Souls</span>
              <span className="stat-value">{exp.totals.souls}</span>
            </div>
            {exp.totals.goldStolen > 0 && (
              <div className="row inset stats">
                <span className="stat-label">Gold stolen</span>
                <span className="stat-value">-{exp.totals.goldStolen}</span>
              </div>
            )}
          </div>

          <div className="sheet-group">
            <span className="sheet-title">The Road</span>
            <ul className="log">
              {exp.log.map((l, i) => (
                <li key={i}>
                  Day {l.day} — {l.text}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Sheet>
  );
}
