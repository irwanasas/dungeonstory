'use client';

import { GUARDIANS } from '../../../game/content/guardians';
import type { Intel } from '../../../game/state/campaign';
import { contentArt, heroArt } from '../art';
import { Sheet } from './Sheet';

interface IntelSheetProps {
  open: boolean;
  intel: Intel | null;
  guardianId: string;
  onPick: (id: string) => void;
  onStart: () => void;
  onClose: () => void;
}

export function IntelSheet({ open, intel, guardianId, onPick, onStart, onClose }: IntelSheetProps) {
  return (
    <Sheet open={open} title="Before They March" onClose={onClose}>
      {intel && (
        <>
          <p className="sheet-rule">
            {intel.totalDays} days of road, six checkpoints, {intel.gap} days between each. They come in waves of{' '}
            {intel.waveSize}. Nekrokos waits at Level {intel.lordLevel}.
          </p>

          <div className="sheet-group">
            <span className="sheet-title">Who Is Coming</span>
            <div className="row inset stats">
              <span className="stat-label">Muster</span>
              <span className="stat-value">
                {intel.pool.length} classes · waves of {intel.waveSize}
              </span>
            </div>
            <div className="intel-pool">
              {intel.pool.map((h) => (
                <span key={h.defId} className="intel-hero">
                  {h.name}
                  <span className="intel-hero-role">{h.role}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="sheet-group">
            <span className="sheet-title">The King</span>
            <div className="row inset">
              <img src={heroArt(intel.arthur.defId)} alt="" />
              <div className="row-body">
                <span className="row-name">King Arthur — {intel.arthur.name}</span>
                <span className="row-desc">
                  {intel.arthur.ability}: {intel.arthur.blurb}
                </span>
                <span className="row-hint quiet">
                  He waits at the Throne. If the last wave dies before it, he arrives alone and his ability hits twice
                  as hard.
                </span>
              </div>
            </div>
          </div>

          <div className="sheet-group">
            <span className="sheet-title">Nekrokos&apos;s Guardian</span>
            <p className="sheet-rule">Pick one. It sets his kit for the Throne fight and cannot be changed after.</p>
            {GUARDIANS.map((g) => {
              const on = g.id === guardianId;
              return (
                <button
                  key={g.id}
                  className={'row inset' + (on ? ' danger' : '')}
                  onClick={() => onPick(g.id)}
                  aria-pressed={on}
                >
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
                </button>
              );
            })}
          </div>

          <button className="modal-btn btn" onClick={onStart}>
            Open the gate
          </button>
        </>
      )}
    </Sheet>
  );
}
