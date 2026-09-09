'use client';

import { TRAPS } from '../../../game/content/traps';
import { LORD, MONSTERS } from '../../../game/content/monsters';
import { LORD_WEAPONS } from '../../../game/content/lordWeapons';
import { TREASURES } from '../../../game/content/treasure';
import { lordSoulCost, upgradeCost } from '../../../game/state/economy';
import type { GameState } from '../../../game/state/save';
import { ICON, contentArt } from '../art';

interface UpgradeProps {
  state: GameState;
  onUpgrade: (id: string, cost: number) => void;
  onLord: (souls: number) => void;
  onBuyLordWeapon: (id: string, cost: number) => void;
  onEquipLordWeapon: (id: string) => void;
}

export function UpgradePanel({
  state,
  onUpgrade,
  onLord,
  onBuyLordWeapon,
  onEquipLordWeapon
}: UpgradeProps) {
  const lordCost = lordSoulCost(state.lordLevel);
  const weapons = LORD_WEAPONS.filter((w) => state.stage >= w.stageMin);
  const all = [
    ...TRAPS.map((t) => ({ ...t, kind: 'trap' as const })),
    ...MONSTERS.map((m) => ({ ...m, kind: 'monster' as const })),
    ...TREASURES.map((v) => ({ ...v, kind: 'treasure' as const }))
  ].filter((x) => state.unlocked.includes(x.id));

  return (
    <div className="upgrades">
      <div className="row plate">
        <img src={ICON.lord} alt="" />
        <span className="row-body">
          <span className="row-name">
            {LORD.name}<span className="row-lvl">Lv{state.lordLevel}</span>
          </span>
          <span className="row-desc">Your last line. More health, more damage, more armour in the Throne Room.</span>
        </span>
        <span className={'row-cost' + (state.souls >= lordCost ? '' : ' cant')}>
          <img src={ICON.soul} alt="" />
          {lordCost}
        </span>
        <button className="row-btn btn" disabled={state.souls < lordCost} onClick={() => onLord(lordCost)}>
          +
        </button>
      </div>

      <div className="sheet-group">{LORD.short}&apos;s Weapon</div>
      {weapons.map((w) => {
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
            {!owned && (
              <button className="row-btn btn" disabled={state.gold < w.goldCost} onClick={() => onBuyLordWeapon(w.id, w.goldCost)}>
                Buy
              </button>
            )}
            {owned && !equipped && (
              <button className="row-btn btn" onClick={() => onEquipLordWeapon(w.id)}>
                Equip
              </button>
            )}
          </div>
        );
      })}

      <div className="sheet-group">Dungeon Contents</div>
      {all.length === 0 && <div className="row inset">
        <span className="row-body">
          <span className="row-desc">Nothing unlocked yet. Clear a stage.</span>
        </span>
      </div>}
      {all.map((item) => {
        const lvl = state.levels[item.id] || 1;
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
            <span className={'row-cost' + (state.gold >= cost ? '' : ' cant')}>
              <img src={ICON.gold} alt="" />
              {cost}
            </span>
            <button className="row-btn btn" disabled={state.gold < cost} onClick={() => onUpgrade(item.id, cost)}>
              +
            </button>
          </div>
        );
      })}
    </div>
  );
}
