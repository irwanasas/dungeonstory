import type {
  BuiltRoom,
  HeroDef,
  HeroInstance,
  MonsterRuntime,
  MonsterUnit,
  RaidEvent,
  StatusKind,
  Tag,
  WorldModifiers
} from '../types';
import { EDITABLE_ROOMS } from '../types';
import { monsterDef } from '../content/monsters';
import { lordWeapon } from '../content/lordWeapons';
import { trapDef } from '../content/traps';
import { treasureDef } from '../content/treasure';
import { resolveHit, tickStatusDamage } from './hero';
import { decideDisarm, decideLoot, lootNote } from './ai';
import { fight, lordEnemy, monsterEnemy, tagMult, type Ctx, type Enemy } from './combat';
import type { Rng } from './rng';

export interface CombatMember {
  hero: HeroInstance;
  def: HeroDef;
}

export interface ProcOffer {
  trapId: string;
  kind: StatusKind;
  memberIndex: number;
}

export interface CheckpointInput {
  roomIndex: number;
  built: BuiltRoom;
  isThrone: boolean;
  party: CombatMember[];
  runtime: MonsterRuntime | null;
  world: WorldModifiers;
  rng: Rng;
  lord: { level: number; weaponId: string } | null;
  killedByTag: Tag | null;
}

export interface CheckpointResult {
  events: RaidEvent[];
  cleared: boolean;
  wiped: boolean;
  fled: boolean;
  stalled: boolean;
  runtime: MonsterRuntime | null;
  killedByTag: Tag | null;
  looted: number;
  procs: ProcOffer[];
}

function seedUnit(enemy: Enemy, unit: MonsterUnit | undefined): void {
  if (!unit || unit.hp === null) return;
  enemy.hp = Math.min(enemy.maxHp, Math.max(0, unit.hp));
}

function writeBack(runtime: MonsterRuntime | null, enemy: Enemy): MonsterRuntime | null {
  if (!runtime) return null;
  const units = runtime.units.slice();
  const prev = units[0] || { hp: null, status: [], dead: false };
  units[0] = { ...prev, hp: enemy.hp, dead: enemy.hp <= 0 };
  return { ...runtime, units };
}

export function runCheckpoint(input: CheckpointInput): CheckpointResult {
  const { built, isThrone, party, world, rng } = input;
  const out: RaidEvent[] = [];
  const member = party[0];
  const hero = member.hero;
  const def = member.def;
  const ctx: Ctx = { hero, def, rng, out, killedByTag: input.killedByTag, world };

  const result: CheckpointResult = {
    events: out,
    cleared: false,
    wiped: false,
    fled: false,
    stalled: false,
    runtime: input.runtime,
    killedByTag: input.killedByTag,
    looted: 0,
    procs: []
  };

  if (isThrone) {
    const spec = input.lord;
    const lord = lordEnemy(lordWeapon(spec ? spec.weaponId : ''), spec ? spec.level : 1, world);
    out.push({ t: 'enterRoom', room: EDITABLE_ROOMS, kind: 'throne', contentId: 'lord' });
    out.push({ t: 'doorOpen', room: EDITABLE_ROOMS });
    out.push({ t: 'lordAppear', level: spec ? spec.level : 1, hp: lord.hp, maxHp: lord.maxHp });
    out.push({ t: 'reaction', kind: 'surprise' });

    const res = fight(ctx, lord);
    result.killedByTag = ctx.killedByTag;
    result.wiped = res.heroDied;
    result.cleared = res.enemyDied;
    result.stalled = !res.heroDied && !res.enemyDied;
    return result;
  }

  const slot = built.slot;
  const contentId = slot.kind === 'empty' ? null : slot.id;
  const room = input.roomIndex;

  out.push({ t: 'enterRoom', room, kind: slot.kind, contentId });
  out.push({ t: 'doorOpen', room });

  if (slot.kind === 'monster') {
    const md = monsterDef(slot.id);
    const enemy = monsterEnemy(md, built.level, world);
    seedUnit(enemy, input.runtime ? input.runtime.units[0] : undefined);
    out.push({ t: 'monsterAppear', monsterId: md.id, hp: enemy.hp, maxHp: enemy.maxHp });
    out.push({ t: 'reaction', kind: 'surprise' });
    const res = fight(ctx, enemy);
    result.killedByTag = ctx.killedByTag;
    result.runtime = writeBack(input.runtime, enemy);
    result.wiped = res.heroDied;
    result.cleared = !res.heroDied;
    result.stalled = !res.heroDied && !res.enemyDied;
    return result;
  }

  const tickKill = tickStatusDamage(hero, out);
  if (hero.hp <= 0) {
    result.killedByTag = tickKill || ctx.killedByTag;
    result.wiped = true;
    return result;
  }

  if (slot.kind === 'trap') {
    const td = trapDef(slot.id);
    if (decideDisarm(hero, def, rng)) {
      out.push({ t: 'decision', intent: 'disarm', note: `${hero.name} spots the ${td.name} and picks it apart.` });
      out.push({ t: 'trapFire', trapId: td.id, disarmed: true });
      out.push({ t: 'reaction', kind: 'relief' });
    } else {
      out.push({ t: 'trapFire', trapId: td.id, disarmed: false });
      const amount = (td.damage + (built.level - 1) * td.dmgPerLevel) * world.trapDamage * tagMult(world, td.tag);
      const res = resolveHit(hero, def, { amount, tag: td.tag, source: 'trap', applies: td.applies }, rng, out);
      out.push({ t: 'reaction', kind: res.evaded ? 'surprise' : res.dmg > 0 ? 'pain' : 'surprise' });
      if (hero.hp <= 0) {
        result.killedByTag = td.tag;
        result.wiped = true;
        return result;
      }
    }
  } else if (slot.kind === 'treasure') {
    const vd = treasureDef(slot.id);
    const intent = decideLoot(def, vd, rng);
    out.push({ t: 'decision', intent, note: lootNote(hero, intent === 'loot', vd) });
    if (intent === 'loot') {
      const gold = Math.round(vd.gold + (built.level - 1) * vd.goldPerLevel);
      hero.looted += gold;
      result.looted = gold;
      out.push({ t: 'treasureTaken', treasureId: vd.id, gold });
      out.push({ t: 'reaction', kind: 'greed' });
      if (vd.applies) {
        resolveHit(
          hero,
          def,
          { amount: 0, tag: 'arcane', source: 'trap', applies: vd.applies, ignoreEvasion: true },
          rng,
          out
        );
      }
      const lootKill = tickStatusDamage(hero, out);
      if (hero.hp <= 0) {
        result.killedByTag = lootKill || ctx.killedByTag;
        result.wiped = true;
        return result;
      }
    }
  }

  result.cleared = true;
  return result;
}
