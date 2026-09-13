'use client';

import { TRAPS } from '../../../game/content/traps';
import { MONSTERS } from '../../../game/content/monsters';
import { TREASURES } from '../../../game/content/treasure';
import type { CampaignState } from '../../../game/state/campaign';
import { upgradeCost } from '../../../game/state/economy';
import { ICON, contentArt } from '../art';
import { RoomGrid } from './RoomGrid';

interface RoomPrepViewProps {
  camp: CampaignState;
  onPickRoom: (index: number) => void;
  onLevel: (id: string, goldCost: number) => void;
}

type Item = { id: string; name: string; desc: string; goldCost: number; kind: 'trap' | 'monster' | 'treasure' };

export function RoomPrepView({ camp, onPickRoom, onLevel }: RoomPrepViewProps) {
  const all: Item[] = [
    ...TRAPS.map((t) => ({ ...t, kind: 'trap' as const })),
    ...MONSTERS.map((m) => ({ ...m, kind: 'monster' as const })),
    ...TREASURES.map((v) => ({ ...v, kind: 'treasure' as const }))
  ].filter((x) => camp.runUnlocked.includes(x.id));

  return (
    <div className="place">
      <div className="row inset stats">
        <span className="stat-label">Gold</span>
        <span className="stat-value">{camp.wallet.gold}</span>
      </div>
      <RoomGrid rooms={camp.runRooms} levels={camp.runLevels} onPickRoom={onPickRoom} />
      <p className="place-rule">Only what you've unlocked this run can go in a room.</p>

      {all.length > 0 && <div className="sheet-group">This Run's Arsenal</div>}
      {all.map((item) => {
        const lvl = camp.runLevels[item.id] || 1;
        const cost = upgradeCost(item.goldCost, lvl);
        return (
          <div key={item.id} className="row inset">
            <img src={contentArt(item.kind, item.id)} alt="" />
            <span className="row-body">
              <span className="row-name">
                {item.name}
                <span className="row-lvl">Lv{lvl}</span>
              </span>
              <span className="row-desc">{item.desc}</span>
            </span>
            <span className={'row-cost' + (camp.wallet.gold >= cost ? '' : ' cant')}>
              <img src={ICON.gold} alt="" />
              {cost}
            </span>
            <button className="row-btn btn" disabled={camp.wallet.gold < cost} onClick={() => onLevel(item.id, item.goldCost)}>
              +
            </button>
          </div>
        );
      })}
    </div>
  );
}
