'use client';

import type { CampaignState } from '../../../game/state/campaign';
import { ContentLevelPanel } from './ContentLevelPanel';
import { Sheet } from './Sheet';

interface DwarfUpgradeProps {
  open: boolean;
  camp: CampaignState;
  onUpgrade: (id: string, goldCost: number) => void;
  onClose: () => void;
}

export function DwarfUpgradePanel({ open, camp, onUpgrade, onClose }: DwarfUpgradeProps) {
  return (
    <Sheet open={open} title="Wandering Dwarf" onClose={onClose}>
      <div className="sheet-rule">Pick one to upgrade for the rest of the run.</div>
      <ContentLevelPanel unlocked={camp.runUnlocked} levels={camp.runLevels} gold={camp.wallet.gold} onUpgrade={onUpgrade} />
    </Sheet>
  );
}
