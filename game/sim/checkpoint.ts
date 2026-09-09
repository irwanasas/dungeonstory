import type {
  BuiltRoom,
  HeroDef,
  HeroInstance,
  MonsterDef,
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
import { statusDef } from '../content/statuses';
import { decideDisarm, decideLoot, lootNote } from './ai';
import {
  fightGroup,
  lordEnemy,
  monsterEnemy,
  tagMult,
  toFoe,
  type Combatant,
  type Foe,
  type PartyCtx
} from './combat';
import type { Rng } from './rng';

export interface CombatMember {
  hero: HeroInstance;
  def: HeroDef;
}

export interface ProcOffer {
  trapId: string;
  kind: StatusKind;
  uid: string;
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
  foeCap?: number;
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

function buildFoes(
  def: MonsterDef,
  level: number,
  world: WorldModifiers,
  runtime: MonsterRuntime | null,
  count: number
): Foe[] {
  const foes: Foe[] = [];
  for (let i = 0; i < count; i++) {
    const unit = runtime ? runtime.units[i] : undefined;
    if (unit && unit.dead) continue;
    const enemy = monsterEnemy(def, level, world);
    if (unit && unit.hp !== null) enemy.hp = Math.min(enemy.maxHp, Math.max(0, unit.hp));
    foes.push(toFoe(enemy, i, unit ? unit.status.map((s) => ({ ...s })) : []));
  }
  return foes;
}

function writeBack(runtime: MonsterRuntime | null, foes: Foe[], count: number): MonsterRuntime | null {
  if (!runtime) return null;
  const units: MonsterUnit[] = [];
  for (let i = 0; i < count; i++) {
    const foe = foes.find((f) => f.slot === i);
    const prev = runtime.units[i];
    if (!foe) {
      units.push(prev || { hp: null, status: [], dead: true });
      continue;
    }
    units.push({ hp: foe.hp, status: foe.status, dead: foe.hp <= 0 });
  }
  return { ...runtime, units };
}

export function runCheckpoint(input: CheckpointInput): CheckpointResult {
  const { built, isThrone, party, world, rng } = input;
  const out: RaidEvent[] = [];
  const members: Combatant[] = party.map((m) => ({ hero: m.hero, def: m.def, killedByTag: input.killedByTag }));
  const ctx: PartyCtx = { members, rng, out, world };
  const multi = members.length > 1;
  const living = () => members.filter((m) => m.hero.hp > 0);

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

  const firstKill = () => members.find((m) => m.hero.hp <= 0 && m.killedByTag)?.killedByTag || input.killedByTag;
  const setActor = (i: number) => {
    if (!multi) return;
    out.push({ t: 'actor', index: i, name: members[i].hero.name, defId: members[i].hero.defId });
  };
  const reportDown = (i: number) => {
    if (!multi || members[i].hero.hp > 0) return;
    out.push({ t: 'reaction', kind: 'dead' });
    out.push({ t: 'heroDown' });
  };

  if (isThrone) {
    const spec = input.lord;
    const lord = lordEnemy(lordWeapon(spec ? spec.weaponId : ''), spec ? spec.level : 1, world);
    out.push({ t: 'enterRoom', room: EDITABLE_ROOMS, kind: 'throne', contentId: 'lord' });
    out.push({ t: 'doorOpen', room: EDITABLE_ROOMS });
    out.push({ t: 'lordAppear', level: spec ? spec.level : 1, hp: lord.hp, maxHp: lord.maxHp });
    out.push({ t: 'reaction', kind: 'surprise' });

    const res = fightGroup(ctx, [toFoe(lord, 0)]);
    result.killedByTag = firstKill();
    result.wiped = res.wiped;
    result.cleared = res.foesDead;
    result.stalled = res.stalled;
    return result;
  }

  const slot = built.slot;
  const contentId = slot.kind === 'empty' ? null : slot.id;
  const room = input.roomIndex;

  out.push({ t: 'enterRoom', room, kind: slot.kind, contentId });
  out.push({ t: 'doorOpen', room });

  if (slot.kind === 'monster') {
    const md = monsterDef(slot.id);
    const count = Math.max(1, Math.min(md.count, input.foeCap === undefined ? md.count : input.foeCap));
    const foes = buildFoes(md, built.level, world, input.runtime, count);
    if (foes.length === 0) {
      result.cleared = true;
      result.runtime = input.runtime;
      return result;
    }
    for (const foe of foes) {
      out.push({
        t: 'monsterAppear',
        monsterId: md.id,
        hp: foe.hp,
        maxHp: foe.maxHp,
        ...(foes.length > 1 ? { slot: foe.slot } : {})
      });
    }
    out.push({ t: 'reaction', kind: 'surprise' });
    const res = fightGroup(ctx, foes);
    result.killedByTag = firstKill();
    result.runtime = writeBack(input.runtime, foes, count);
    result.wiped = res.wiped;
    result.cleared = !res.wiped && res.foesDead;
    result.stalled = res.stalled;
    return result;
  }

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (m.hero.hp <= 0) continue;
    setActor(i);
    const tickKill = tickStatusDamage(m.hero, out);
    if (m.hero.hp <= 0) m.killedByTag = tickKill || m.killedByTag;
    reportDown(i);
  }
  if (living().length === 0) {
    result.killedByTag = firstKill();
    result.wiped = true;
    return result;
  }

  if (slot.kind === 'trap') {
    const td = trapDef(slot.id);
    const disarmer = members.findIndex((m) => m.hero.hp > 0 && decideDisarm(m.hero, m.def, rng));
    if (disarmer >= 0) {
      const m = members[disarmer];
      setActor(disarmer);
      out.push({ t: 'decision', intent: 'disarm', note: `${m.hero.name} spots the ${td.name} and picks it apart.` });
      out.push({ t: 'trapFire', trapId: td.id, disarmed: true });
      out.push({ t: 'reaction', kind: 'relief' });
    } else {
      out.push({ t: 'trapFire', trapId: td.id, disarmed: false });
      const amount = (td.damage + (built.level - 1) * td.dmgPerLevel) * world.trapDamage * tagMult(world, td.tag);
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (m.hero.hp <= 0) continue;
        setActor(i);
        const res = resolveHit(m.hero, m.def, { amount, tag: td.tag, source: 'trap', applies: td.applies }, rng, out);
        out.push({ t: 'reaction', kind: res.evaded ? 'surprise' : res.dmg > 0 ? 'pain' : 'surprise' });
        if (m.hero.hp <= 0) m.killedByTag = td.tag;
        else if (!res.interaction && res.applied && statusDef(res.applied).dmgPerTick > 0) {
          result.procs.push({ trapId: td.id, kind: res.applied, uid: m.hero.uid });
        }
        reportDown(i);
      }
      if (living().length === 0) {
        result.killedByTag = firstKill();
        result.wiped = true;
        return result;
      }
    }
  } else if (slot.kind === 'treasure') {
    const vd = treasureDef(slot.id);
    const lead = members.findIndex((m) => m.hero.hp > 0);
    const m = members[lead];
    const intent = decideLoot(m.def, vd, rng);
    setActor(lead);
    out.push({ t: 'decision', intent, note: lootNote(m.hero, intent === 'loot', vd) });
    if (intent === 'loot') {
      const gold = Math.round(vd.gold + (built.level - 1) * vd.goldPerLevel);
      m.hero.looted += gold;
      result.looted = gold;
      out.push({ t: 'treasureTaken', treasureId: vd.id, gold });
      out.push({ t: 'reaction', kind: 'greed' });
      if (vd.applies) {
        for (let i = 0; i < members.length; i++) {
          const target = members[i];
          if (target.hero.hp <= 0) continue;
          setActor(i);
          resolveHit(
            target.hero,
            target.def,
            { amount: 0, tag: 'arcane', source: 'trap', applies: vd.applies, ignoreEvasion: true },
            rng,
            out
          );
        }
      }
      for (let i = 0; i < members.length; i++) {
        const target = members[i];
        if (target.hero.hp <= 0) continue;
        setActor(i);
        const lootKill = tickStatusDamage(target.hero, out);
        if (target.hero.hp <= 0) target.killedByTag = lootKill || target.killedByTag;
        reportDown(i);
      }
      if (living().length === 0) {
        result.killedByTag = firstKill();
        result.wiped = true;
        return result;
      }
    }
  }

  result.cleared = true;
  return result;
}
