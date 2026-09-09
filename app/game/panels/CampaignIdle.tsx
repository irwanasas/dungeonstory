'use client';

import { HEROES } from '../../../game/content/heroes';
import { campaignFamily } from '../../../game/state/campaign';
import { heroArt } from '../art';

interface CampaignIdleProps {
  campaignNumber: number;
  bestDays: number;
  locked: boolean;
  onStart: () => void;
}

const FAMILY_LABEL = { warrior: 'Warriors', rogue: 'Rogues', mage: 'Mages' } as const;

export function CampaignIdle({ campaignNumber, bestDays, locked, onStart }: CampaignIdleProps) {
  const family = campaignFamily(campaignNumber);
  const face = HEROES.find((h) => h.family === family) || HEROES[0];

  return (
    <div className="idle">
      <img className="idle-face" src={heroArt(face.id)} alt="" />
      <span className="idle-title">Campaign {campaignNumber}</span>
      <span className="idle-family">{FAMILY_LABEL[family]} lead the march</span>
      <span className="idle-best">Most Days Survived: {bestDays}</span>
      <button className="modal-btn btn" onClick={onStart} disabled={locked}>
        Start
      </button>
    </div>
  );
}
