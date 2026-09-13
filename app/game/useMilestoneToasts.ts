'use client';

import { useRef, useState } from 'react';
import { milestoneLabel } from '../../game/content/milestones';
import { play as sfx } from './audio';
import type { MilestoneToastItem } from './overlays';

export function useMilestoneToasts() {
  const [activeToast, setActiveToast] = useState<MilestoneToastItem | null>(null);
  const toastQueueRef = useRef<MilestoneToastItem[]>([]);
  const toastBusyRef = useRef(false);

  function stepToast() {
    const next = toastQueueRef.current.shift();
    if (!next) {
      toastBusyRef.current = false;
      setActiveToast(null);
      return;
    }
    toastBusyRef.current = true;
    setActiveToast(next);
    sfx('coin');
    setTimeout(stepToast, 2600);
  }

  function queueToasts(ids: string[]) {
    const items = ids.map(milestoneLabel).filter((x): x is MilestoneToastItem => x !== null);
    if (items.length === 0) return;
    toastQueueRef.current.push(...items);
    if (!toastBusyRef.current) stepToast();
  }

  return { activeToast, queueToasts };
}
