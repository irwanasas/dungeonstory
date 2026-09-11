'use client';

import type { RoomSlot } from '../../../game/types';
import { MAX_PER_ID } from '../../../game/types';
import { TRAPS } from '../../../game/content/traps';
import { MONSTERS } from '../../../game/content/monsters';
import { TREASURES } from '../../../game/content/treasure';
import { unlockStageOf } from '../../../game/content/stages';
import { unlockSoulCost } from '../../../game/state/economy';
import { idCounts, type GameState } from '../../../game/state/save';
import { ICON, contentArt } from '../art';
import { Sheet } from './Sheet';

interface BuildProps {
  open: boolean;
  room: number;
  state: GameState;
  onClose: () => void;
  onPlace: (slot: RoomSlot) => void;
  onBuy: (id: string, goldCost: number) => void;
}

export function BuildSheet({ open, room, state, onClose, onPlace, onBuy }: BuildProps) {
  const groups: { label: string; kind: 'trap' | 'monster' | 'treasure'; items: { id: string; name: string; desc: string; goldCost: number }[] }[] = [
    { label: 'Traps', kind: 'trap', items: TRAPS },
    { label: 'Monsters', kind: 'monster', items: MONSTERS },
    { label: 'Treasure', kind: 'treasure', items: TREASURES }
  ];
  const counts = idCounts(state.rooms);
  const here = state.rooms[room];
  const elsewhere = (id: string) => (counts[id] || 0) - (here && here.kind !== 'empty' && here.id === id ? 1 : 0);

  return (
    <Sheet open={open} title={`Build — Room ${room + 1}`} onClose={onClose}>
      <div className="sheet-rule">The same thing fits in {MAX_PER_ID} rooms at most. Mix, or leave a room empty.</div>

      <button className="row inset" onClick={() => onPlace({ kind: 'empty' })}>
        <img src={ICON.clear} alt="" />
        <span className="row-body">
          <span className="row-name">Leave Empty</span>
          <span className="row-desc">Heroes walk straight through. Costs nothing, does nothing.</span>
        </span>
      </button>

      {groups.map((g) => (
        <div key={g.kind}>
          <div className="sheet-group">{g.label}</div>
          {g.items.map((item) => {
            const owned = state.unlocked.includes(item.id);
            const souls = unlockSoulCost(item.goldCost, unlockStageOf(item.id), state.stage);
            const lvl = state.levels[item.id] || 1;
            if (owned) {
              const used = elsewhere(item.id);
              const atCap = used >= MAX_PER_ID;
              const chip = (
                <span className={'row-count' + (atCap ? ' full' : '')}>
                  {used}/{MAX_PER_ID}
                </span>
              );
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
                  {chip}
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
            }
            const affordable = state.souls >= souls;
            return (
              <div key={item.id} className="row inset locked">
                <img src={ICON.lock} alt="" />
                <span className="row-body">
                  <span className="row-name">{item.name}</span>
                  <span className="row-desc">Found on Stage {unlockStageOf(item.id)} — or buy it now with souls. The further ahead, the dearer.</span>
                </span>
                <span className={'row-cost' + (affordable ? '' : ' cant')}>
                  <img src={ICON.soul} alt="" />
                  {souls}
                </span>
                <button className="row-btn btn" disabled={!affordable} onClick={() => onBuy(item.id, item.goldCost)}>
                  +
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </Sheet>
  );
}
