'use client';

import type { RoomSlot } from '../../../game/types';
import { monsterDef } from '../../../game/content/monsters';
import { trapDef } from '../../../game/content/traps';
import { treasureDef } from '../../../game/content/treasure';
import { ICON, contentArt } from '../art';

interface RoomGridProps {
  rooms: RoomSlot[];
  levels: Record<string, number>;
  onPickRoom: (index: number) => void;
}

function slotName(slot: RoomSlot): string {
  if (slot.kind === 'trap') return trapDef(slot.id).name;
  if (slot.kind === 'monster') return monsterDef(slot.id).name;
  if (slot.kind === 'treasure') return treasureDef(slot.id).name;
  return 'Empty';
}

export function RoomGrid({ rooms, levels, onPickRoom }: RoomGridProps) {
  return (
    <div className="room-grid">
      {rooms.map((slot, i) => {
        const level = slot.kind === 'empty' ? 1 : levels[slot.id] || 1;
        return (
          <button
            key={i}
            className={'place-slot btn' + (slot.kind === 'empty' ? ' empty' : '')}
            onClick={() => onPickRoom(i)}
            aria-label={`Room ${i + 1} — ${slotName(slot)}`}
          >
            <span className="place-slot-n">{i + 1}</span>
            <img src={slot.kind === 'empty' ? ICON.build : contentArt(slot.kind, slot.id)} alt="" />
            <span className="place-slot-name">{slotName(slot)}</span>
            {slot.kind !== 'empty' && <span className="place-slot-lvl">Lv{level}</span>}
          </button>
        );
      })}
    </div>
  );
}
