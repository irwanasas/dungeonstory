'use client';

import { ICON } from '../art';

interface ExploreProps {
  locked: boolean;
  onClassic: () => void;
}

export function ExploreView({ locked, onClassic }: ExploreProps) {
  return (
    <div className="explore">
      <button className="row inset" onClick={onClassic} disabled={locked}>
        <img src={ICON.raid} alt="" />
        <span className="row-body">
          <span className="row-name">Classic</span>
          <span className="row-desc">The original Own a Dungeon — Rush and Arcade, in their own space.</span>
        </span>
      </button>

      <div className="row inset locked">
        <img src={ICON.lock} alt="" />
        <span className="row-body">
          <span className="row-name">Coming Soon</span>
          <span className="row-desc">Another road out of the dungeon. Not dug yet.</span>
        </span>
      </div>

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
