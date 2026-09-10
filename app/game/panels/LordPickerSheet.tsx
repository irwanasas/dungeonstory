'use client';

import { GUARDIANS } from '../../../game/content/guardians';
import type { GameState } from '../../../game/state/save';
import { contentArt } from '../art';
import { Sheet } from './Sheet';

interface LordPickerProps {
  open: boolean;
  state: GameState;
  locked: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}

export function LordPickerSheet({ open, state, locked, onPick, onClose }: LordPickerProps) {
  return (
    <Sheet open={open} title="Nekrokos's Guardian" onClose={onClose}>
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
    </Sheet>
  );
}
