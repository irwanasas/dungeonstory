'use client';

import type { CampaignState } from '../../../game/state/campaign';

interface PastEventPanelProps {
  camp: CampaignState;
}

export function PastEventPanel({ camp }: PastEventPanelProps) {
  const entries = camp.log.slice().reverse();

  return (
    <div className="upgrades">
      <div className="sheet-group">Past Events</div>
      {entries.length === 0 && (
        <div className="row inset">
          <span className="row-body">
            <span className="row-desc">Nothing has happened yet.</span>
          </span>
        </div>
      )}
      <ul className="log">
        {entries.map((l, i) => (
          <li key={i}>
            Day {l.day} — {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
