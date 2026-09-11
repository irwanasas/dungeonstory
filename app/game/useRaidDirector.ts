'use client';

import { useCallback, useRef, useState } from 'react';
import type { RaidEvent, StatusKind, Tag } from '../../game/types';
import { statusDef } from '../../game/content/statuses';
import { LORD, monsterDef } from '../../game/content/monsters';
import { heroArt, monsterArt } from './art';
import { play as sfx } from './audio';

export const CELL = 256;
const HERO_BASE = 0.28;
const HERO_STEP = 0.09;
const FOE_BASE = 0.6;
const FOE_STEP = 0.11;
const SOLO_BASE = 0.4;

export interface FloatFx {
  key: number;
  text: string;
  cls: string;
  x: number;
  dy: number;
}

export interface BarView {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  foe: boolean;
}

export interface ActorView {
  index: number;
  art: string;
  x: number;
  ms: number;
  cls: string;
  shown: boolean;
  badges: StatusKind[];
  reaction: string;
}

export interface FoeView {
  slot: number;
  art: string;
  x: number;
  cls: string;
}

export interface DirectorView {
  raiding: boolean;
  party: ActorView[];
  foes: FoeView[];
  bars: BarView[];
  barsOn: boolean;
  bolt: { x: number; ms: number; arcane: boolean } | null;
  fx: FloatFx[];
  flash: { key: number; tag: Tag } | null;
  callout: { key: number; text: string; danger: boolean } | null;
  intent: string;
  doorOpen: number;
  litRoom: number;
}

