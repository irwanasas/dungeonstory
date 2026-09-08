import type {
  Dungeon,
  HeroDef,
  HeroInstance,
  HeroRecord,
  MonsterDef,
  Outcome,
  RaidEvent,
  RaidResult,
  StatusKind,
  Tag,
  WorldModifiers
} from '../types';
import { EDITABLE_ROOMS } from '../types';
import { heroDef } from '../content/heroes';
import { monsterDef, LORD } from '../content/monsters';
import { lordWeapon, type LordWeapon } from '../content/lordWeapons';
import { trapDef } from '../content/traps';
import { treasureDef } from '../content/treasure';
import { raidRewards } from '../state/economy';
import { noWorld } from '../state/world';
import {
  advanceStatuses,
  atkMultOf,
  buildHero,
  defMultOf,
  heal,
  resolveHit,
  snapshot,
  tickStatusDamage,
  traitBlocked
} from './hero';
import { decideDisarm, decideLoot, fleeNote, hpPct, lootNote, tryAbility, wantsToFlee } from './ai';
import { systemRng, type Rng } from './rng';

const MAX_ROUNDS = 20;

interface Enemy {
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
  applies: { kind: StatusKind; rooms: number } | null;
  source: 'monster' | 'lord';
}

function monsterEnemy(def: MonsterDef, level: number, world: WorldModifiers): Enemy {
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

function lordEnemy(weapon: LordWeapon, level: number, world: WorldModifiers): Enemy {
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

interface Ctx {
  hero: HeroInstance;
  def: HeroDef;
  rng: Rng;
  out: RaidEvent[];
  killedByTag: Tag | null;
  world: WorldModifiers;
}

function tagMult(world: WorldModifiers, tag: Tag): number {
  return world.tagDamage[tag] || 1;
}

function enemyTurn(ctx: Ctx, enemy: Enemy): void {
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

function heroTurn(ctx: Ctx, enemy: Enemy, round: number, split: { done: boolean }): void {
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

function fight(ctx: Ctx, enemy: Enemy): { heroDied: boolean; enemyDied: boolean } {
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

export interface RaidOptions {
  rng?: Rng;
  collectEvents?: boolean;
  world?: WorldModifiers;
}

export function simulateRaid(dungeon: Dungeon, record: HeroRecord, tier: number, options: RaidOptions = {}): RaidResult {
  const rng = options.rng || systemRng;
  const collect = options.collectEvents !== false;
  const world = options.world || noWorld();
  const hero = buildHero(record, world);
  const def = heroDef(record.defId);
  const events: RaidEvent[] = [];
  const ctx: Ctx = { hero, def, rng, out: events, killedByTag: null, world };

  const start = snapshot(hero);
  events.push({ t: 'raidStart', hero: start });

  let outcome: Outcome = 'heroVictory';
  let roomsEntered = 0;
  let fled = false;
  let died = false;

  for (let i = 0; i < EDITABLE_ROOMS; i++) {
    const built = dungeon.rooms[i] || { slot: { kind: 'empty' as const }, level: 1 };
    const slot = built.slot;
    const contentId = slot.kind === 'empty' ? null : slot.id;

    if (wantsToFlee(hero, def, rng)) {
      events.push({ t: 'decision', intent: 'flee', note: fleeNote(hero, def) });
      events.push({ t: 'heroFlee', fromRoom: i });
      events.push({ t: 'reaction', kind: 'panic' });
      fled = true;
      break;
    }

    roomsEntered += 1;
    events.push({ t: 'enterRoom', room: i, kind: slot.kind, contentId });
    events.push({ t: 'doorOpen', room: i });

    if (slot.kind === 'monster') {
      const md = monsterDef(slot.id);
      const enemy = monsterEnemy(md, built.level, world);
      events.push({ t: 'monsterAppear', monsterId: md.id, hp: enemy.hp, maxHp: enemy.maxHp });
      events.push({ t: 'reaction', kind: 'surprise' });
      const res = fight(ctx, enemy);
      if (res.heroDied) {
        died = true;
        break;
      }
    } else {
      const tickKill = tickStatusDamage(hero, events);
      if (hero.hp <= 0) {
        ctx.killedByTag = tickKill || ctx.killedByTag;
        died = true;
        break;
      }

      if (slot.kind === 'trap') {
        const td = trapDef(slot.id);
        if (decideDisarm(hero, def, rng)) {
          events.push({ t: 'decision', intent: 'disarm', note: `${hero.name} spots the ${td.name} and picks it apart.` });
          events.push({ t: 'trapFire', trapId: td.id, disarmed: true });
          events.push({ t: 'reaction', kind: 'relief' });
        } else {
          events.push({ t: 'trapFire', trapId: td.id, disarmed: false });
          const amount = (td.damage + (built.level - 1) * td.dmgPerLevel) * world.trapDamage * tagMult(world, td.tag);
          const res = resolveHit(
            hero,
            def,
            { amount, tag: td.tag, source: 'trap', applies: td.applies },
            rng,
            events
          );
          events.push({ t: 'reaction', kind: res.evaded ? 'surprise' : res.dmg > 0 ? 'pain' : 'surprise' });
          if (hero.hp <= 0) {
            ctx.killedByTag = td.tag;
            died = true;
            break;
          }
        }
      } else if (slot.kind === 'treasure') {
        const vd = treasureDef(slot.id);
        const intent = decideLoot(def, vd, rng);
        events.push({ t: 'decision', intent, note: lootNote(hero, intent === 'loot', vd) });
        if (intent === 'loot') {
          const gold = Math.round(vd.gold + (built.level - 1) * vd.goldPerLevel);
          hero.looted += gold;
          events.push({ t: 'treasureTaken', treasureId: vd.id, gold });
          events.push({ t: 'reaction', kind: 'greed' });
          if (vd.applies) {
            const applied = vd.applies;
            resolveHit(
              hero,
              def,
              { amount: 0, tag: 'arcane', source: 'trap', applies: applied, ignoreEvasion: true },
              rng,
              events
            );
          }
          const lootKill = tickStatusDamage(hero, events);
          if (hero.hp <= 0) {
            ctx.killedByTag = lootKill || ctx.killedByTag;
            died = true;
            break;
          }
        }
      }
    }

    advanceStatuses(hero, events);
    if (hero.hp > 0) events.push({ t: 'roomClear', room: i });
  }

  if (died) {
    events.push({ t: 'reaction', kind: 'dead' });
    events.push({ t: 'heroDown' });
    outcome = 'dungeonWin';
  } else if (fled) {
    outcome = 'heroEscape';
  } else {
    if (wantsToFlee(hero, def, rng)) {
      events.push({ t: 'decision', intent: 'flee', note: `${hero.name} sees the throne doors and turns back.` });
      events.push({ t: 'heroFlee', fromRoom: EDITABLE_ROOMS });
      events.push({ t: 'reaction', kind: 'panic' });
      outcome = 'heroEscape';
    } else {
      roomsEntered += 1;
      const lord = lordEnemy(lordWeapon(dungeon.lordWeaponId), dungeon.lordLevel, world);
      events.push({ t: 'enterRoom', room: EDITABLE_ROOMS, kind: 'throne', contentId: 'lord' });
      events.push({ t: 'doorOpen', room: EDITABLE_ROOMS });
      events.push({ t: 'lordAppear', level: dungeon.lordLevel, hp: lord.hp, maxHp: lord.maxHp });
      events.push({ t: 'reaction', kind: 'surprise' });

      const res = fight(ctx, lord);
      if (res.heroDied) {
        events.push({ t: 'reaction', kind: 'dead' });
        events.push({ t: 'heroDown' });
        outcome = 'dungeonWin';
      } else if (res.enemyDied) {
        outcome = 'heroVictory';
      } else {
        events.push({ t: 'heroFlee', fromRoom: EDITABLE_ROOMS });
        outcome = 'heroEscape';
      }
    }
  }

  const survived = outcome !== 'dungeonWin';
  const base = raidRewards(outcome, roomsEntered, tier, world);
  const goldStolen = survived ? hero.looted : 0;
  const gold = Math.max(0, base.gold - goldStolen);

  events.push({ t: 'raidEnd', outcome, gold, souls: base.souls, goldStolen });

  return {
    events: collect ? events : [],
    outcome,
    gold,
    souls: base.souls,
    goldStolen,
    roomsCleared: roomsEntered,
    hero: start,
    killedByTag: ctx.killedByTag,
    survived
  };
}
