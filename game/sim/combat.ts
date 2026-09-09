import type { HeroDef, HeroInstance, MonsterDef, RaidEvent, StatusKind, Tag, WorldModifiers } from '../types';
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

export function enemyTurn(ctx: Ctx, enemy: Enemy): void {
  ctx.out.push({ t: 'enemyWindup', ranged: enemy.ranged });
  for (let hit = 0; hit < enemy.hitsPerRound; hit++) {
    const armour = ctx.hero.def * defMultOf(ctx.hero) * (1 - enemy.defPierce);
    const raw = Math.max(1, enemy.atk - armour * 0.5) * tagMult(ctx.world, enemy.tag);
    const res = resolveHit(
      ctx.hero,
      ctx.def,
      { amount: raw, tag: enemy.tag, source: enemy.source, applies: enemy.applies },
      ctx.rng,
      ctx.out
    );
    if (res.dmg > 0) ctx.out.push({ t: 'reaction', kind: 'pain' });
    if (ctx.hero.hp <= 0) {
      ctx.killedByTag = enemy.tag;
      return;
    }
  }
}

export function heroTurn(ctx: Ctx, enemy: Enemy, round: number, split: { done: boolean }): void {
  const miss = ctx.rng() < enemy.evasion;
  let dmg = ctx.hero.atk * atkMultOf(ctx.hero);
  const crit = round === 0 && ctx.def.burst > 1 && !traitBlocked(ctx.hero, 'burst');
  if (crit) dmg *= ctx.def.burst;
  if (!traitBlocked(ctx.hero, 'ramp')) dmg *= 1 + Math.min(ctx.def.rampCap, ctx.def.rampPerRound * round);
  dmg = Math.max(1, Math.round(dmg - enemy.def));
  if (miss) dmg = 0;
  enemy.hp = Math.max(0, enemy.hp - dmg);
  ctx.out.push({ t: 'heroAttack', dmg, crit, miss, targetHp: enemy.hp, targetMaxHp: enemy.maxHp });

  if (!split.done && enemy.splitAt > 0 && enemy.hp > 0 && enemy.hp <= enemy.maxHp * enemy.splitAt) {
    split.done = true;
    enemy.hp = Math.round(enemy.maxHp * enemy.splitAt);
    ctx.out.push({ t: 'monsterSplit', monsterId: enemy.id, hp: enemy.hp, maxHp: enemy.maxHp });
  }
}

export function fight(ctx: Ctx, enemy: Enemy): { heroDied: boolean; enemyDied: boolean } {
  const split = { done: enemy.splitAt <= 0 };
  let panicked = false;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const tickKill = tickStatusDamage(ctx.hero, ctx.out);
    if (ctx.hero.hp <= 0) {
      ctx.killedByTag = tickKill || ctx.killedByTag;
      return { heroDied: true, enemyDied: false };
    }

    if (ctx.def.regen > 0 && !traitBlocked(ctx.hero, 'regen')) heal(ctx.hero, ctx.hero.maxHp * ctx.def.regen, ctx.out);
    tryAbility(ctx.hero, ctx.def, ctx.out);

    const enemyActs = round % enemy.cadence === enemy.cadence - 1;

    if (enemy.strikesFirst && enemyActs) {
      enemyTurn(ctx, enemy);
      if (ctx.hero.hp <= 0) return { heroDied: true, enemyDied: false };
    }

    heroTurn(ctx, enemy, round, split);
    if (enemy.hp <= 0) {
      if (enemy.source === 'monster') ctx.out.push({ t: 'monsterDown', monsterId: enemy.id });
      return { heroDied: false, enemyDied: true };
    }

    if (!enemy.strikesFirst) {
      if (enemyActs) enemyTurn(ctx, enemy);
      else ctx.out.push({ t: 'enemyWindup', ranged: enemy.ranged });
      if (ctx.hero.hp <= 0) return { heroDied: true, enemyDied: false };
    }

    if (!panicked && hpPct(ctx.hero) <= 0.3) {
      panicked = true;
      ctx.out.push({ t: 'reaction', kind: 'panic' });
    }
  }

  return { heroDied: false, enemyDied: false };
}