const INITIAL: DirectorView = {
  raiding: false,
  party: [],
  foes: [],
  bars: [],
  barsOn: false,
  bolt: null,
  fx: [],
  flash: null,
  callout: null,
  intent: '',
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

export interface PartySeed {
  name: string;
  defId: string;
  hp: number;
  maxHp: number;
}

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

interface HeroState {
  name: string;
  defId: string;
  hp: number;
  maxHp: number;
  statuses: StatusKind[];
  shown: boolean;
  x: number;
  ms: number;
  cls: string;
  reaction: string;
}

interface FoeState {
  slot: number;
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  cls: string;
  gone: boolean;
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
    async (events: RaidEvent[], seeds: PartySeed[], fromRoom = -1) => {
      const el = scrollRef.current;
      const camera = (roomIndex: number, ms: number) =>
        el ? tween(el, (roomIndex + 1) * CELL, ms) : Promise.resolve();
      const xOf = (roomIndex: number, frac: number) => (roomIndex + 1) * CELL + CELL * frac;

      let room = fromRoom;
      let actor = 0;
      let lastRanged = false;
      let combatRoom = false;

      const heroes: HeroState[] = seeds.map((s, i) => ({
        name: s.name,
        defId: s.defId,
        hp: s.hp,
        maxHp: s.maxHp,
        statuses: [],
        shown: true,
        x: xOf(fromRoom, HERO_BASE + i * HERO_STEP),
        ms: 0,
        cls: '',
        reaction: ''
      }));
      const foes: FoeState[] = [];

      const heroFrac = (i: number) => (combatRoom ? HERO_BASE : SOLO_BASE) + i * HERO_STEP;
      const cur = () => heroes[Math.min(actor, heroes.length - 1)] || heroes[0];

      const commitActors = () =>
        setView((v) => ({
          ...v,
          party: heroes.map((h, i) => ({
            index: i,
            art: heroArt(h.defId),
            x: h.x,
            ms: h.ms,
            cls: h.cls,
            shown: h.shown,
            badges: h.statuses,
            reaction: h.reaction
          })),
          foes: foes.filter((f) => !f.gone).map((f) => ({ slot: f.slot, art: monsterArt(f.id), x: f.x, cls: f.cls })),
          bars: [
            ...heroes.filter((h) => h.shown).map((h, i) => ({ id: 'h' + i, name: h.name, hp: h.hp, maxHp: h.maxHp, foe: false })),
            ...foes
              .filter((f) => !f.gone)
              .map((f) => ({ id: 'f' + f.slot, name: f.name, hp: f.hp, maxHp: f.maxHp, foe: true }))
          ]
        }));

      setView({ ...INITIAL, raiding: true, barsOn: true, litRoom: fromRoom, doorOpen: -1 });
      commitActors();
      await camera(fromRoom, 0);
      sfx('door');
      await wait(750);

      const step = async (e: RaidEvent) => {
        switch (e.t) {
          case 'raidStart':
            break;

          case 'actor':
            actor = Math.min(e.index, heroes.length - 1);
            break;

          case 'enterRoom': {
            room = e.room;
            combatRoom = e.kind === 'monster' || e.kind === 'throne';
            for (const f of foes) f.gone = true;
            heroes.forEach((h, i) => {
              h.x = xOf(room, heroFrac(i));
              h.ms = 850;
              h.cls = h.shown ? 'walk' : '';
            });
            patch({ litRoom: room });
            commitActors();
            sfx('step');
            await Promise.all([camera(room, 850), wait(850)]);
            for (const h of heroes) h.cls = '';
            commitActors();
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

          case 'monsterAppear': {
            const slot = e.slot ?? 0;
            const name = e.monsterId === 'lord' ? LORD.name : monsterDef(e.monsterId).name;
            const existing = foes.find((f) => f.slot === slot);
            const next: FoeState = {
              slot,
              id: e.monsterId,
              name,
              hp: e.hp,
              maxHp: e.maxHp,
              x: xOf(room, FOE_BASE + slot * FOE_STEP),
              cls: 'pop',
              gone: false
            };
            if (existing) Object.assign(existing, next);
            else foes.push(next);
            commitActors();
            sfx('monster');
            await wait(e.slot === undefined || slot === 0 ? 560 : 200);
            const f = foes.find((x) => x.slot === slot);
            if (f) f.cls = '';
            commitActors();
            break;
          }

          case 'monsterSplit': {
            const f = foes.find((x) => x.slot === (e.slot ?? 0));
            if (f) f.hp = e.hp;
            commitActors();
            patch({ callout: { key: ++keyId.current, text: 'IT SPLITS', danger: true } });
            sfx('poison');
            await wait(560);
            break;
          }

          case 'lordAppear': {
            foes.length = 0;
            foes.push({
              slot: 0,
              id: 'lord',
              name: LORD.name,
              hp: e.hp,
              maxHp: e.maxHp,
              x: xOf(room, FOE_BASE + FOE_STEP),
              cls: 'pop',
              gone: false
            });
            commitActors();
            patch({ callout: { key: ++keyId.current, text: `${LORD.short.toUpperCase()} · LV.${e.level}`, danger: false } });
            sfx('lord');
            await wait(1150);
            foes[0].cls = '';
            commitActors();
            break;
          }

          case 'heroAttack': {
            const h = cur();
            const f = foes.find((x) => x.slot === (e.slot ?? 0) && !x.gone);
            h.cls = 'attack';
            commitActors();
            sfx('swing');
            await wait(150);
            if (e.miss) {
              float('MISS', 'dodge', f ? f.x : h.x);
            } else {
              if (f) {
                f.hp = e.targetHp;
                f.maxHp = e.targetMaxHp;
                f.cls = 'hurt';
              }
              float(String(e.dmg), e.crit ? 'crit' : 'enemy', f ? f.x : h.x);
              commitActors();
              sfx('impact');
            }
            await wait(200);
            h.cls = '';
            if (f) f.cls = '';
            commitActors();
            break;
          }

          case 'enemyWindup': {
            lastRanged = e.ranged;
            const f = foes.find((x) => x.slot === (e.slot ?? 0) && !x.gone);
            if (e.ranged) {
              patch({ bolt: { x: f ? f.x : xOf(room, FOE_BASE), ms: 0, arcane: true } });
              await wait(60);
              patch({ bolt: { x: cur().x, ms: 220, arcane: true } });
              await wait(240);
              patch({ bolt: null });
            } else {
              if (f) f.cls = 'attack left';
              commitActors();
              sfx('swing');
              await wait(240);
              if (f) f.cls = '';
              commitActors();
            }
            break;
          }

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

          case 'damage': {
            const h = cur();
            h.hp = e.heroHp;
            h.maxHp = e.heroMaxHp;
            if (e.evaded) {
              float('DODGE', 'dodge', h.x);
              commitActors();
              sfx('swing');
            } else {
              h.cls = 'hurt';
              patch({ flash: { key: ++keyId.current, tag: e.tag } });
              float(`-${e.dmg}`, '', h.x);
              commitActors();
              sfx(e.tag === 'fire' ? 'fire' : e.tag === 'frost' ? 'frost' : e.tag === 'poison' ? 'poison' : 'impact');
            }
            await wait(lastRanged ? 160 : 210);
            h.cls = '';
            commitActors();
            break;
          }

          case 'heal': {
            const h = cur();
            h.hp = e.heroHp;
            float(`+${e.amount}`, 'heal', h.x);
            commitActors();
            sfx('heal');
            await wait(200);
            break;
          }

          case 'statusOn': {
            const h = cur();
            if (!h.statuses.includes(e.kind)) h.statuses = [...h.statuses, e.kind];
            float(statusDef(e.kind).short, 'tick', h.x);
            commitActors();
            await wait(190);
            break;
          }

          case 'statusOff': {
            const h = cur();
            h.statuses = h.statuses.filter((s) => s !== e.kind);
            commitActors();
            break;
          }

          case 'statusTick': {
            const h = cur();
            h.hp = e.heroHp;
            float(`-${e.dmg}`, 'tick', h.x);
            commitActors();
            await wait(220);
            break;
          }

          case 'monsterDown': {
            const f = foes.find((x) => x.slot === (e.slot ?? 0) && !x.gone);
            if (f) {
              f.cls = 'dying';
              commitActors();
            }
            sfx('death');
            await wait(620);
            if (f) f.gone = true;
            commitActors();
            break;
          }

          case 'treasureTaken':
            float(`+${e.gold}g`, 'gold', cur().x);
            patch({ callout: { key: ++keyId.current, text: 'LOOTED', danger: true } });
            sfx('coin');
            await wait(700);
            break;

          case 'roomClear':
            await wait(160);
            break;

          case 'reaction': {
            const h = cur();
            h.cls = e.kind === 'rage' ? 'rage' : h.cls;
            h.reaction = REACTION_TEXT[e.kind] || '';
            commitActors();
            await wait(e.kind === 'dead' ? 100 : 380);
            if (e.kind !== 'rage') {
              h.reaction = '';
              commitActors();
            }
            break;
          }

          case 'heroDown': {
            const h = cur();
            h.cls = 'dying';
            h.reaction = '';
            commitActors();
            sfx('death');
            await wait(950);
            h.shown = false;
            commitActors();
            if (!heroes.some((x) => x.shown)) patch({ barsOn: false });
            break;
          }

          case 'waveWipe':
            patch({ callout: { key: ++keyId.current, text: `WAVE ${e.wave} BROKEN`, danger: false } });
            await wait(800);
            break;

          case 'stalled':
            patch({ callout: { key: ++keyId.current, text: 'STANDOFF', danger: false } });
            await wait(700);
            break;

          case 'heroFlee': {
            patch({ intent: `${cur().name} runs for the entrance!` });
            heroes.forEach((h, i) => {
              if (!h.shown) return;
              h.x = xOf(-1, 0.2 + i * 0.06);
              h.ms = 1300;
              h.cls = 'walk';
            });
            commitActors();
            sfx('escape');
            await Promise.all([camera(-1, 1300), wait(1400)]);
            for (const h of heroes) {
              h.cls = '';
              h.shown = false;
            }
            commitActors();
            patch({ barsOn: false, intent: '' });
            break;
          }

          case 'raidEnd':
            sfx(e.outcome === 'dungeonWin' ? 'win' : e.outcome === 'heroEscape' ? 'escape' : 'lose');
            patch({ barsOn: false });
            await wait(600);
            break;
        }
      };

      for (const e of events) {
        await step(e);
      }

      setView({ ...INITIAL, raiding: false });
    },
    [float, patch, scrollRef, wait]
  );

  return { view, play, speed, setSpeed };
}
