'use client';

import { useCallback, useRef, useState } from 'react';
import type { RaidEvent, RaidResult, StatusKind, Tag } from '../../game/types';
import { statusDef } from '../../game/content/statuses';
import { LORD } from '../../game/content/monsters';
import { monsterArt } from './art';
import { play as sfx } from './audio';

export const CELL = 256;
const HERO_FRAC = 0.36;
const FOE_FRAC = 0.66;
const SOLO_FRAC = 0.5;

export interface FloatFx {
  key: number;
  text: string;
  cls: string;
  x: number;
  dy: number;
}

export interface BarView {
  name: string;
  hp: number;
  maxHp: number;
  foe: boolean;
}

export interface DirectorView {
  raiding: boolean;
  heroX: number;
  heroMs: number;
  heroCls: string;
  heroArt: string;
  heroShown: boolean;
  badges: StatusKind[];
  foe: { art: string; x: number; cls: string } | null;
  bolt: { x: number; ms: number; arcane: boolean } | null;
  fx: FloatFx[];
  flash: { key: number; tag: Tag } | null;
  heroBar: BarView | null;
  foeBar: BarView | null;
  barsOn: boolean;
  callout: { key: number; text: string; danger: boolean } | null;
  intent: string;
  reaction: string;
  doorOpen: number;
  litRoom: number;
}

const INITIAL: DirectorView = {
  raiding: false,
  heroX: 0,
  heroMs: 0,
  heroCls: '',
  heroArt: '',
  heroShown: false,
  badges: [],
  foe: null,
  bolt: null,
  fx: [],
  flash: null,
  heroBar: null,
  foeBar: null,
  barsOn: false,
  callout: null,
  intent: '',
  reaction: '',
  doorOpen: -1,
  litRoom: -1
};

const REACTION_TEXT: Record<string, string> = {
  surprise: 'What is that?!',
  pain: 'Argh!',
  panic: 'Too much — too much!',
  fear: 'Something is watching...',
  rage: 'RAAAGH!',
  heal: 'Better.',
  greed: 'Mine now.',
  relief: 'Nice try.',
  dead: '...'
};

