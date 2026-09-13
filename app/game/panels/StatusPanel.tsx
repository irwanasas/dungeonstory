'use client';

import type { CampaignState } from '../../../game/state/campaign';
import { DayPanel } from './DayPanel';

interface StatusPanelProps {
  camp: CampaignState;
  busy: boolean;
  onChoose: (optionId: string) => void;
  onNextDay: () => void;
  onFinish: () => void;
}

export function StatusPanel({ camp, busy, onChoose, onNextDay, onFinish }: StatusPanelProps) {
  return (
    <div className="status">
      {(camp.mods.length > 0 || camp.aura) && (
        <div className="row inset stats">
          <span className="stat-label">Active buffs</span>
          <span className="stat-value">
            {[camp.aura?.label, ...camp.mods.map((m) => m.label)].filter(Boolean).join(', ')}
          </span>
        </div>
      )}
      <DayPanel camp={camp} busy={busy} onChoose={onChoose} onNextDay={onNextDay} onFinish={onFinish} />
    </div>
  );
}
