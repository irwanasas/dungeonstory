import type { ActiveEvent, HeroFamily, Tag, WorldEffect, WorldEvent, WorldModifiers, WorldState } from '../types';
import { ROLLABLE, worldEvent } from '../content/worldEvents';
import { heroDef } from '../content/heroes';
import type { Rng } from '../sim/rng';

const MAX_ACTIVE_EFFECTS = 2;
const CLAMP_LOW = 0.8;
const CLAMP_HIGH = 1.25;
const MIN_STAGE = 3;
const HISTORY_MAX = 12;
const REPEAT_GUARD = 6;

export function defaultWorld(): WorldState {
  return { active: [], queued: [], history: [], nextIn: 2, unread: 0 };
}

export function normalizeWorld(input: Partial<WorldState> | undefined): WorldState {
  const base = defaultWorld();
  if (!input) return base;
  return {
    active: (Array.isArray(input.active) ? input.active : []).filter((a) => worldEvent(a.id) && a.raidsLeft > 0),
    queued: (Array.isArray(input.queued) ? input.queued : []).filter((id) => worldEvent(id)),
    history: (Array.isArray(input.history) ? input.history : []).filter((id) => worldEvent(id)).slice(0, HISTORY_MAX),
    nextIn: typeof input.nextIn === 'number' ? input.nextIn : base.nextIn,
    unread: typeof input.unread === 'number' ? Math.max(0, input.unread) : 0
  };
}

function clamp(v: number): number {
  return Math.max(CLAMP_LOW, Math.min(CLAMP_HIGH, v));
}

function mul<K extends string>(map: Partial<Record<K, number>>, key: K, value: number): void {
  map[key] = (map[key] || 1) * value;
}

function activeEvents(world: WorldState): WorldEvent[] {
  return world.active.map((a) => worldEvent(a.id)).filter((e): e is WorldEvent => e !== null);
}

export function worldModifiers(world: WorldState): WorldModifiers {
  const m: WorldModifiers = {
    heroAtk: 1,
    heroHp: 1,
    familyAtk: {},
    familyHp: {},
    monsterAtk: 1,
    monsterHp: 1,
    trapDamage: 1,
    tagDamage: {},
    gold: 1,
    souls: 1,
    heroBias: []
  };

  for (const e of activeEvents(world)) {
    const f = e.effect;
    if (!f) continue;
    if (f.heroAtk) m.heroAtk *= f.heroAtk;
    if (f.heroHp) m.heroHp *= f.heroHp;
    if (f.monsterAtk) m.monsterAtk *= f.monsterAtk;
    if (f.monsterHp) m.monsterHp *= f.monsterHp;
    if (f.trapDamage) m.trapDamage *= f.trapDamage;
    if (f.gold) m.gold *= f.gold;
    if (f.souls) m.souls *= f.souls;
    for (const [k, v] of Object.entries(f.familyAtk || {})) mul(m.familyAtk, k as HeroFamily, v as number);
    for (const [k, v] of Object.entries(f.familyHp || {})) mul(m.familyHp, k as HeroFamily, v as number);
    for (const [k, v] of Object.entries(f.tagDamage || {})) mul(m.tagDamage, k as Tag, v as number);
    for (const id of f.heroBias || []) if (!m.heroBias.includes(id)) m.heroBias.push(id);
  }

  m.heroAtk = clamp(m.heroAtk);
  m.heroHp = clamp(m.heroHp);
  m.monsterAtk = clamp(m.monsterAtk);
  m.monsterHp = clamp(m.monsterHp);
  m.trapDamage = clamp(m.trapDamage);
  m.gold = clamp(m.gold);
  m.souls = clamp(m.souls);
  for (const k of Object.keys(m.familyAtk)) m.familyAtk[k as HeroFamily] = clamp(m.familyAtk[k as HeroFamily] as number);
  for (const k of Object.keys(m.familyHp)) m.familyHp[k as HeroFamily] = clamp(m.familyHp[k as HeroFamily] as number);
  for (const k of Object.keys(m.tagDamage)) m.tagDamage[k as Tag] = clamp(m.tagDamage[k as Tag] as number);

  return m;
}

