'use client';

import { guardianKit } from '../../../game/content/guardians';
import type { Intel } from '../../../game/state/campaign';
import { heroArt } from '../art';
import { Sheet } from './Sheet';

interface IntelSheetProps {
  open: boolean;
  intel: Intel | null;
  guardianId: string;
  onStart: () => void;
  onClose: () => void;
}

export function IntelSheet({ open, intel, guardianId, onStart, onClose }: IntelSheetProps) {
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
            <div className="row inset stats">
              <span className="stat-label">Set for this march</span>
              <span className="stat-value">{guardianKit(guardianId).name}</span>
            </div>
          </div>

          <button className="modal-btn btn" onClick={onStart}>
            Open the gate
          </button>
        </>
      )}
    </Sheet>
  );
}
