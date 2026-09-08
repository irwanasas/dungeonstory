import type { CSSProperties } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function art(name: string): string {
  return `${BASE}/art/${name}`;
}

function url(name: string): string {
  return `url(${art(name)})`;
}

export const artVars: CSSProperties = {
  '--f-panel': url('frame-panel.png'),
  '--f-inset': url('frame-inset.png'),
  '--f-button': url('frame-button.png'),
  '--f-button-down': url('frame-button-down.png'),
  '--f-plate': url('frame-plate.png'),
  '--f-danger': url('frame-danger.png'),
  '--i-torch': url('torch.png'),
  '--wall-fill': url('wall-fill.png'),
  '--i-door': url('door-closed.png'),
  '--i-door-open': url('door-open.png'),
  '--r-entrance': url('room-entrance.png'),
  '--r-throne': url('room-throne.png'),
  '--r-a': url('room-a.png'),
  '--r-b': url('room-b.png'),
  '--r-c': url('room-c.png'),
  '--r-d': url('room-d.png'),
  '--r-e': url('room-e.png')
} as CSSProperties;

export const ROOM_VARIANT = ['a', 'b', 'c', 'd', 'e'];

export function heroArt(id: string): string {
  return art(`hero-${id}.png`);
}

export function monsterArt(id: string): string {
  return art(`monster-${id}.png`);
}

export function contentArt(kind: string, id: string): string {
  if (kind === 'trap') return art(`trap-${id}.png`);
  if (kind === 'monster') return art(`monster-${id}.png`);
  if (kind === 'treasure') return art(`treasure-${id}.png`);
  return art('icon-clear.png');
}

export const ICON = {
  gold: art('icon-gold.png'),
  soul: art('icon-soul.png'),
  raid: art('icon-raid.png'),
  build: art('icon-build.png'),
  upgrade: art('icon-upgrade.png'),
  codex: art('icon-codex.png'),
  lord: art('icon-lord.png'),
  clear: art('icon-clear.png'),
  lock: art('icon-lock.png'),
  settings: art('icon-settings.png'),
  world: art('icon-world.png')
};