export function noWorld(): WorldModifiers {
  return worldModifiers(defaultWorld());
}

export function effectCount(world: WorldState): number {
  return activeEvents(world).filter((e) => e.effect).length;
}

function eligible(event: WorldEvent, active: ActiveEvent[], history: string[], stage: number, effects: number): boolean {
  if (active.some((a) => a.id === event.id)) return false;
  if (event.minStage && stage < event.minStage) return false;
  if (history.slice(0, REPEAT_GUARD).includes(event.id)) return false;
  if (event.effect && effects >= MAX_ACTIVE_EFFECTS) return false;
  return true;
}

export function tickWorld(world: WorldState, stage: number, rng: Rng): { world: WorldState; fired: WorldEvent | null } {
  const queued = [...world.queued];
  const active: ActiveEvent[] = [];

  for (const a of world.active) {
    const left = a.raidsLeft - 1;
    if (left > 0) {
      active.push({ id: a.id, raidsLeft: left });
      continue;
    }
    const done = worldEvent(a.id);
    for (const link of done?.leadsTo || []) {
      if (rng() < link.chance && !queued.includes(link.id)) queued.push(link.id);
    }
  }

  let nextIn = world.nextIn - 1;
  let history = world.history;
  let unread = world.unread;
  let fired: WorldEvent | null = null;

  if (nextIn <= 0 && stage >= MIN_STAGE) {
    const effects = active.filter((a) => worldEvent(a.id)?.effect).length;

    const qIndex = queued.findIndex((id) => {
      const e = worldEvent(id);
      return e ? eligible(e, active, history, stage, effects) : false;
    });
    if (qIndex >= 0) {
      fired = worldEvent(queued[qIndex]);
      queued.splice(qIndex, 1);
    } else {
      const pool = ROLLABLE.filter((e) => eligible(e, active, history, stage, effects));
      if (pool.length > 0) fired = pool[Math.floor(rng() * pool.length) % pool.length];
    }

    if (fired) {
      active.push({ id: fired.id, raidsLeft: fired.duration });
      history = [fired.id, ...history].slice(0, HISTORY_MAX);
      unread += 1;
    }
    nextIn = 2 + Math.floor(rng() * 3);
  }

  return { world: { active, queued, history, nextIn, unread }, fired };
}

const FAMILY_LABEL: Record<HeroFamily, string> = {
  warrior: 'Warriors',
  rogue: 'Rogues',
  mage: 'Mages'
};

function pct(v: number): string {
  const n = Math.round((v - 1) * 100);
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;
}

export function describeEffect(effect: WorldEffect | undefined): string[] {
  if (!effect) return [];
  const out: string[] = [];
  if (effect.heroAtk) out.push(`All heroes ${pct(effect.heroAtk)} ATK`);
  if (effect.heroHp) out.push(`All heroes ${pct(effect.heroHp)} HP`);
  for (const [k, v] of Object.entries(effect.familyAtk || {})) out.push(`${FAMILY_LABEL[k as HeroFamily]} ${pct(v as number)} ATK`);
  for (const [k, v] of Object.entries(effect.familyHp || {})) out.push(`${FAMILY_LABEL[k as HeroFamily]} ${pct(v as number)} HP`);
  if (effect.monsterAtk) out.push(`Your monsters ${pct(effect.monsterAtk)} ATK`);
  if (effect.monsterHp) out.push(`Your monsters ${pct(effect.monsterHp)} HP`);
  if (effect.trapDamage) out.push(`Your traps ${pct(effect.trapDamage)} damage`);
  for (const [k, v] of Object.entries(effect.tagDamage || {})) out.push(`${k[0].toUpperCase()}${k.slice(1)} damage ${pct(v as number)}`);
  if (effect.gold) out.push(`Gold rewards ${pct(effect.gold)}`);
  if (effect.souls) out.push(`Soul rewards ${pct(effect.souls)}`);
  if (effect.heroBias && effect.heroBias.length > 0) {
    out.push(`${effect.heroBias.map((id) => heroDef(id).name).join(' and ')} come more often`);
  }
  return out;
}
