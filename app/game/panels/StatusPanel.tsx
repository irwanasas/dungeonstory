'use client';

import type { CampaignState } from '../../../game/state/campaign';
import { daysToCheckpoint, isCheckpointDay } from '../../../game/state/campaign';
import { DayPanel } from './DayPanel';

interface StatusPanelProps {
  camp: CampaignState;
  busy: boolean;
  onChoose: (optionId: string) => void;
  onNextDay: () => void;
  onFinish: () => void;
}

export function StatusPanel({ camp, busy, onChoose, onNextDay, onFinish }: StatusPanelProps) {
  const gap = daysToCheckpoint(camp);
  const countdown = isCheckpointDay(camp) ? 'today' : gap === 1 ? 'tomorrow' : `in ${gap} days`;

  return (
    <div className="status">
      <div className="row inset stats">
        <span className="stat-label">Gold</span>
        <span className="stat-value">{camp.wallet.gold}</span>
      </div>
      <div className="row inset stats">
        <span className="stat-label">Souls</span>
        <span className="stat-value">{camp.wallet.souls}</span>
      </div>
      <div className="row inset stats">
        <span className="stat-label">Next milestone</span>
        <span className="stat-value">{countdown}</span>
      </div>
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
