'use client';

import { GUARDIANS } from '../../../game/content/guardians';
import { LORD_WEAPONS } from '../../../game/content/lordWeapons';
import type { GameState } from '../../../game/state/save';
import { ICON, contentArt } from '../art';
import { Sheet } from './Sheet';

interface LordPickerProps {
  kind: 'weapon' | 'guardian' | null;
  state: GameState;
  locked: boolean;
  onPick: (id: string) => void;
  onBuy: (id: string, cost: number) => void;
  onClose: () => void;
}

export function LordPickerSheet({ kind, state, locked, onPick, onBuy, onClose }: LordPickerProps) {
  const weapon = kind === 'weapon';
  const title = weapon ? "Nekrokos's Weapon" : "Nekrokos's Guardian";

  return (
    <Sheet open={kind !== null} title={title} onClose={onClose}>
      {weapon ? (
        <>
          <p className="sheet-rule">Sets the damage his own blows carry. Swap it whenever you like.</p>
          {LORD_WEAPONS.filter((w) => state.stage >= w.stageMin).map((w) => {
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
                  <button className="row-btn btn" onClick={() => onPick(w.id)}>
                    Equip
                  </button>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <>
          <p className="sheet-rule">
            {locked
              ? 'A march is under way. The Guardian was set when the gate opened and cannot change until it ends.'
              : 'Pick one. It sets his kit for the Throne fight and locks when a campaign starts.'}
          </p>
          {GUARDIANS.map((g) => {
            const on = g.id === state.guardianId;
            const body = (
              <>
                <img src={contentArt('monster', g.id)} alt="" />
                <div className="row-body">
                  <span className="row-name">
                    {g.name}
                    {g.count > 1 && <span className="row-lvl"> x{g.count}</span>}
                  </span>
                  <span className="row-desc">{g.effect}</span>
                  <span className="row-hint quiet">Counters: {g.counters}</span>
                </div>
                {on && <span className="row-count full">SET</span>}
              </>
            );
            if (locked) {
              return (
                <div key={g.id} className={'row inset' + (on ? '' : ' locked')}>
                  {body}
                </div>
              );
            }
            return (
              <button key={g.id} className={'row inset' + (on ? ' danger' : '')} onClick={() => onPick(g.id)} aria-pressed={on}>
                {body}
              </button>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
