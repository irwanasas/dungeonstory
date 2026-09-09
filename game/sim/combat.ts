import type {
  ActiveStatus,
  HeroDef,
  HeroInstance,
  MonsterDef,
  RaidEvent,
  StatusKind,
  Tag,
  WorldModifiers
} from '../types';
import { LORD } from '../content/monsters';
import type { LordWeapon } from '../content/lordWeapons';
import { atkMultOf, defMultOf, heal, resolveHit, tickStatusDamage, traitBlocked } from './hero';
import { hpPct, tryAbility } from './ai';
import type { Rng } from './rng';

export const MAX_ROUNDS = 20;

export interface Enemy {
  id: string;
  name: string;
  tag: Tag;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  hitsPerRound: number;
  cadence: number;
  strikesFirst: boolean;
  defPierce: number;
  evasion: number;
  splitAt: number;
  ranged: boolean;
  applies: { kind: StatusKind; days: number } | null;
  source: 'monster' | 'lord';
}

export function monsterEnemy(def: MonsterDef, level: number, world: WorldModifiers): Enemy {
  const lvl = Math.max(1, level);
  const hp = Math.max(1, Math.round((def.hp + (lvl - 1) * def.hpPerLevel) * world.monsterHp));
  return {
    id: def.id,
    name: def.name,
    tag: def.tag,
    hp,
    maxHp: hp,
    atk: Math.max(1, Math.round((def.atk + (lvl - 1) * def.atkPerLevel) * world.monsterAtk)),
    def: def.def,
    hitsPerRound: def.hitsPerRound,
    cadence: def.cadence,
    strikesFirst: def.strikesFirst,
    defPierce: def.defPierce,
    evasion: def.evasion,
    splitAt: def.splitAt,
    ranged: def.ranged,
    applies: def.applies,
    source: 'monster'
  };
}

export function lordEnemy(weapon: LordWeapon, level: number, world: WorldModifiers): Enemy {
  const lvl = Math.max(1, level);
  const hp = Math.max(1, Math.round((LORD.hp + (lvl - 1) * LORD.hpPerLevel) * world.monsterHp));
  return {
    id: 'lord',
    name: LORD.name,
    tag: weapon.tag,
    hp,
    maxHp: hp,
    atk: Math.max(1, Math.round((LORD.atk + (lvl - 1) * LORD.atkPerLevel) * world.monsterAtk)),
    def: Math.round(LORD.def + (lvl - 1) * LORD.defPerLevel),
    hitsPerRound: LORD.hitsPerRound,
    cadence: 1,
    strikesFirst: false,
    defPierce: 0.15,
    evasion: 0.05,
    splitAt: 0,
    ranged: false,
    applies: null,
    source: 'lord'
  };
}

export interface Foe extends Enemy {
  slot: number;
  splitDone: boolean;
  status: ActiveStatus[];
}

export function toFoe(enemy: Enemy, slot: number, status: ActiveStatus[] = []): Foe {
  return { ...enemy, slot, splitDone: enemy.splitAt <= 0, status };
}

export interface Combatant {
  hero: HeroInstance;
  def: HeroDef;
  killedByTag: Tag | null;
}

export interface PartyCtx {
  members: Combatant[];
  rng: Rng;
  out: RaidEvent[];
  world: WorldModifiers;
}

export interface Ctx {
  hero: HeroInstance;
  def: HeroDef;
  rng: Rng;
  out: RaidEvent[];
  killedByTag: Tag | null;
  world: WorldModifiers;
}

export function tagMult(world: WorldModifiers, tag: Tag): number {
  return world.tagDamage[tag] || 1;
}

const alive = (m: Combatant) => m.hero.hp > 0;
const standing = (f: Foe) => f.hp > 0;

function foeStrike(ctx: PartyCtx, foe: Foe, target: Combatant, tagSlot: boolean): void {
  ctx.out.push({ t: 'enemyWindup', ranged: foe.ranged, ...(tagSlot ? { slot: foe.slot } : {}) });
  for (let hit = 0; hit < foe.hitsPerRound; hit++) {
    if (target.hero.hp <= 0) return;
    const armour = target.hero.def * defMultOf(target.hero) * (1 - foe.defPierce);
    const raw = Math.max(1, foe.atk - armour * 0.5) * tagMult(ctx.world, foe.tag);
    const res = resolveHit(
      target.hero,
      target.def,
      { amount: raw, tag: foe.tag, source: foe.source, applies: foe.applies },
      ctx.rng,
      ctx.out
    );
    if (res.dmg > 0) ctx.out.push({ t: 'reaction', kind: 'pain' });
    if (target.hero.hp <= 0) {
      target.killedByTag = foe.tag;
      return;
    }
  }
}

function memberStrike(ctx: PartyCtx, m: Combatant, foe: Foe, round: number, tagSlot: boolean): void {
  const miss = ctx.rng() < foe.evasion;
  let dmg = m.hero.atk * atkMultOf(m.hero);
  const crit = round === 0 && m.def.burst > 1 && !traitBlocked(m.hero, 'burst');
  if (crit) dmg *= m.def.burst;
  if (!traitBlocked(m.hero, 'ramp')) dmg *= 1 + Math.min(m.def.rampCap, m.def.rampPerRound * round);
  dmg = Math.max(1, Math.round(dmg - foe.def));
  if (miss) dmg = 0;
  foe.hp = Math.max(0, foe.hp - dmg);
  ctx.out.push({
    t: 'heroAttack',
    dmg,
    crit,
    miss,
    targetHp: foe.hp,
    targetMaxHp: foe.maxHp,
    ...(tagSlot ? { slot: foe.slot } : {})
  });

  if (!foe.splitDone && foe.splitAt > 0 && foe.hp > 0 && foe.hp <= foe.maxHp * foe.splitAt) {
    foe.splitDone = true;
    foe.hp = Math.round(foe.maxHp * foe.splitAt);
    ctx.out.push({
      t: 'monsterSplit',
      monsterId: foe.id,
      hp: foe.hp,
      maxHp: foe.maxHp,
      ...(tagSlot ? { slot: foe.slot } : {})
    });
  }
}

