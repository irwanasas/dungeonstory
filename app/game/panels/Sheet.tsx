'use client';

import type { ReactNode } from 'react';
import { ICON } from '../art';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  return (
    <>
      <div className={'scrim' + (open ? ' on' : '')} onClick={onClose} />
      <div className={'sheet frame' + (open ? ' on' : '')} aria-hidden={!open}>
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          <button className="sheet-close btn" onClick={onClose} aria-label="Close">
            <img src={ICON.clear} alt="" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
