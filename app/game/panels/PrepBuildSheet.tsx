'use client';

import type { RoomSlot } from '../../../game/types';
import { MAX_PER_ID } from '../../../game/types';
import { TRAPS } from '../../../game/content/traps';
import { MONSTERS } from '../../../game/content/monsters';
import { TREASURES } from '../../../game/content/treasure';
import { idCounts } from '../../../game/state/save';
import { ICON, contentArt } from '../art';
import { Sheet } from './Sheet';

interface PrepBuildProps {
  open: boolean;
  room: number;
  rooms: RoomSlot[];
  levels: Record<string, number>;
  unlocked: string[];
  onClose: () => void;
  onPlace: (slot: RoomSlot) => void;
}

export function PrepBuildSheet({ open, room, rooms, levels, unlocked, onClose, onPlace }: PrepBuildProps) {
  const groups: { label: string; kind: 'trap' | 'monster' | 'treasure'; items: { id: string; name: string; desc: string }[] }[] = [
    { label: 'Traps', kind: 'trap', items: TRAPS },
    { label: 'Monsters', kind: 'monster', items: MONSTERS },
    { label: 'Treasure', kind: 'treasure', items: TREASURES }
  ];
  const counts = idCounts(rooms);
  const here = rooms[room];
  const elsewhere = (id: string) => (counts[id] || 0) - (here && here.kind !== 'empty' && here.id === id ? 1 : 0);

  return (
    <Sheet open={open} title={`Room Prep — Room ${room + 1}`} onClose={onClose}>
      <div className="sheet-rule">The same thing fits in {MAX_PER_ID} rooms at most. Only what you've unlocked this run shows up here.</div>

      <button className="row inset" onClick={() => onPlace({ kind: 'empty' })}>
        <img src={ICON.clear} alt="" />
        <span className="row-body">
          <span className="row-name">Leave Empty</span>
          <span className="row-desc">Heroes walk straight through. Costs nothing, does nothing.</span>
        </span>
      </button>

      {groups.map((g) => {
        const owned = g.items.filter((item) => unlocked.includes(item.id));
        if (owned.length === 0) return null;
        return (
          <div key={g.kind}>
            <div className="sheet-group">{g.label}</div>
            {owned.map((item) => {
              const lvl = levels[item.id] || 1;
              const used = elsewhere(item.id);
              const atCap = used >= MAX_PER_ID;
              const body = (
                <>
                  <img src={contentArt(g.kind, item.id)} alt="" />
                  <span className="row-body">
                    <span className="row-name">
                      {item.name}
                      <span className="row-lvl">Lv{lvl}</span>
                    </span>
                    <span className="row-desc">
                      {atCap ? `Already in ${MAX_PER_ID} rooms — that's the limit.` : item.desc}
                    </span>
                  </span>
                  <span className={'row-count' + (atCap ? ' full' : '')}>
                    {used}/{MAX_PER_ID}
                  </span>
                </>
              );
              if (atCap) {
                return (
                  <div key={item.id} className="row inset locked">
                    {body}
                  </div>
                );
              }
              return (
                <button key={item.id} className="row inset" onClick={() => onPlace({ kind: g.kind, id: item.id } as RoomSlot)}>
                  {body}
                </button>
              );
            })}
          </div>
        );
      })}
    </Sheet>
  );
}
