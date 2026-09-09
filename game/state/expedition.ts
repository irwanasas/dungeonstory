import type {
  ActiveStatus,
  DayEvent,
  DayEventOption,
  Dungeon,
  ExpTier,
  HeroInstance,
  HeroRecord,
  MonsterRuntime,
  MonsterUnit,
  Outcome,
  RaidEvent,
  RaidResult,
  StatusKind,
  Tag,
  WorldEffect,
  WorldEvent,
  WorldModifiers,
  WorldState
} from '../types';
import { CHECKPOINTS, EDITABLE_ROOMS, FAME_MAX } from '../types';
import { DAY_EVENTS, dayEvent, procFlavour } from '../content/dayEvents';
import { INTERACTIONS } from '../content/interactions';
import { MONSTERS, monsterDef } from '../content/monsters';
import { trapDef } from '../content/traps';
import { lordWeapon } from '../content/lordWeapons';
import { HEROES, heroDef } from '../content/heroes';
import { STAGE_MAX, stageDef, tierOf } from '../content/stages';
import { makeName } from '../content/names';
import { legacyFrom, trophiesFrom } from '../content/milestones';
import { challengeSouls, challengesFrom } from '../content/challenges';
import {
  advanceStatusList,
  applyStatus,
  applyStatusToUnit,
  buildHero,
  clearCombatScoped,
  heal,
  snapshot,
  tickStatusDamage
} from '../sim/hero';
import { fleeNote, wantsToFlee } from '../sim/ai';
import { runCheckpoint, type ProcOffer } from '../sim/checkpoint';
import { seeded, type Rng } from '../sim/rng';
import { checkpointReward, toDungeon } from './economy';
import { absorbResult } from './roster';
import { composeModifiers, activeEffects, tickWorld, EXPEDITION_CLAMP } from './world';
import type { GameState } from './save';

export const EXPEDITION_SHAPE = 3;

const GAP: Record<ExpTier, number> = { early: 3, mid: 4, late: 5 };

export interface ExpeditionSetup {
  tier: ExpTier;
  gap: number;
  totalDays: number;
  checkpointDays: number[];
  dungeon: Dungeon;
  stage: number;
  tierScale: number;
  guardianId: string;
  arthurDefId: string;
  pool: string[];
}

export interface PartyMember {
  hero: HeroInstance;
  record: HeroRecord;
  killedByTag: Tag | null;
  wave: number;
  alive: boolean;
  fled: boolean;
}

export interface ExpModifier {
  id: string;
  source: 'choice' | 'altar' | 'knowledge';
  label: string;
  daysLeft: number;
  effect: WorldEffect;
}

export interface PendingChoice {
  eventId: string;
  kind: 'choice' | 'altar' | 'ecosystem' | 'proc';
  title: string;
  body: string;
  options: { id: string; label: string; hint: string }[];
  proc?: { kind: StatusKind; uid: string; trapId: string };
}

export interface ExpLogEntry {
  day: number;
  kind: string;
  text: string;
}

export interface ExpeditionState {
  shape: number;
  seed: number;
  setup: ExpeditionSetup;
  day: number;
  checkpoint: number;
  status: 'active' | 'complete';
  pending: PendingChoice | null;
  dayTitle: string;
  dayBody: string;
  party: PartyMember[];
  waveIndex: number;
  backupPending: boolean;
  monsters: (MonsterRuntime | null)[];
  mods: ExpModifier[];
  aura: ExpModifier | null;
  knowledge: Partial<Record<Tag, number>>;
  decay: Partial<Record<string, number>>;
  log: ExpLogEntry[];
  record: RaidEvent[];
  totals: { gold: number; souls: number; goldStolen: number; checkpointsCleared: number; wavesLost: number };
  outcome: Outcome | null;
}

export interface DayOutcome {
  exp: ExpeditionState;
  events: RaidEvent[];
}

const KEPT_EVENTS = new Set(['interaction', 'monsterSplit', 'trapFire', 'monsterDown', 'treasureTaken']);

