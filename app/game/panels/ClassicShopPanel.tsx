'use client';

import { ICON } from '../art';

export function ClassicShopPanel() {
  return (
    <div className="explore">
      <div className="row inset locked">
        <img src={ICON.lock} alt="" />
        <span className="row-body">
          <span className="row-name">Coming Soon</span>
          <span className="row-desc">Classic's own shop isn't open yet.</span>
        </span>
      </div>
    </div>
  );
}