function tween(el: HTMLElement, to: number, ms: number): Promise<void> {
  const from = el.scrollLeft;
  if (ms <= 0 || Math.abs(to - from) < 1) {
    el.scrollLeft = to;
    return Promise.resolve();
  }
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      el.scrollLeft = from + (to - from) * p;
      if (p < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export function useRaidDirector(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const [view, setView] = useState<DirectorView>(INITIAL);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  speedRef.current = speed;
  const fxId = useRef(0);
  const keyId = useRef(0);

  const patch = useCallback((p: Partial<DirectorView>) => {
    setView((v) => ({ ...v, ...p }));
  }, []);

  const wait = useCallback((ms: number) => new Promise<void>((r) => setTimeout(r, ms / speedRef.current)), []);

  const float = useCallback((text: string, cls: string, x: number) => {
    const key = ++fxId.current;
    const dy = (key % 4) * 13;
    setView((v) => ({ ...v, fx: [...v.fx, { key, text, cls, x: x + ((key % 3) - 1) * 9, dy }] }));
    setTimeout(() => setView((v) => ({ ...v, fx: v.fx.filter((f) => f.key !== key) })), 1000);
  }, []);

  const play = useCallback(
    async (result: RaidResult, heroImg: string) => {
      const el = scrollRef.current;
      const camera = (roomIndex: number, ms: number) =>
        el ? tween(el, (roomIndex + 1) * CELL, ms) : Promise.resolve();
      const xOf = (roomIndex: number, frac: number) => (roomIndex + 1) * CELL + CELL * frac;

      let room = 0;
      let heroHp = result.hero.hp;
      let heroMax = result.hero.maxHp;
      let foeName = '';
      let foeHp = 0;
      let foeMax = 1;
      let foeX = 0;
      let statuses: StatusKind[] = [];
      let heroX = xOf(-1, 0.34);
      let lastRanged = false;

      const setHeroBar = () => patch({ heroBar: { name: result.hero.name, hp: heroHp, maxHp: heroMax, foe: false } });
      const setFoeBar = () => patch({ foeBar: { name: foeName, hp: foeHp, maxHp: foeMax, foe: true } });

      setView({
        ...INITIAL,
        raiding: true,
        heroShown: true,
        heroArt: heroImg,
        heroX,
        heroMs: 0,
        heroCls: '',
        heroBar: { name: result.hero.name, hp: heroHp, maxHp: heroMax, foe: false },
        barsOn: true,
        litRoom: -1,
        doorOpen: -1
      });
      await camera(-1, 0);
      sfx('door');
      await wait(750);

      const step = async (e: RaidEvent) => {
        switch (e.t) {
          case 'raidStart':
            break;

          case 'enterRoom': {
            room = e.room;
            const target = e.kind === 'monster' || e.kind === 'throne' ? HERO_FRAC : SOLO_FRAC;
            heroX = xOf(room, target);
            foeX = xOf(room, FOE_FRAC);
            patch({ heroX, heroMs: 850, heroCls: 'walk', litRoom: room, foe: null, foeBar: null });
            sfx('step');
            await Promise.all([camera(room, 850), wait(850)]);
            patch({ heroCls: '' });
            break;
          }

          case 'doorOpen':
            patch({ doorOpen: e.room });
            sfx('door');
            await wait(260);
            break;

          case 'decision':
            patch({ intent: e.note });
            await wait(1100);
            patch({ intent: '' });
            break;

          case 'trapFire':
            if (e.disarmed) {
              patch({ callout: { key: ++keyId.current, text: 'DISARMED', danger: false } });
              sfx('tap');
            } else {
              patch({ flash: { key: ++keyId.current, tag: 'physical' } });
              sfx('trap');
            }
            await wait(420);
            break;

          case 'monsterAppear':
            foeName = e.monsterId === 'lord' ? LORD.name : e.monsterId;
            foeHp = e.hp;
            foeMax = e.maxHp;
            patch({ foe: { art: monsterArt(e.monsterId), x: foeX, cls: 'pop' } });
            setFoeBar();
            sfx('monster');
            await wait(560);
            patch({ foe: { art: monsterArt(e.monsterId), x: foeX, cls: '' } });
            break;

          case 'monsterSplit':
            foeHp = e.hp;
            setFoeBar();
            patch({ callout: { key: ++keyId.current, text: 'IT SPLITS', danger: true } });
            sfx('poison');
            await wait(560);
            break;

          case 'lordAppear':
            foeName = LORD.name;
            foeHp = e.hp;
            foeMax = e.maxHp;
            foeX = xOf(room, FOE_FRAC);
            patch({
              foe: { art: monsterArt('lord'), x: foeX, cls: 'pop' },
              callout: { key: ++keyId.current, text: `${LORD.short.toUpperCase()} · LV.${e.level}`, danger: false }
            });
            setFoeBar();
            sfx('lord');
            await wait(1150);
            patch({ foe: { art: monsterArt('lord'), x: foeX, cls: '' } });
            break;

          case 'heroAttack':
            patch({ heroCls: 'attack' });
            sfx('swing');
            await wait(150);
            if (e.miss) {
              float('MISS', 'dodge', foeX);
            } else {
              foeHp = e.targetHp;
              foeMax = e.targetMaxHp;
              setFoeBar();
              float(String(e.dmg), e.crit ? 'crit' : 'enemy', foeX);
              setView((v) => ({ ...v, foe: v.foe ? { ...v.foe, cls: 'hurt' } : null }));
              sfx('impact');
            }
            await wait(200);
            patch({ heroCls: '' });
            setView((v) => ({ ...v, foe: v.foe ? { ...v.foe, cls: '' } : null }));
            break;

          case 'enemyWindup':
            lastRanged = e.ranged;
            if (e.ranged) {
              patch({ bolt: { x: foeX, ms: 0, arcane: true } });
              await wait(60);
              patch({ bolt: { x: heroX, ms: 220, arcane: true } });
              await wait(240);
              patch({ bolt: null });
            } else {
              setView((v) => ({ ...v, foe: v.foe ? { ...v.foe, cls: 'attack left' } : null }));
              sfx('swing');
              await wait(240);
              setView((v) => ({ ...v, foe: v.foe ? { ...v.foe, cls: '' } : null }));
            }
            break;

          case 'ability':
            patch({ callout: { key: ++keyId.current, text: e.name.toUpperCase(), danger: false } });
            sfx(e.id === 'bloom' ? 'heal' : 'monster');
            await wait(780);
            break;

          case 'interaction':
            patch({ callout: { key: ++keyId.current, text: e.name, danger: true } });
            sfx(e.id === 'oil-fire' ? 'fire' : e.id === 'burn-frost' ? 'frost' : 'trap');
            await wait(900);
            break;

          case 'damage':
            heroHp = e.heroHp;
            heroMax = e.heroMaxHp;
            setHeroBar();
            if (e.evaded) {
              float('DODGE', 'dodge', heroX);
              sfx('swing');
            } else {
              patch({ heroCls: 'hurt', flash: { key: ++keyId.current, tag: e.tag } });
              float(`-${e.dmg}`, '', heroX);
              sfx(e.tag === 'fire' ? 'fire' : e.tag === 'frost' ? 'frost' : e.tag === 'poison' ? 'poison' : 'impact');
            }
            await wait(lastRanged ? 160 : 210);
            patch({ heroCls: '' });
            break;

          case 'heal':
            heroHp = e.heroHp;
            setHeroBar();
            float(`+${e.amount}`, 'heal', heroX);
            sfx('heal');
            await wait(200);
            break;

          case 'statusOn':
            if (!statuses.includes(e.kind)) statuses = [...statuses, e.kind];
            patch({ badges: statuses });
            float(statusDef(e.kind).short, 'tick', heroX);
            await wait(190);
            break;

          case 'statusOff':
            statuses = statuses.filter((s) => s !== e.kind);
            patch({ badges: statuses });
            break;

          case 'statusTick':
            heroHp = e.heroHp;
            setHeroBar();
            float(`-${e.dmg}`, 'tick', heroX);
            await wait(220);
            break;

          case 'monsterDown':
            setView((v) => ({ ...v, foe: v.foe ? { ...v.foe, cls: 'dying' } : null }));
            sfx('death');
            await wait(620);
            patch({ foe: null, foeBar: null });
            break;

          case 'treasureTaken':
            float(`+${e.gold}g`, 'gold', heroX);
            patch({ callout: { key: ++keyId.current, text: 'LOOTED', danger: true } });
            sfx('coin');
            await wait(700);
            break;

          case 'roomClear':
            await wait(160);
            break;

          case 'reaction':
            patch({ heroCls: e.kind === 'rage' ? 'rage' : '', reaction: REACTION_TEXT[e.kind] || '' });
            await wait(e.kind === 'dead' ? 100 : 380);
            if (e.kind !== 'rage') patch({ reaction: '' });
            break;

          case 'heroDown':
            patch({ heroCls: 'dying', reaction: '' });
            sfx('death');
            await wait(950);
            patch({ heroShown: false, barsOn: false });
            break;

          case 'heroFlee': {
            patch({ intent: `${result.hero.name} runs for the entrance!` });
            heroX = xOf(-1, 0.24);
            patch({ heroX, heroMs: 1300, heroCls: 'walk' });
            sfx('escape');
            await Promise.all([camera(-1, 1300), wait(1400)]);
            patch({ heroCls: '', heroShown: false, barsOn: false, intent: '' });
            break;
          }

          case 'raidEnd':
            sfx(e.outcome === 'dungeonWin' ? 'win' : e.outcome === 'heroEscape' ? 'escape' : 'lose');
            patch({ barsOn: false });
            await wait(600);
            break;
        }
      };

      for (const e of result.events) {
        await step(e);
      }

      setView({ ...INITIAL, raiding: false });
    },
    [float, patch, scrollRef, wait]
  );

  const reset = useCallback(() => setView(INITIAL), []);

  return { view, play, reset, speed, setSpeed };
}