function dayRng(exp: ExpeditionState, salt: number): Rng {
  return seeded((exp.seed ^ Math.imul(exp.day + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0);
}

export function expeditionEffects(exp: ExpeditionState): WorldEffect[] {
  const out = exp.mods.map((m) => m.effect);
  if (exp.aura) out.push(exp.aura.effect);
  for (const [tag, stacks] of Object.entries(exp.knowledge)) {
    const n = stacks as number;
    if (n > 0) out.push({ tagDamage: { [tag as Tag]: Math.max(0.7, 1 - n * 0.1) } });
  }
  return out;
}

function modifiersFor(exp: ExpeditionState, world: WorldState): WorldModifiers {
  return composeModifiers([...activeEffects(world), ...expeditionEffects(exp)], EXPEDITION_CLAMP);
}

function roomRuntime(dungeon: Dungeon): (MonsterRuntime | null)[] {
  const out: (MonsterRuntime | null)[] = [];
  for (let i = 0; i <= EDITABLE_ROOMS; i++) {
    const built = dungeon.rooms[i];
    if (!built || built.slot.kind !== 'monster') {
      out.push(null);
      continue;
    }
    const count = Math.max(1, monsterDef(built.slot.id).count);
    const units: MonsterUnit[] = [];
    for (let i = 0; i < count; i++) units.push({ hp: null, status: [], dead: false });
    out.push({ id: built.slot.id, units });
  }
  return out;
}

function makeMember(record: HeroRecord, world: WorldModifiers, wave: number): PartyMember {
  return { hero: buildHero(record, world), record, killedByTag: null, wave, alive: true, fled: false };
}

export const WAVE_SIZE = 3;

function rollWave(
  pool: string[],
  level: number,
  uidBase: string,
  wave: number,
  world: WorldModifiers,
  rng: Rng,
  lead?: HeroRecord
): PartyMember[] {
  const from = pool.length > 0 ? pool : HEROES.map((h) => h.id);
  const out: PartyMember[] = [];
  const taken: string[] = [];
  if (lead) {
    out.push(makeMember({ ...lead, level: Math.max(lead.level, level) }, world, wave));
    taken.push(lead.defId);
  }
  while (out.length < WAVE_SIZE) {
    const fresh = from.filter((id) => !taken.includes(id));
    const draw = fresh.length > 0 ? fresh : from;
    const defId = draw[Math.floor(rng() * draw.length) % draw.length];
    taken.push(defId);
    const def = heroDef(defId);
    out.push(
      makeMember(
        {
          uid: `${uidBase}w${wave}m${out.length}`,
          defId,
          name: makeName(defId, rng).name,
          title: def.role,
          level,
          raids: 0,
          deaths: 0,
          scars: []
        },
        world,
        wave
      )
    );
  }
  return out;
}

export function beginExpedition(state: GameState, record: HeroRecord, rng: Rng): ExpeditionState {
  const stage = stageDef(state.stage);
  const tier = tierOf(state.stage);
  const gap = GAP[tier];
  const totalDays = gap * CHECKPOINTS;
  const checkpointDays: number[] = [];
  for (let i = 1; i <= CHECKPOINTS; i++) checkpointDays.push(gap * i);

  const dungeon: Dungeon = { ...toDungeon(state), lordLevel: Math.max(state.lordLevel, stage.lordLevel) };
  const level = Math.max(record.level, stage.heroLevel);
  const world = composeModifiers(activeEffects(state.world), EXPEDITION_CLAMP);
  const seed = Math.floor(rng() * 0xffffffff) >>> 0;
  const seedBase = 'exp' + seed.toString(36);

  return {
    shape: EXPEDITION_SHAPE,
    seed,
    setup: {
      tier,
      gap,
      totalDays,
      checkpointDays,
      dungeon,
      stage: state.stage,
      tierScale: state.stage,
      guardianId: MONSTERS[Math.floor(rng() * MONSTERS.length) % MONSTERS.length].id,
      arthurDefId: HEROES[Math.floor(rng() * HEROES.length) % HEROES.length].id,
      pool: stage.heroPool
    },
    day: 1,
    checkpoint: 0,
    status: 'active',
    pending: null,
    dayTitle: 'The Road Begins',
    dayBody: `A party of ${WAVE_SIZE} sets out for your gate, ${record.name} at the front. ${totalDays} days of road lie between.`,
    party: rollWave(stage.heroPool, level, seedBase, 1, world, rng, record),
    waveIndex: 1,
    backupPending: false,
    monsters: roomRuntime(dungeon),
    mods: [],
    aura: null,
    knowledge: {},
    decay: {},
    log: [],
    record: [],
    totals: { gold: 0, souls: 0, goldStolen: 0, checkpointsCleared: 0, wavesLost: 0 },
    outcome: null
  };
}

export function endExpedition(
  state: GameState,
  exp: ExpeditionState,
  rng: Rng
): { state: GameState; fired: WorldEvent | null } {
  const outcome = exp.outcome || 'dungeonWin';
  const turned = tickWorld(state.world, exp.setup.stage, rng);
  const gold = Math.max(0, exp.totals.gold - exp.totals.goldStolen);
  const synthetic: RaidResult = {
    events: exp.record,
    outcome,
    gold,
    souls: exp.totals.souls,
    goldStolen: exp.totals.goldStolen,
    roomsCleared: exp.totals.checkpointsCleared,
    hero: snapshot(exp.party[0].hero),
    killedByTag: exp.party[0].killedByTag,
    survived: outcome !== 'dungeonWin'
  };

  let roster = state.roster;
  for (const m of exp.party) {
    roster = absorbResult(roster, m.record, { survived: m.alive || m.fled, killedByTag: m.killedByTag });
  }

  const earned = [...trophiesFrom(exp.record), ...challengesFrom(exp.setup.dungeon, exp.setup.stage, synthetic)].filter(
    (id) => !state.unlockedMilestones.includes(id)
  );

  const hero = roster[0];
  const fame = hero
    ? legacyFrom(hero, synthetic)
        .filter((id) => !state.hallOfFame.some((e) => e.uid === hero.uid && e.milestoneId === id))
        .map((id) => ({
          uid: hero.uid,
          heroName: hero.name,
          title: hero.title,
          milestoneId: id,
          achievedAt: Date.now()
        }))
    : [];

  const next: GameState = {
    ...state,
    expedition: null,
    world: turned.world,
    gold: state.gold + gold,
    souls: state.souls + exp.totals.souls + challengeSouls(earned),
    roster,
    unlockedMilestones: [...state.unlockedMilestones, ...earned],
    hallOfFame: [...fame, ...state.hallOfFame].slice(0, FAME_MAX),
    stats: {
      ...state.stats,
      raids: state.stats.raids + 1,
      defeated: state.stats.defeated + (outcome === 'dungeonWin' ? 1 : 0),
      escaped: state.stats.escaped + (outcome === 'heroEscape' ? 1 : 0),
      lost: state.stats.lost + (outcome === 'heroVictory' ? 1 : 0),
      goldEarned: state.stats.goldEarned + gold,
      goldStolen: state.stats.goldStolen + exp.totals.goldStolen
    }
  };

  if (outcome !== 'heroVictory') {
    next.maxStageCleared = Math.max(state.maxStageCleared, state.stage);
    if (state.stage < STAGE_MAX) next.stage = state.stage + 1;
  }

  return { state: next, fired: turned.fired };
}

export function normalizeExpedition(input: unknown): ExpeditionState | null {
  if (!input || typeof input !== 'object') return null;
  const e = input as Partial<ExpeditionState>;
  const setup = e.setup;
  if (e.shape !== EXPEDITION_SHAPE) return null;
  if (!setup || typeof setup !== 'object') return null;
  if (!Array.isArray(setup.checkpointDays) || setup.checkpointDays.length !== CHECKPOINTS) return null;
  if (typeof setup.totalDays !== 'number' || setup.totalDays < CHECKPOINTS) return null;
  if (!setup.dungeon || !Array.isArray(setup.dungeon.rooms)) return null;
  if (typeof e.day !== 'number' || e.day < 1 || e.day > setup.totalDays + 1) return null;
  if (!Array.isArray(e.party) || e.party.length === 0) return null;
  if (!Array.isArray(e.monsters) || e.monsters.length !== EDITABLE_ROOMS + 1) return null;
  if (e.status !== 'active' && e.status !== 'complete') return null;
  if (e.pending && (!Array.isArray(e.pending.options) || e.pending.options.length === 0)) return null;
  if (e.pending && e.pending.kind !== 'proc' && !dayEvent(e.pending.eventId)) return null;
  if (e.pending && e.pending.kind === 'proc' && !e.pending.proc) return null;
  for (const m of e.party) {
    if (!m || !m.hero || typeof m.hero.hp !== 'number' || !Array.isArray(m.hero.status)) return null;
  }
  return e as ExpeditionState;
}

export function isCheckpointDay(exp: ExpeditionState): boolean {
  return exp.setup.checkpointDays.includes(exp.day);
}

export function daysToCheckpoint(exp: ExpeditionState): number {
  for (const d of exp.setup.checkpointDays) if (d >= exp.day) return d - exp.day;
  return 0;
}

function livingMembers(exp: ExpeditionState): PartyMember[] {
  return exp.party.filter((m) => m.alive && !m.fled);
}

export function actingMember(exp: ExpeditionState): PartyMember | null {
  return livingMembers(exp)[0] || null;
}

export function activeParty(exp: ExpeditionState): PartyMember[] {
  const wave = Math.max(...exp.party.map((m) => m.wave));
  return livingMembers(exp).filter((m) => m.wave === wave);
}

export function eligibleEvents(exp: ExpeditionState): DayEvent[] {
  const statuses = new Set<string>();
  for (const m of livingMembers(exp)) for (const s of m.hero.status) statuses.add(s.kind);
  return DAY_EVENTS.filter((e) => {
    if (!e.tiers.includes(exp.setup.tier)) return false;
    if (e.requiresStatus && !e.requiresStatus.some((k) => statuses.has(k))) return false;
    return true;
  });
}

const PROXIMITY: Record<number, number> = { 1: 1.5, 2: 0.75 };
const STATUS_BOOST = 2;

function setupStatusesFor(tag: Tag): StatusKind[] {
  return INTERACTIONS.filter((i) => i.incomingTag === tag).map((i) => i.requiresStatus);
}

export function upcomingTag(exp: ExpeditionState): Tag | null {
  const index = exp.checkpoint;
  if (index >= EDITABLE_ROOMS) return lordWeapon(exp.setup.dungeon.lordWeaponId).tag;
  const built = exp.setup.dungeon.rooms[index];
  if (!built) return null;
  if (built.slot.kind === 'trap') return trapDef(built.slot.id).tag;
  if (built.slot.kind === 'monster') return monsterDef(built.slot.id).tag;
  return null;
}

function overlapScore(e: DayEvent, roomTag: Tag | null): number {
  if (!roomTag) return 0;
  const wanted = setupStatusesFor(roomTag);
  let score = 0;
  for (const o of e.options) {
    const app = o.applyStatus;
    if (app && (app.to === 'party' || app.to === 'both') && wanted.includes(app.kind)) score += 1;
  }
  if (e.tags && e.tags.includes(roomTag)) score += 1;
  return score;
}

export interface WeightCtx {
  daysToCheckpoint: number;
  upcoming: Tag | null;
  decay: Partial<Record<string, number>>;
}

export function dayEventWeights(pool: DayEvent[], ctx: WeightCtx): { event: DayEvent; weight: number }[] {
  const prox = PROXIMITY[ctx.daysToCheckpoint] || 0;
  return pool.map((event) => {
    const overlap = prox > 0 ? overlapScore(event, ctx.upcoming) : 0;
    const decayFactor = 1 / (1 + (ctx.decay[event.category] || 0));
    const statusBoost = event.requiresStatus && event.requiresStatus.length > 0 ? STATUS_BOOST : 1;
    return { event, weight: event.weight * (1 + prox * overlap) * decayFactor * statusBoost };
  });
}

export function weightsFor(exp: ExpeditionState, pool = eligibleEvents(exp)): { event: DayEvent; weight: number }[] {
  return dayEventWeights(pool, {
    daysToCheckpoint: daysToCheckpoint(exp),
    upcoming: upcomingTag(exp),
    decay: exp.decay
  });
}

function pickEvent(exp: ExpeditionState, rng: Rng): DayEvent | null {
  const pool = eligibleEvents(exp);
  if (pool.length === 0) return null;
  const recent = exp.log.slice(-4).map((l) => l.kind);
  const fresh = pool.filter((e) => !recent.includes(e.id));
  const weighted = weightsFor(exp, fresh.length > 0 ? fresh : pool).filter((w) => w.weight > 0);
  if (weighted.length === 0) return null;

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng() * total;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.event;
  }
  return weighted[weighted.length - 1].event;
}

function toPending(e: DayEvent): PendingChoice {
  return {
    eventId: e.id,
    kind: e.kind === 'narrative' ? 'choice' : e.kind,
    title: e.title,
    body: e.body,
    options: e.options.map((o) => ({ id: o.id, label: o.label, hint: o.hint }))
  };
}

function applyOption(exp: ExpeditionState, e: DayEvent, option: DayEventOption, out: RaidEvent[]): void {
  if (option.effect) {
    const mod: ExpModifier = {
      id: `${e.id}:${option.id}`,
      source: e.kind === 'altar' ? 'altar' : 'choice',
      label: `${e.title} — ${option.label}`,
      daysLeft: option.days === undefined ? 3 : option.days,
      effect: option.effect
    };
    if (e.kind === 'altar') exp.aura = mod;
    else exp.mods = [...exp.mods.filter((m) => m.id !== mod.id), mod];
  }

  if (option.healPct) {
    for (const m of livingMembers(exp)) heal(m.hero, m.hero.maxHp * option.healPct, out);
  }

  const app = option.applyStatus;
  if (app) {
    if (app.to === 'party' || app.to === 'both') {
      for (const m of livingMembers(exp)) applyStatus(m.hero, app.kind, app.days, heroDef(m.hero.defId), out);
    }
    if (app.to === 'monsters' || app.to === 'both') {
      const except = app.except || [];
      exp.monsters = exp.monsters.map((rt) => {
        if (!rt || except.includes(rt.id)) return rt;
        const units = rt.units.map((u) => {
          const copy: MonsterUnit = { ...u, status: u.status.map((s) => ({ ...s })) };
          applyStatusToUnit(copy, app.kind, app.days, out);
          return copy;
        });
        return { ...rt, units };
      });
    }
  }
}

function decayMods(exp: ExpeditionState): void {
  exp.mods = exp.mods.filter((m) => {
    if (m.daysLeft < 0) return true;
    m.daysLeft -= 1;
    return m.daysLeft > 0;
  });
  for (const key of Object.keys(exp.decay)) {
    const next = Math.max(0, (exp.decay[key] || 0) - 0.34);
    if (next === 0) delete exp.decay[key];
    else exp.decay[key] = next;
  }
}

function advanceAll(exp: ExpeditionState, out: RaidEvent[]): void {
  for (const m of exp.party) {
    if (!m.alive || m.fled) continue;
    const { kept, expired } = advanceStatusList(m.hero.status);
    m.hero.status = kept;
    for (const kind of expired) out.push({ t: 'statusOff', kind });
  }
  exp.monsters = exp.monsters.map((rt) => {
    if (!rt) return rt;
    const units = rt.units.map((u) => {
      const { kept } = advanceStatusList(u.status);
      return { ...u, status: kept as ActiveStatus[] };
    });
    return { ...rt, units };
  });
}

function callBackup(exp: ExpeditionState, world: WorldModifiers, rng: Rng, out: RaidEvent[]): void {
  exp.totals.wavesLost += 1;
  out.push({ t: 'waveWipe', wave: exp.waveIndex });
  exp.waveIndex += 1;
  exp.party = [
    ...exp.party,
    ...rollWave(
      exp.setup.pool,
      stageDef(exp.setup.stage).heroLevel,
      'exp' + exp.seed.toString(36),
      exp.waveIndex,
      world,
      rng
    )
  ];
  exp.backupPending = true;
}

function finish(exp: ExpeditionState, outcome: Outcome): void {
  exp.status = 'complete';
  exp.outcome = outcome;
}

export function advanceDay(exp: ExpeditionState, world: WorldState): DayOutcome {
  if (exp.status !== 'active' || exp.pending !== null) return { exp, events: [] };

  const next: ExpeditionState = {
    ...exp,
    party: exp.party.map((m) => ({ ...m, hero: { ...m.hero, status: m.hero.status.map((s) => ({ ...s })) } })),
    mods: exp.mods.map((m) => ({ ...m })),
    monsters: exp.monsters.map((r) => (r ? { ...r, units: r.units.map((u) => ({ ...u })) } : r)),
    knowledge: { ...exp.knowledge },
    decay: { ...exp.decay },
    log: exp.log.slice(),
    record: exp.record.slice(),
    totals: { ...exp.totals }
  };

  const out: RaidEvent[] = [];
  decayMods(next);
  const mods = modifiersFor(next, world);

  if (isCheckpointDay(next)) {
    resolveCheckpoint(next, mods, out);
  } else {
    resolveDayEvent(next, out);
  }

  if (!isCheckpointDay(next)) {
    const wave = activeParty(next);
    let lastTag: Tag | null = null;
    for (const m of wave) {
      const kill = tickStatusDamage(m.hero, out);
      if (m.hero.hp <= 0) {
        m.alive = false;
        m.killedByTag = kill || m.killedByTag;
        lastTag = m.killedByTag;
        next.log.push({ day: next.day, kind: 'death', text: `${m.hero.name} dies on the road.` });
      }
    }
    if (wave.length > 0 && activeParty(next).length === 0) {
      if (lastTag) next.knowledge[lastTag] = (next.knowledge[lastTag] || 0) + 1;
      callBackup(next, mods, dayRng(next, 21), out);
    }
  }

  advanceAll(next, out);

  for (const e of out) if (KEPT_EVENTS.has(e.t)) next.record.push(e);

  if (next.status === 'active') {
    if (next.day >= next.setup.totalDays) {
      const withdrew = next.party.some((m) => m.alive || m.fled);
      finish(next, withdrew ? 'heroEscape' : 'dungeonWin');
    } else next.day += 1;
  }

  return { exp: next, events: out };
}

function queueProc(exp: ExpeditionState, procs: ProcOffer[]): void {
  if (exp.pending || procs.length === 0) return;
  const offer = procs.find((o) => {
    const m = exp.party.find((x) => x.hero.uid === o.uid);
    return m && m.hero.hp > 0 && m.hero.status.some((s) => s.kind === o.kind);
  });
  if (!offer) return;
  const f = procFlavour(offer.trapId);
  exp.pending = {
    eventId: 'proc:' + offer.trapId,
    kind: 'proc',
    title: f.title,
    body: f.body,
    options: [
      { id: 'amp', label: f.amp.label, hint: f.amp.hint },
      { id: 'longer', label: f.longer.label, hint: f.longer.hint }
    ],
    proc: { kind: offer.kind, uid: offer.uid, trapId: offer.trapId }
  };
}

function resolveDayEvent(exp: ExpeditionState, out: RaidEvent[]): void {
  if (exp.backupPending) {
    exp.backupPending = false;
    const wave = activeParty(exp);
    const names = wave.map((m) => m.hero.name).join(', ');
    exp.dayTitle = 'Calling Backup';
    exp.dayBody = `Word of the last wave reaches the muster. A fresh party forms up: ${names}.`;
    exp.log.push({ day: exp.day, kind: 'backup', text: `Wave ${exp.waveIndex} sets out.` });
    return;
  }

  const rng = dayRng(exp, 1);
  const e = pickEvent(exp, rng);
  if (!e) {
    exp.dayTitle = 'The Road Goes On';
    exp.dayBody = 'Nothing worth telling happens today.';
    exp.log.push({ day: exp.day, kind: 'quiet', text: 'A quiet day.' });
    return;
  }

  exp.dayTitle = e.title;
  exp.dayBody = e.body;
  if (e.category === 'cursed') exp.decay['cursed'] = (exp.decay['cursed'] || 0) + 1;

  if (e.kind === 'narrative' || e.options.length === 0) {
    exp.log.push({ day: exp.day, kind: e.id, text: e.title });
    return;
  }

  exp.pending = toPending(e);
  exp.log.push({ day: exp.day, kind: e.id, text: e.title });
}

export function commitChoice(exp: ExpeditionState, optionId: string, world: WorldState): DayOutcome {
  if (exp.status !== 'active' || !exp.pending) return { exp, events: [] };

  if (exp.pending.kind === 'proc') {
    const proc = exp.pending.proc;
    if (!proc || (optionId !== 'amp' && optionId !== 'longer')) return { exp, events: [] };
    const next: ExpeditionState = {
      ...exp,
      party: exp.party.map((m) => ({ ...m, hero: { ...m.hero, status: m.hero.status.map((s) => ({ ...s })) } })),
      log: exp.log.slice()
    };
    const member = next.party.find((m) => m.hero.uid === proc.uid);
    const active = member ? member.hero.status.find((s) => s.kind === proc.kind) : undefined;
    if (active) {
      if (optionId === 'amp') active.potency *= 1.6;
      else active.ticksLeft += 2;
    }
    const f = procFlavour(proc.trapId);
    const chosen = optionId === 'amp' ? f.amp : f.longer;
    next.pending = null;
    next.dayBody = `${next.dayBody}\n\n${chosen.hint}`;
    next.log.push({ day: next.day, kind: 'proc:' + proc.trapId, text: `${chosen.label}.` });
    return { exp: next, events: [] };
  }

  const e = dayEvent(exp.pending.eventId);
  const option = e ? e.options.find((o) => o.id === optionId) : null;
  if (!e || !option) return { exp, events: [] };

  const next: ExpeditionState = {
    ...exp,
    party: exp.party.map((m) => ({ ...m, hero: { ...m.hero, status: m.hero.status.map((s) => ({ ...s })) } })),
    mods: exp.mods.map((m) => ({ ...m })),
    monsters: exp.monsters.map((r) => (r ? { ...r, units: r.units.map((u) => ({ ...u })) } : r)),
    log: exp.log.slice(),
    record: exp.record.slice(),
    totals: { ...exp.totals }
  };

  const out: RaidEvent[] = [];
  const previous = next.aura;
  applyOption(next, e, option, out);
  next.pending = null;
  next.log.push({ day: next.day, kind: e.id + ':' + option.id, text: `${option.label}.` });
  if (e.kind === 'altar' && previous && next.aura && previous.id !== next.aura.id) {
    next.log.push({ day: next.day, kind: 'aura', text: `${previous.label} fades as the new aura takes hold.` });
  }
  next.dayBody = `${next.dayBody}\n\n${option.hint}`;
  return { exp: next, events: out };
}

function resolveCheckpoint(exp: ExpeditionState, mods: WorldModifiers, out: RaidEvent[]): void {
  const rng = dayRng(exp, 2);
  const index = exp.checkpoint;
  const isThrone = index >= EDITABLE_ROOMS;
  const wave = activeParty(exp);

  if (wave.length === 0) {
    exp.dayTitle = 'No One Comes';
    exp.dayBody = 'Your halls stay silent. Nobody arrives to test them today.';
    exp.log.push({ day: exp.day, kind: 'empty-checkpoint', text: 'No party reached the gate.' });
    return;
  }

  const label = isThrone ? 'the Throne Room' : `Room ${index + 1}`;
  const wantsOut = wave.filter((m) => wantsToFlee(m.hero, heroDef(m.hero.defId), rng));

  if (wantsOut.length * 2 > wave.length) {
    out.push({ t: 'decision', intent: 'flee', note: fleeNote(wantsOut[0].hero, heroDef(wantsOut[0].hero.defId)) });
    out.push({ t: 'heroFlee', fromRoom: index });
    out.push({ t: 'reaction', kind: 'panic' });
    for (const m of wave) {
      m.fled = true;
      exp.totals.goldStolen += m.hero.looted;
    }
    exp.dayTitle = 'They Turn Back';
    exp.dayBody = `The party breaks off short of ${label} and runs for the entrance.`;
    exp.log.push({ day: exp.day, kind: 'flee', text: `Wave ${exp.waveIndex} withdrew from ${label}.` });
    const reward = checkpointReward(exp.setup.tierScale, mods, true);
    exp.totals.gold += reward.gold;
    exp.totals.souls += reward.souls;
    callBackup(exp, mods, dayRng(exp, 3), out);
    return;
  }

  const built = isThrone
    ? { slot: { kind: 'empty' as const }, level: 1 }
    : exp.setup.dungeon.rooms[index] || { slot: { kind: 'empty' as const }, level: 1 };
  const roomIndex = isThrone ? EDITABLE_ROOMS : index;

  const res = runCheckpoint({
    roomIndex,
    built,
    isThrone,
    party: wave.map((m) => ({ hero: m.hero, def: heroDef(m.hero.defId) })),
    runtime: exp.monsters[roomIndex],
    world: mods,
    rng,
    lord: isThrone ? { level: exp.setup.dungeon.lordLevel, weaponId: exp.setup.dungeon.lordWeaponId } : null,
    killedByTag: null
  });

  for (const e of res.events) out.push(e);
  for (const m of wave) {
    clearCombatScoped(m.hero, out);
    if (m.hero.hp <= 0) m.alive = false;
  }
  exp.monsters = exp.monsters.map((rt, i) => (i === roomIndex ? res.runtime : rt));

  const reward = checkpointReward(exp.setup.tierScale, mods, res.wiped);
  exp.totals.gold += reward.gold;
  exp.totals.souls += reward.souls;

  const fallen = wave.filter((m) => !m.alive).length;

  if (res.wiped) {
    if (res.killedByTag) exp.knowledge[res.killedByTag] = (exp.knowledge[res.killedByTag] || 0) + 1;
    exp.dayTitle = isThrone ? 'Nekrokos Holds' : `${label} Holds`;
    exp.dayBody = `Wave ${exp.waveIndex} dies in ${label}. Word goes back for another.`;
    exp.log.push({ day: exp.day, kind: 'wipe', text: `Wave ${exp.waveIndex} wiped at ${label}.` });
    if (isThrone) {
      finish(exp, 'dungeonWin');
      return;
    }
    callBackup(exp, mods, dayRng(exp, 4), out);
    return;
  }

  if (res.stalled) {
    queueProc(exp, res.procs);
    out.push({ t: 'stalled', room: roomIndex });
    exp.dayTitle = 'A Long Standoff';
    exp.dayBody = `Neither side breaks in ${label}. The party pulls back to try again.`;
    exp.log.push({ day: exp.day, kind: 'stall', text: `${label} ended in a standoff.` });
    return;
  }

  exp.totals.checkpointsCleared += 1;
  exp.checkpoint = index + 1;

  if (isThrone) {
    exp.dayTitle = 'The Throne Falls';
    exp.dayBody = 'Nekrokos goes down. What is left of the party walks out with your gold.';
    exp.log.push({ day: exp.day, kind: 'breach', text: 'The Throne Room was breached.' });
    for (const m of wave) if (m.alive) exp.totals.goldStolen += m.hero.looted;
    finish(exp, 'heroVictory');
    return;
  }

  queueProc(exp, res.procs);

  exp.dayTitle = `${label} Falls`;
  exp.dayBody =
    fallen > 0
      ? `The party clears ${label}, ${fallen} of them left behind, and moves deeper.`
      : `The party clears ${label} intact and moves deeper.`;
  exp.log.push({
    day: exp.day,
    kind: 'cleared',
    text: fallen > 0 ? `${label} cleared; ${fallen} dead.` : `${label} cleared.`
  });
}
