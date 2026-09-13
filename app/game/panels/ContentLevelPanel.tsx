'use client';

import { TRAPS } from '../../../game/content/traps';
import { MONSTERS } from '../../../game/content/monsters';
import { TREASURES } from '../../../game/content/treasure';
import { upgradeCost } from '../../../game/state/economy';
import { ICON, contentArt } from '../art';

type Item =
  | ({ kind: 'trap'; dmgPerLevel: number } & Record<string, unknown>)
  | ({ kind: 'monster'; hpPerLevel: number; atkPerLevel: number } & Record<string, unknown>)
  | ({ kind: 'treasure'; goldPerLevel: number } & Record<string, unknown>);

function perLevel(item: Item): string {
  if (item.kind === 'trap') return `+${item.dmgPerLevel} dmg`;
  if (item.kind === 'monster') return `+${item.hpPerLevel} HP  +${item.atkPerLevel} atk`;
  return `+${item.goldPerLevel} gold`;
}

interface ContentLevelProps {
  unlocked: string[];
  levels: Record<string, number>;
  gold: number;
  onUpgrade: (id: string, cost: number) => void;
}

export function ContentLevelPanel({ unlocked, levels, gold, onUpgrade }: ContentLevelProps) {
  const all = [
    ...TRAPS.map((t) => ({ ...t, kind: 'trap' as const })),
    ...MONSTERS.map((m) => ({ ...m, kind: 'monster' as const })),
    ...TREASURES.map((v) => ({ ...v, kind: 'treasure' as const }))
  ].filter((x) => unlocked.includes(x.id));

  return (
    <div className="upgrades">
      <div className="sheet-group">Dungeon Contents</div>
      {all.length === 0 && (
        <div className="row inset">
          <span className="row-body">
            <span className="row-desc">Nothing unlocked yet. Clear a stage.</span>
          </span>
        </div>
      )}
      {all.map((item) => {
        const lvl = levels[item.id] || 1;
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
              <span className="row-delta">{perLevel(item as Item)}</span>
            </span>
            <span className={'row-cost' + (gold >= cost ? '' : ' cant')}>
              <img src={ICON.gold} alt="" />
              {cost}
            </span>
            <button className="row-btn btn" disabled={gold < cost} onClick={() => onUpgrade(item.id, cost)}>
              +
            </button>
          </div>
        );
      })}
    </div>
  );
}
