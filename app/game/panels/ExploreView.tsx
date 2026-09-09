'use client';

import { STAGE_MAX, stageDef } from '../../../game/content/stages';
import type { GameState } from '../../../game/state/save';
import { ICON } from '../art';

interface ExploreProps {
  state: GameState;
  locked: boolean;
  onRush: () => void;
  onArcade: () => void;
}

export function ExploreView({ state, locked, onRush, onArcade }: ExploreProps) {
  const stage = stageDef(state.stage);

  return (
    <div className="explore">
      <button className="row inset" onClick={onRush} disabled={locked}>
        <img src={ICON.raid} alt="" />
        <span className="row-body">
          <span className="row-name">Rush</span>
          <span className="row-desc">One hero walks the five rooms and the Throne. It settles in a single pass.</span>
          <span className="row-hint quiet">
            Stage {state.stage}/{STAGE_MAX} — {stage.title}
          </span>
        </span>
      </button>

      <button className="row inset" onClick={onArcade} disabled={locked}>
        <img src={ICON.upgrade} alt="" />
        <span className="row-body">
          <span className="row-name">Arcade</span>
          <span className="row-desc">
            Every class in the game, one wave after another. They get stronger; the dungeon does not reset.
          </span>
          <span className="row-hint quiet">
            Wave {state.wave} — best {state.bestWave}
          </span>
        </span>
      </button>

      <div className="row inset locked">
        <img src={ICON.lock} alt="" />
        <span className="row-body">
          <span className="row-name">Coming Soon</span>
          <span className="row-desc">Another road out of the dungeon. Not dug yet.</span>
        </span>
      </div>
    </div>
  );
}
