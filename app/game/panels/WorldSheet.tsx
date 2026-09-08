'use client';

import { worldEvent } from '../../../game/content/worldEvents';
import { describeEffect, effectCount } from '../../../game/state/world';
import type { GameState } from '../../../game/state/save';
import { Sheet } from './Sheet';

export function WorldSheet({ open, state, onClose }: { open: boolean; state: GameState; onClose: () => void }) {
  const active = state.world.active
    .map((a) => ({ left: a.raidsLeft, event: worldEvent(a.id) }))
    .filter((x) => x.event !== null);
  const live = new Set(active.map((x) => x.event!.id));
  const past = state.world.history.filter((id) => !live.has(id)).map(worldEvent).filter((e) => e !== null);

  return (
    <Sheet open={open} title="The World" onClose={onClose}>
      <div className="sheet-rule">
        News from above ground. Some of it changes what walks into your dungeon — check before you raid.
      </div>

      <div className="sheet-group">Happening Now</div>
      {active.length === 0 && (
        <div className="row inset">
          <span className="row-body">
            <span className="row-name">Quiet</span>
            <span className="row-desc">Nothing stirring above ground. Word will reach you soon enough.</span>
          </span>
        </div>
      )}
      {active.map(({ left, event }) => {
        const e = event!;
        const lines = describeEffect(e.effect);
        return (
          <div key={e.id} className="row inset">
            <span className="row-body">
              <span className="row-name">
                <span className={'tone-tag ' + e.tone}>{e.category}</span>
                {e.headline}
              </span>
              <span className="row-desc">{e.body}</span>
              {lines.length > 0 ? (
                lines.map((l) => (
                  <span className="row-hint" key={l}>
                    {l}
                  </span>
                ))
              ) : (
                <span className="row-hint quiet">Word only. Nothing here changes the fighting.</span>
              )}
            </span>
            <span className="row-count">
              {left}
              <span className="row-count-sub">left</span>
            </span>
          </div>
        );
      })}

      {effectCount(state.world) > 0 && (
        <div className="sheet-rule">Two world effects can run at once, and none lasts more than four raids.</div>
      )}

      <div className="sheet-group">Already Passed</div>
      {past.length === 0 && (
        <div className="row inset">
          <span className="row-body">
            <span className="row-desc">Nothing has come and gone yet.</span>
          </span>
        </div>
      )}
      {past.map((e) => (
        <div key={e!.id} className="row inset">
          <span className="row-body">
            <span className="row-name">
              <span className={'tone-tag ' + e!.tone}>{e!.category}</span>
              {e!.headline}
            </span>
            <span className="row-desc">{e!.body}</span>
          </span>
        </div>
      ))}
    </Sheet>
  );
}
