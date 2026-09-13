'use client';

import { LORD } from '../../../game/content/monsters';
import { lordSoulCost } from '../../../game/state/economy';
import type { GameState } from '../../../game/state/save';
import { ICON } from '../art';

interface UpgradeProps {
  state: GameState;
  onLord: (souls: number) => void;
}

export function UpgradePanel({ state, onLord }: UpgradeProps) {
  const lordCost = lordSoulCost(state.lordLevel);

  return (
    <div className="upgrades">
      <div className="row plate">
        <img src={ICON.lord} alt="" />
        <span className="row-body">
          <span className="row-name">
            {LORD.name}<span className="row-lvl">Lv{state.lordLevel}</span>
          </span>
          <span className="row-desc">Your last line. More health, more damage, more armour in the Throne Room.</span>
          <span className="row-delta">
            +{LORD.hpPerLevel} HP&nbsp;&nbsp;+{LORD.atkPerLevel} atk&nbsp;&nbsp;+{LORD.defPerLevel} def
          </span>
        </span>
        <span className={'row-cost' + (state.souls >= lordCost ? '' : ' cant')}>
          <img src={ICON.soul} alt="" />
          {lordCost}
        </span>
        <button className="row-btn btn" disabled={state.souls < lordCost} onClick={() => onLord(lordCost)}>
          +
        </button>
      </div>
    </div>
  );
}
