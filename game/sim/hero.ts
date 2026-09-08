import type {
  ActiveStatus,
  HeroDef,
  HeroInstance,
  HeroRecord,
  RaidEvent,
  StatusKind,
  Tag,
  TraitId,
  WorldModifiers
} from '../types';
import { heroDef } from '../content/heroes';
import { statusDef } from '../content/statuses';
import { findInteraction } from '../content/interactions';
import type { Rng } from './rng';

export function buildHero(record: HeroRecord, world: WorldModifiers): HeroInstance {
  const def = heroDef(record.defId);
  const lvl = Math.max(1, record.level);
  const hpMult = world.heroHp * (world.familyHp[def.family] || 1);
  const atkMult = world.heroAtk * (world.familyAtk[def.family] || 1);
  const maxHp = Math.max(1, Math.round((def.hp + (lvl - 1) * 9) * hpMult));
  return {
    uid: record.uid,
    defId: def.id,
    name: record.name,
    title: record.title,
    level: lvl,
    hp: maxHp,
    maxHp,
    atk: Math.max(1, Math.round((def.atk + (lvl - 1) * 1.6) * atkMult)),
    def: Math.round(def.def + (lvl - 1) * 0.5),
    scars: record.scars,
    status: [],
    raged: false,
    looted: 0,
    cooldown: 0
  };
}

export function snapshot(hero: HeroInstance) {
  return {
    uid: hero.uid,
    defId: hero.defId,
    name: hero.name,
    title: hero.title,
    level: hero.level,
    hp: hero.hp,
    maxHp: hero.maxHp,
    atk: hero.atk,
    def: hero.def,
    scars: hero.scars
  };
}

export function hasStatus(hero: HeroInstance, kind: StatusKind): boolean {
  return hero.status.some((s) => s.kind === kind);
}

export function traitBlocked(hero: HeroInstance, trait: TraitId): boolean {
  return hero.status.some((s) => statusDef(s.kind).blocksTraits.includes(trait));
}

function evasionOf(hero: HeroInstance, def: HeroDef): number {
  if (traitBlocked(hero, 'dodge')) return 0;
  let e = def.evasion;
  for (const s of hero.status) e += statusDef(s.kind).evasionDelta;
  return Math.max(0, Math.min(0.85, e));
}

export function atkMultOf(hero: HeroInstance): number {
  let m = 1;
  for (const s of hero.status) m *= statusDef(s.kind).atkMult;
  if (hero.raged) {
    const r = heroDef(hero.defId).rage;
    if (r) m *= r.atkMult;
  }
  return m;
}

export function defMultOf(hero: HeroInstance): number {
  let m = 1;
  for (const s of hero.status) m *= statusDef(s.kind).defMult;
  return m;
}

export function fleeThresholdOf(hero: HeroInstance, def: HeroDef): number {
  let t = def.fleeThreshold;
  for (const s of hero.status) t += statusDef(s.kind).fleeDelta;
  return t;
}

export function applyStatus(
  hero: HeroInstance,
  kind: StatusKind,
  rooms: number,
  def: HeroDef,
  out: RaidEvent[],
  potency = 1
): void {
  if (kind === 'fear' && def.fearImmune) return;
  const sd = statusDef(kind);
  if (sd.tags.length > 0 && sd.tags.every((tag) => def.resist.includes(tag))) {
    rooms = Math.max(1, Math.floor(rooms / 2));
    potency *= 0.5;
  }
  const existing = hero.status.find((s) => s.kind === kind);
  if (existing) {
    existing.roomsLeft = Math.max(existing.roomsLeft, rooms);
    existing.potency = Math.max(existing.potency, potency);
    return;
  }
  hero.status.push({ kind, roomsLeft: rooms, potency });
  out.push({ t: 'statusOn', kind });
}

function clearStatus(hero: HeroInstance, kind: StatusKind, out: RaidEvent[]): void {
  const before = hero.status.length;
  hero.status = hero.status.filter((s) => s.kind !== kind);
  if (hero.status.length !== before) out.push({ t: 'statusOff', kind });
}

export function tickStatusDamage(hero: HeroInstance, out: RaidEvent[]): Tag | null {
  let killedBy: Tag | null = null;
  for (const s of hero.status) {
    const def = statusDef(s.kind);
    const dmg = Math.round(def.dmgPerTick * s.potency);
    if (dmg <= 0) continue;
    hero.hp = Math.max(0, hero.hp - dmg);
    out.push({ t: 'statusTick', kind: s.kind, dmg, heroHp: hero.hp });
    if (hero.hp <= 0) {
      killedBy = def.tags[0] || 'poison';
      break;
    }
  }
  return killedBy;
}

export function advanceStatuses(hero: HeroInstance, out: RaidEvent[]): void {
  const kept: ActiveStatus[] = [];
  for (const s of hero.status) {
    const left = s.roomsLeft - 1;
    if (left > 0) kept.push({ ...s, roomsLeft: left });
    else out.push({ t: 'statusOff', kind: s.kind });
  }
  hero.status = kept;
}

export interface IncomingHit {
  amount: number;
  tag: Tag;
  source: 'trap' | 'monster' | 'lord';
  applies: { kind: StatusKind; rooms: number } | null;
  ignoreEvasion?: boolean;
}

export function resolveHit(
  hero: HeroInstance,
  def: HeroDef,
  hit: IncomingHit,
  rng: Rng,
  out: RaidEvent[]
): { dmg: number; evaded: boolean } {
  const evaded = !hit.ignoreEvasion && rng() < evasionOf(hero, def);
  if (evaded) {
    out.push({ t: 'damage', source: hit.source, tag: hit.tag, dmg: 0, evaded: true, heroHp: hero.hp, heroMaxHp: hero.maxHp });
    return { dmg: 0, evaded: true };
  }

  let dmg = hit.amount;
  let extra: StatusKind | null = null;

  const inter = findInteraction(hit.tag, (k) => hasStatus(hero, k as StatusKind));
  if (inter) {
    dmg *= inter.dmgMult;
    if (inter.consumes) clearStatus(hero, inter.requiresStatus, out);
    if (inter.applies) extra = inter.applies;
    out.push({ t: 'interaction', id: inter.id, name: inter.name, hint: inter.hint });
  }

  if (def.resist.includes(hit.tag)) dmg *= 0.55;
  if (def.vuln.includes(hit.tag)) dmg *= 1.35;
  for (const scar of hero.scars) if (scar === hit.tag) dmg *= 0.75;
  dmg *= 1 - def.mitigate;

  dmg = dmg > 0 ? Math.max(1, Math.round(dmg)) : 0;
  if (dmg > 0) hero.hp = Math.max(0, hero.hp - dmg);

  out.push({ t: 'damage', source: hit.source, tag: hit.tag, dmg, evaded: false, heroHp: hero.hp, heroMaxHp: hero.maxHp });

  if (hit.applies) applyStatus(hero, hit.applies.kind, hit.applies.rooms, def, out);
  if (extra) applyStatus(hero, extra, statusDef(extra).rooms, def, out, inter && inter.id === 'poison-stack' ? 1.5 : 1);

  return { dmg, evaded: false };
}

export function heal(hero: HeroInstance, amount: number, out: RaidEvent[]): void {
  const before = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(amount));
  const gained = hero.hp - before;
  if (gained > 0) out.push({ t: 'heal', amount: gained, heroHp: hero.hp });
}
