'use client';

import type { WorldEvent } from '../../../game/types';
import type { CampaignState } from '../../../game/state/campaign';
import { OUTCOME_COPY } from '../overlays';
import { Sheet } from './Sheet';

interface CampaignSheetProps {
  open: boolean;
  camp: CampaignState | null;
  news?: WorldEvent | null;
  onClose: () => void;
}

export function CampaignSheet({ open, camp, news, onClose }: CampaignSheetProps) {
  const copy = camp && camp.outcome ? OUTCOME_COPY[camp.outcome] : null;
  const gold = camp ? Math.max(0, camp.totals.gold - camp.totals.goldStolen) : 0;

  return (
    <Sheet open={open} title="Campaign Report" onClose={onClose}>
      {camp && copy && (
        <>
          <div className={'modal-title ' + copy.cls}>{copy.title}</div>
          <p className="sheet-rule">{copy.desc}</p>

          {news && (
            <div className="news">
              <span className={'tone-tag ' + news.tone}>{news.category}</span>
              <span>{news.headline}</span>
            </div>
          )}

          <div className="sheet-group">
            <div className="row inset stats">
              <span className="stat-label">Days</span>
              <span className="stat-value">{camp.setup.totalDays}</span>
            </div>
            <div className="row inset stats">
              <span className="stat-label">Checkpoints held</span>
              <span className="stat-value">
                {camp.setup.checkpointDays.length - camp.totals.checkpointsCleared}/{camp.setup.checkpointDays.length}
              </span>
            </div>
            <div className="row inset stats">
              <span className="stat-label">Waves lost</span>
              <span className="stat-value">{camp.totals.wavesLost}</span>
            </div>
            <div className="row inset stats">
              <span className="stat-label">Gold</span>
              <span className="stat-value">{gold}</span>
            </div>
            <div className="row inset stats">
              <span className="stat-label">Souls</span>
              <span className="stat-value">{camp.totals.souls}</span>
            </div>
            {camp.totals.goldStolen > 0 && (
              <div className="row inset stats">
                <span className="stat-label">Gold stolen</span>
                <span className="stat-value">-{camp.totals.goldStolen}</span>
              </div>
            )}
          </div>

          <div className="sheet-group">
            <span className="sheet-title">The Road</span>
            <ul className="log">
              {camp.log.map((l, i) => (
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
