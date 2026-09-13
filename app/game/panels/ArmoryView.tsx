'use client';

import { LORD } from '../../../game/content/monsters';
import { guardianKit } from '../../../game/content/guardians';
import { lordWeapon } from '../../../game/content/lordWeapons';
import { dungeonPower, lordSoulCost } from '../../../game/state/economy';
import type { GameState } from '../../../game/state/save';
import { ICON, contentArt } from '../art';

interface ArmoryViewProps {
  state: GameState;
  guardianLocked: boolean;
  onPickWeapon: () => void;
  onPickGuardian: () => void;
  onOpenTalents: () => void;
}

export function ArmoryView({ state, guardianLocked, onPickWeapon, onPickGuardian, onOpenTalents }: ArmoryViewProps) {
  const throneReady = state.souls >= lordSoulCost(state.lordLevel);
  const weapon = lordWeapon(state.equippedLordWeapon);
  const guard = guardianKit(state.guardianId);

  return (
    <div className="place">
      <div className="armory-grid">
        <button className="place-slot btn" style={{ gridArea: 'wpn' }} onClick={onPickWeapon} aria-label={`Weapon — ${weapon.name}`}>
          <img src={ICON.lord} alt="" />
          <span className="place-slot-name">{weapon.name}</span>
        </button>

        <div className="place-core" style={{ gridArea: 'core' }}>
          <img src={ICON.lord} alt="" />
          <span className="place-power">{dungeonPower(state)}</span>
          <span className="place-power-label">Dungeon Power</span>
        </div>

        <button
          className={'place-slot btn' + (guardianLocked ? ' locked' : '')}
          style={{ gridArea: 'grd' }}
          onClick={onPickGuardian}
          aria-label={`Guardian — ${guard.name}${guardianLocked ? ' (locked)' : ''}`}
        >
          <img src={contentArt('monster', guard.id)} alt="" />
          <span className="place-slot-name">{guard.name}</span>
          {guardianLocked && <img className="place-slot-lock" src={ICON.lock} alt="" />}
        </button>
      </div>

      <button className="place-slot btn armory-throne" onClick={onOpenTalents} aria-label={`${LORD.name} — talents`}>
        <img src={ICON.lord} alt="" />
        <span className="place-slot-name">{LORD.short}</span>
        <span className="place-slot-lvl">Lv{state.lordLevel}</span>
        {throneReady && <span className="tab-dot live" />}
      </button>

      <p className="place-rule">Tap the Lord to open Talents. Level him from Upgrades.</p>
    </div>
  );
}
