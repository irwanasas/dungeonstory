'use client';

import type { RoomSlot } from '../../../game/types';
import { LORD, monsterDef } from '../../../game/content/monsters';
import { guardianKit } from '../../../game/content/guardians';
import { lordWeapon } from '../../../game/content/lordWeapons';
import { trapDef } from '../../../game/content/traps';
import { treasureDef } from '../../../game/content/treasure';
import { dungeonPower, lordSoulCost, upgradeCost } from '../../../game/state/economy';
import type { GameState } from '../../../game/state/save';
import { ICON, contentArt } from '../art';

interface RoomPlacementProps {
  state: GameState;
  guardianLocked: boolean;
  onPickRoom: (index: number) => void;
  onPickWeapon: () => void;
  onPickGuardian: () => void;
  onOpenTalents: () => void;
}

function slotName(slot: RoomSlot): string {
  if (slot.kind === 'trap') return trapDef(slot.id).name;
  if (slot.kind === 'monster') return monsterDef(slot.id).name;
  if (slot.kind === 'treasure') return treasureDef(slot.id).name;
  return 'Empty';
}

function slotCost(slot: RoomSlot): number {
  if (slot.kind === 'trap') return trapDef(slot.id).goldCost;
  if (slot.kind === 'monster') return monsterDef(slot.id).goldCost;
  if (slot.kind === 'treasure') return treasureDef(slot.id).goldCost;
  return 0;
}

export function RoomPlacementView({
  state,
  guardianLocked,
  onPickRoom,
  onPickWeapon,
  onPickGuardian,
  onOpenTalents
}: RoomPlacementProps) {
  const canUpgrade = (slot: RoomSlot) => {
    if (slot.kind === 'empty') return false;
    const level = state.levels[slot.id] || 1;
    return state.gold >= upgradeCost(slotCost(slot), level);
  };
  const throneReady = state.souls >= lordSoulCost(state.lordLevel);
  const weapon = lordWeapon(state.equippedLordWeapon);
  const guard = guardianKit(state.guardianId);

  return (
    <div className="place">
      <div className="place-grid">
        {state.rooms.map((slot, i) => {
          const level = state.levels[slot.kind === 'empty' ? '' : slot.id] || 1;
          return (
            <button
              key={i}
              className={'place-slot btn' + (slot.kind === 'empty' ? ' empty' : '')}
              style={{ gridArea: 'r' + (i + 1) }}
              onClick={() => onPickRoom(i)}
              aria-label={`Room ${i + 1} — ${slotName(slot)}`}
            >
              <span className="place-slot-n">{i + 1}</span>
              <img src={slot.kind === 'empty' ? ICON.build : contentArt(slot.kind, slot.id)} alt="" />
              <span className="place-slot-name">{slotName(slot)}</span>
              {slot.kind !== 'empty' && <span className="place-slot-lvl">Lv{level}</span>}
              {canUpgrade(slot) && <span className="tab-dot live" />}
            </button>
          );
        })}

        <div className="place-core" style={{ gridArea: 'core' }}>
          <img src={ICON.lord} alt="" />
          <span className="place-power">{dungeonPower(state)}</span>
          <span className="place-power-label">Dungeon Power</span>
        </div>

        <button className="place-slot btn" style={{ gridArea: 'wpn' }} onClick={onPickWeapon} aria-label={`Weapon — ${weapon.name}`}>
          <img src={ICON.lord} alt="" />
          <span className="place-slot-name">{weapon.name}</span>
        </button>

        <button
          className="place-slot btn throne"
          style={{ gridArea: 'throne' }}
          onClick={onOpenTalents}
          aria-label={`${LORD.name} — talents`}
        >
          <img src={ICON.lord} alt="" />
          <span className="place-slot-name">{LORD.short}</span>
          <span className="place-slot-lvl">Lv{state.lordLevel}</span>
          {throneReady && <span className="tab-dot live" />}
        </button>

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

      <p className="place-rule">Tap a room to change what waits in it. The Throne is leveled from Upgrades.</p>
    </div>
  );
}
