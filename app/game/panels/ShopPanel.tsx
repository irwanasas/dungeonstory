'use client';

import { LORD_WEAPONS } from '../../../game/content/lordWeapons';
import { LORD } from '../../../game/content/monsters';
import type { GameState } from '../../../game/state/save';
import { ICON } from '../art';

interface ShopProps {
  state: GameState;
  onBuy: (id: string, cost: number) => void;
  onEquip: (id: string) => void;
}

export function ShopPanel({ state, onBuy, onEquip }: ShopProps) {
  return (
    <div className="shop">
      <div className="sheet-group">{LORD.short}&apos;s Weapon</div>
      <p className="sheet-rule">Sets the damage his own blows carry at the Throne. Swap it whenever you like.</p>
      {LORD_WEAPONS.map((w) => {
        const owned = state.unlockedLordWeapons.includes(w.id);
        const equipped = state.equippedLordWeapon === w.id;
        return (
          <div key={w.id} className="row inset">
            <img src={ICON.lord} alt="" />
            <span className="row-body">
              <span className="row-name">
                {w.name}
                {equipped && <span className="row-lvl">Equipped</span>}
              </span>
              <span className="row-desc">{w.desc}</span>
            </span>
            {!owned && (
              <span className={'row-cost' + (state.gold >= w.goldCost ? '' : ' cant')}>
                <img src={ICON.gold} alt="" />
                {w.goldCost}
              </span>
            )}
            {!owned ? (
              <button className="row-btn btn" disabled={state.gold < w.goldCost} onClick={() => onBuy(w.id, w.goldCost)}>
                Buy
              </button>
            ) : equipped ? null : (
              <button className="row-btn btn" onClick={() => onEquip(w.id)}>
                Equip
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