function pickTarget(ctx: PartyCtx, foe: Foe): number {
  const idx = ctx.members.map((m, i) => i).filter((i) => alive(ctx.members[i]));
  if (idx.length === 0) return -1;
  if (idx.length === 1) return idx[0];
  if (foe.ranged) {
    return idx.reduce((low, i) => (ctx.members[i].hero.hp < ctx.members[low].hero.hp ? i : low), idx[0]);
  }
  return idx[Math.floor(ctx.rng() * idx.length) % idx.length];
}

export function fightGroup(ctx: PartyCtx, foes: Foe[]): { wiped: boolean; foesDead: boolean; stalled: boolean } {
  const multiFoe = foes.length > 1;
  const multiMember = ctx.members.length > 1;
  const panicked = new Set<number>();

  const anyAlive = () => ctx.members.some(alive);
  const anyStanding = () => foes.some(standing);

  const setActor = (i: number) => {
    if (!multiMember) return;
    const m = ctx.members[i];
    ctx.out.push({ t: 'actor', index: i, name: m.hero.name, defId: m.hero.defId });
  };

  const downed = new Set<number>();
  const reportDown = (i: number) => {
    if (!multiMember || downed.has(i) || alive(ctx.members[i])) return;
    downed.add(i);
    ctx.out.push({ t: 'reaction', kind: 'dead' });
    ctx.out.push({ t: 'heroDown' });
  };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    for (let i = 0; i < ctx.members.length; i++) {
      const m = ctx.members[i];
      if (!alive(m)) continue;
      setActor(i);
      const tickKill = tickStatusDamage(m.hero, ctx.out);
      if (m.hero.hp <= 0) m.killedByTag = tickKill || m.killedByTag;
      reportDown(i);
    }
    if (!anyAlive()) return { wiped: true, foesDead: false, stalled: false };

    for (let i = 0; i < ctx.members.length; i++) {
      const m = ctx.members[i];
      if (!alive(m)) continue;
      setActor(i);
      if (m.def.regen > 0 && !traitBlocked(m.hero, 'regen')) heal(m.hero, m.hero.maxHp * m.def.regen, ctx.out);
      tryAbility(m.hero, m.def, ctx.out);
    }

    const acting = foes.filter((f) => standing(f) && round % f.cadence === f.cadence - 1);

    for (const foe of acting) {
      if (!foe.strikesFirst) continue;
      const ti = pickTarget(ctx, foe);
      if (ti < 0) break;
      setActor(ti);
      foeStrike(ctx, foe, ctx.members[ti], multiFoe);
      reportDown(ti);
    }
    if (!anyAlive()) return { wiped: true, foesDead: false, stalled: false };

    for (let i = 0; i < ctx.members.length; i++) {
      const m = ctx.members[i];
      if (!alive(m)) continue;
      const foe = foes.find(standing);
      if (!foe) break;
      setActor(i);
      memberStrike(ctx, m, foe, round, multiFoe);
      if (foe.hp <= 0 && foe.source === 'monster') {
        ctx.out.push({ t: 'monsterDown', monsterId: foe.id, ...(multiFoe ? { slot: foe.slot } : {}) });
      }
    }
    if (!anyStanding()) return { wiped: false, foesDead: true, stalled: false };

    for (const foe of foes) {
      if (foe.strikesFirst || !standing(foe)) continue;
      if (round % foe.cadence === foe.cadence - 1) {
        const ti = pickTarget(ctx, foe);
        if (ti < 0) break;
        setActor(ti);
        foeStrike(ctx, foe, ctx.members[ti], multiFoe);
        reportDown(ti);
      } else {
        ctx.out.push({ t: 'enemyWindup', ranged: foe.ranged, ...(multiFoe ? { slot: foe.slot } : {}) });
      }
    }
    if (!anyAlive()) return { wiped: true, foesDead: false, stalled: false };

    for (let i = 0; i < ctx.members.length; i++) {
      const m = ctx.members[i];
      if (!alive(m) || panicked.has(i) || hpPct(m.hero) > 0.3) continue;
      panicked.add(i);
      setActor(i);
      ctx.out.push({ t: 'reaction', kind: 'panic' });
    }
  }

  return { wiped: false, foesDead: false, stalled: true };
}

export function fight(ctx: Ctx, enemy: Enemy): { heroDied: boolean; enemyDied: boolean } {
  const member: Combatant = { hero: ctx.hero, def: ctx.def, killedByTag: ctx.killedByTag };
  const party: PartyCtx = { members: [member], rng: ctx.rng, out: ctx.out, world: ctx.world };
  const foe = toFoe(enemy, 0);
  const res = fightGroup(party, [foe]);
  enemy.hp = foe.hp;
  ctx.killedByTag = member.killedByTag;
  return { heroDied: res.wiped, enemyDied: res.foesDead };
}
