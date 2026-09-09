import type {
  ActiveStatus,
  DayEvent,
  DayEventOption,
  Dungeon,
  CampaignTier,
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
import { composeModifiers, activeEffects, tickWorld, CAMPAIGN_CLAMP } from './world';
import type { GameState } from './save';

export const CAMPAIGN_SHAPE = 3;

const GAP: Record<CampaignTier, number> = { early: 3, mid: 4, late: 5 };

export interface CampaignSetup {
  tier: CampaignTier;
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
  king?: boolean;
  doubledEffect?: boolean;
}

export interface CampaignModifier {
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

export interface CampaignState {
  shape: number;
  seed: number;
  setup: CampaignSetup;
  day: number;
  checkpoint: number;
  status: 'active' | 'complete';
  pending: PendingChoice | null;
  dayTitle: string;
  dayBody: string;
  dayTone?: DayTone;
  party: PartyMember[];
  waveIndex: number;
  backupPending: boolean;
  monsters: (MonsterRuntime | null)[];
  mods: CampaignModifier[];
  aura: CampaignModifier | null;
  knowledge: Partial<Record<Tag, number>>;
  decay: Partial<Record<string, number>>;
  log: ExpLogEntry[];
  record: RaidEvent[];
  totals: { gold: number; souls: number; goldStolen: number; checkpointsCleared: number; wavesLost: number };
  outcome: Outcome | null;
}

export type DayTone = 'blessed' | 'cursed' | 'neutral' | 'omen' | 'battle';

export interface DayOutcome {
  camp: CampaignState;
  events: RaidEvent[];
}

const KEPT_EVENTS = new Set(['interaction', 'monsterSplit', 'trapFire', 'monsterDown', 'treasureTaken']);

function dayRng(camp: CampaignState, salt: number): Rng {
  return seeded((camp.seed ^ Math.imul(camp.day + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0);
}

export function campaignEffects(camp: CampaignState): WorldEffect[] {
  const out = camp.mods.map((m) => m.effect);
  if (camp.aura) out.push(camp.aura.effect);
  for (const [tag, stacks] of Object.entries(camp.knowledge)) {
    const n = stacks as number;
    if (n > 0) out.push({ tagDamage: { [tag as Tag]: Math.max(0.7, 1 - n * 0.1) } });
  }
  return out;
}

function modifiersFor(camp: CampaignState, world: WorldState): WorldModifiers {
  return composeModifiers([...activeEffects(world), ...campaignEffects(camp)], CAMPAIGN_CLAMP);
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

function makeMember(record: HeroRecord, world: WorldModifiers, wave: number, king = false): PartyMember {
  return { hero: buildHero(record, world), record, killedByTag: null, wave, alive: true, fled: false, king };
}

export const KING_LINE = 'The Party was wiped out, but this King has Arrived.';

function makeKing(camp: CampaignState, world: WorldModifiers, wave: number): PartyMember {
  const defId = camp.setup.arthurDefId;
  const def = heroDef(defId);
  const level = Math.min(15, stageDef(camp.setup.stage).heroLevel + 4);
  return makeMember(
    {
      uid: 'king' + camp.seed.toString(36),
      defId,
      name: 'King Arthur',
      title: def.role,
      level,
      raids: 0,
      deaths: 0,
      scars: []
    },
    world,
    wave,
    true
  );
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

export function beginCampaign(
  state: GameState,
  record: HeroRecord,
  rng: Rng,
  guardianId?: string
): CampaignState {
  const stage = stageDef(state.stage);
  const tier = tierOf(state.stage);
  const gap = GAP[tier];
  const totalDays = gap * CHECKPOINTS;
  const checkpointDays: number[] = [];
  for (let i = 1; i <= CHECKPOINTS; i++) checkpointDays.push(gap * i);

  const dungeon: Dungeon = { ...toDungeon(state), lordLevel: Math.max(state.lordLevel, stage.lordLevel) };
  const level = Math.max(record.level, stage.heroLevel);
  const world = composeModifiers(activeEffects(state.world), CAMPAIGN_CLAMP);
  const seed = Math.floor(rng() * 0xffffffff) >>> 0;
  const seedBase = 'camp' + seed.toString(36);

  return {
    shape: CAMPAIGN_SHAPE,
    seed,
    setup: {
      tier,
      gap,
      totalDays,
      checkpointDays,
      dungeon,
      stage: state.stage,
      tierScale: state.stage,
      guardianId: guardianId || MONSTERS[Math.floor(rng() * MONSTERS.length) % MONSTERS.length].id,
      arthurDefId: HEROES[Math.floor(rng() * HEROES.length) % HEROES.length].id,
      pool: stage.heroPool
    },
    day: 1,
    checkpoint: 0,
    status: 'active',
    pending: null,
    dayTitle: 'The Road Begins',
    dayTone: 'neutral',
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

export function endCampaign(
  state: GameState,
  camp: CampaignState,
  rng: Rng
): { state: GameState; fired: WorldEvent | null } {
  const outcome = camp.outcome || 'dungeonWin';
  const turned = tickWorld(state.world, camp.setup.stage, rng);
  const gold = Math.max(0, camp.totals.gold - camp.totals.goldStolen);
  const synthetic: RaidResult = {
    events: camp.record,
    outcome,
    gold,
    souls: camp.totals.souls,
    goldStolen: camp.totals.goldStolen,
    roomsCleared: camp.totals.checkpointsCleared,
    hero: snapshot(camp.party[0].hero),
    killedByTag: camp.party[0].killedByTag,
    survived: outcome !== 'dungeonWin'
  };

  let roster = state.roster;
  for (const m of camp.party) {
    if (m.king) continue;
    roster = absorbResult(roster, m.record, { survived: m.alive || m.fled, killedByTag: m.killedByTag });
  }

  const earned = [...trophiesFrom(camp.record), ...challengesFrom(camp.setup.dungeon, camp.setup.stage, synthetic)].filter(
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
    campaign: null,
    world: turned.world,
    gold: state.gold + gold,
    souls: state.souls + camp.totals.souls + challengeSouls(earned),
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
      goldStolen: state.stats.goldStolen + camp.totals.goldStolen
    }
  };

  if (outcome !== 'heroVictory') {
    next.maxStageCleared = Math.max(state.maxStageCleared, state.stage);
    if (state.stage < STAGE_MAX) next.stage = state.stage + 1;
  }

  return { state: next, fired: turned.fired };
}

export function normalizeCampaign(input: unknown): CampaignState | null {
  if (!input || typeof input !== 'object') return null;
  const e = input as Partial<CampaignState>;
  const setup = e.setup;
  if (e.shape !== CAMPAIGN_SHAPE) return null;
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
  return e as CampaignState;
}

export interface Intel {
  tier: CampaignTier;
  totalDays: number;
  gap: number;
  waveSize: number;
  pool: { defId: string; name: string; role: string }[];
  arthur: { defId: string; name: string; ability: string; blurb: string };
  lordLevel: number;
}

export function campaignIntel(state: GameState, arthurDefId: string): Intel {
  const stage = stageDef(state.stage);
  const tier = tierOf(state.stage);
  const gap = GAP[tier];
  const pool = (stage.heroPool.length > 0 ? stage.heroPool : HEROES.map((h) => h.id)).map((id) => {
    const d = heroDef(id);
    return { defId: id, name: d.name, role: d.role };
  });
  const a = heroDef(arthurDefId);
  return {
    tier,
    totalDays: gap * CHECKPOINTS,
    gap,
    waveSize: WAVE_SIZE,
    pool,
    arthur: { defId: a.id, name: a.name, ability: a.ability.name, blurb: a.ability.blurb },
    lordLevel: Math.max(state.lordLevel, stage.lordLevel)
  };
}

export function isCheckpointDay(camp: CampaignState): boolean {
  return camp.setup.checkpointDays.includes(camp.day);
}

export function daysToCheckpoint(camp: CampaignState): number {
  for (const d of camp.setup.checkpointDays) if (d >= camp.day) return d - camp.day;
  return 0;
}

function livingMembers(camp: CampaignState): PartyMember[] {
  return camp.party.filter((m) => m.alive && !m.fled);
}

export function actingMember(camp: CampaignState): PartyMember | null {
  return livingMembers(camp)[0] || null;
}

export function activeParty(camp: CampaignState): PartyMember[] {
  const living = livingMembers(camp);
  if (living.length === 0) return [];
  const wave = Math.max(...living.map((m) => m.wave));
  return living.filter((m) => m.wave === wave);
}

export function eligibleEvents(camp: CampaignState): DayEvent[] {
  const statuses = new Set<string>();
  for (const m of livingMembers(camp)) for (const s of m.hero.status) statuses.add(s.kind);
  return DAY_EVENTS.filter((e) => {
    if (!e.tiers.includes(camp.setup.tier)) return false;
    if (e.requiresStatus && !e.requiresStatus.some((k) => statuses.has(k))) return false;
    return true;
  });
}

const PROXIMITY: Record<number, number> = { 1: 1.5, 2: 0.75 };
const STATUS_BOOST = 2;

function setupStatusesFor(tag: Tag): StatusKind[] {
  return INTERACTIONS.filter((i) => i.incomingTag === tag).map((i) => i.requiresStatus);
}

export function upcomingTag(camp: CampaignState): Tag | null {
  const index = camp.checkpoint;
  if (index >= EDITABLE_ROOMS) return lordWeapon(camp.setup.dungeon.lordWeaponId).tag;
  const built = camp.setup.dungeon.rooms[index];
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

export function weightsFor(camp: CampaignState, pool = eligibleEvents(camp)): { event: DayEvent; weight: number }[] {
  return dayEventWeights(pool, {
    daysToCheckpoint: daysToCheckpoint(camp),
    upcoming: upcomingTag(camp),
    decay: camp.decay
  });
}

function pickEvent(camp: CampaignState, rng: Rng): DayEvent | null {
  const pool = eligibleEvents(camp);
  if (pool.length === 0) return null;
  const recent = camp.log.slice(-4).map((l) => l.kind);
  const fresh = pool.filter((e) => !recent.includes(e.id));
  const weighted = weightsFor(camp, fresh.length > 0 ? fresh : pool).filter((w) => w.weight > 0);
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

function applyOption(camp: CampaignState, e: DayEvent, option: DayEventOption, out: RaidEvent[]): void {
  if (option.effect) {
    const mod: CampaignModifier = {
      id: `${e.id}:${option.id}`,
      source: e.kind === 'altar' ? 'altar' : 'choice',
      label: `${e.title} — ${option.label}`,
      daysLeft: option.days === undefined ? 3 : option.days,
      effect: option.effect
    };
    if (e.kind === 'altar') camp.aura = mod;
    else camp.mods = [...camp.mods.filter((m) => m.id !== mod.id), mod];
  }

  if (option.healPct) {
    for (const m of livingMembers(camp)) heal(m.hero, m.hero.maxHp * option.healPct, out);
  }

  const app = option.applyStatus;
  if (app) {
    if (app.to === 'party' || app.to === 'both') {
      for (const m of livingMembers(camp)) applyStatus(m.hero, app.kind, app.days, heroDef(m.hero.defId), out);
    }
    if (app.to === 'monsters' || app.to === 'both') {
      const except = app.except || [];
      camp.monsters = camp.monsters.map((rt) => {
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

function decayMods(camp: CampaignState): void {
  camp.mods = camp.mods.filter((m) => {
    if (m.daysLeft < 0) return true;
    m.daysLeft -= 1;
    return m.daysLeft > 0;
  });
  for (const key of Object.keys(camp.decay)) {
    const next = Math.max(0, (camp.decay[key] || 0) - 0.34);
    if (next === 0) delete camp.decay[key];
    else camp.decay[key] = next;
  }
}

function advanceAll(camp: CampaignState, out: RaidEvent[]): void {
  for (const m of camp.party) {
    if (!m.alive || m.fled) continue;
    const { kept, expired } = advanceStatusList(m.hero.status);
    m.hero.status = kept;
    for (const kind of expired) out.push({ t: 'statusOff', kind });
  }
  camp.monsters = camp.monsters.map((rt) => {
    if (!rt) return rt;
    const units = rt.units.map((u) => {
      const { kept } = advanceStatusList(u.status);
      return { ...u, status: kept as ActiveStatus[] };
    });
    return { ...rt, units };
  });
}

function callBackup(camp: CampaignState, world: WorldModifiers, rng: Rng, out: RaidEvent[]): void {
  camp.totals.wavesLost += 1;
  out.push({ t: 'waveWipe', wave: camp.waveIndex });
  // If the only checkpoint left is the Throne, no relief column can reach it in
  // time. Nobody else is coming, and the King arrives alone.
  const nextCheckpoint = camp.setup.checkpointDays.find((d) => d > camp.day);
  if (nextCheckpoint === undefined || nextCheckpoint >= camp.setup.totalDays) {
    camp.backupPending = false;
    return;
  }
  camp.waveIndex += 1;
  camp.party = [
    ...camp.party,
    ...rollWave(
      camp.setup.pool,
      stageDef(camp.setup.stage).heroLevel,
      'camp' + camp.seed.toString(36),
      camp.waveIndex,
      world,
      rng
    )
  ];
  camp.backupPending = true;
}

function finish(camp: CampaignState, outcome: Outcome): void {
  camp.status = 'complete';
  camp.outcome = outcome;
}

export function advanceDay(camp: CampaignState, world: WorldState): DayOutcome {
  if (camp.status !== 'active' || camp.pending !== null) return { camp, events: [] };

  const next: CampaignState = {
    ...camp,
    party: camp.party.map((m) => ({ ...m, hero: { ...m.hero, status: m.hero.status.map((s) => ({ ...s })) } })),
    mods: camp.mods.map((m) => ({ ...m })),
    monsters: camp.monsters.map((r) => (r ? { ...r, units: r.units.map((u) => ({ ...u })) } : r)),
    knowledge: { ...camp.knowledge },
    decay: { ...camp.decay },
    log: camp.log.slice(),
    record: camp.record.slice(),
    totals: { ...camp.totals }
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

  return { camp: next, events: out };
}

function queueProc(camp: CampaignState, procs: ProcOffer[]): void {
  if (camp.pending || procs.length === 0) return;
  const offer = procs.find((o) => {
    const m = camp.party.find((x) => x.hero.uid === o.uid);
    return m && m.hero.hp > 0 && m.hero.status.some((s) => s.kind === o.kind);
  });
  if (!offer) return;
  const f = procFlavour(offer.trapId);
  camp.pending = {
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

function resolveDayEvent(camp: CampaignState, out: RaidEvent[]): void {
  if (camp.backupPending) {
    camp.backupPending = false;
    const wave = activeParty(camp);
    const names = wave.map((m) => m.hero.name).join(', ');
    camp.dayTone = 'omen';
    camp.dayTitle = 'Calling Backup';
    camp.dayBody = `Word of the last wave reaches the muster. A fresh party forms up: ${names}.`;
    camp.log.push({ day: camp.day, kind: 'backup', text: `Wave ${camp.waveIndex} sets out.` });
    return;
  }

  const rng = dayRng(camp, 1);
  const e = pickEvent(camp, rng);
  if (!e) {
    camp.dayTone = 'neutral';
    camp.dayTitle = 'The Road Goes On';
    camp.dayBody = 'Nothing worth telling happens today.';
    camp.log.push({ day: camp.day, kind: 'quiet', text: 'A quiet day.' });
    return;
  }

  camp.dayTone = e.category;
  camp.dayTitle = e.title;
  camp.dayBody = e.body;
  if (e.category === 'cursed') camp.decay['cursed'] = (camp.decay['cursed'] || 0) + 1;

  if (e.kind === 'narrative' || e.options.length === 0) {
    camp.log.push({ day: camp.day, kind: e.id, text: e.title });
    return;
  }

  camp.pending = toPending(e);
  camp.log.push({ day: camp.day, kind: e.id, text: e.title });
}

export function commitChoice(camp: CampaignState, optionId: string, world: WorldState): DayOutcome {
  if (camp.status !== 'active' || !camp.pending) return { camp, events: [] };

  if (camp.pending.kind === 'proc') {
    const proc = camp.pending.proc;
    if (!proc || (optionId !== 'amp' && optionId !== 'longer')) return { camp, events: [] };
    const next: CampaignState = {
      ...camp,
      party: camp.party.map((m) => ({ ...m, hero: { ...m.hero, status: m.hero.status.map((s) => ({ ...s })) } })),
      log: camp.log.slice()
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
    return { camp: next, events: [] };
  }

  const e = dayEvent(camp.pending.eventId);
  const option = e ? e.options.find((o) => o.id === optionId) : null;
  if (!e || !option) return { camp, events: [] };

  const next: CampaignState = {
    ...camp,
    party: camp.party.map((m) => ({ ...m, hero: { ...m.hero, status: m.hero.status.map((s) => ({ ...s })) } })),
    mods: camp.mods.map((m) => ({ ...m })),
    monsters: camp.monsters.map((r) => (r ? { ...r, units: r.units.map((u) => ({ ...u })) } : r)),
    log: camp.log.slice(),
    record: camp.record.slice(),
    totals: { ...camp.totals }
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
  return { camp: next, events: out };
}

function resolveCheckpoint(camp: CampaignState, mods: WorldModifiers, out: RaidEvent[]): void {
  const rng = dayRng(camp, 2);
  const isThrone = camp.day >= camp.setup.totalDays || camp.checkpoint >= EDITABLE_ROOMS;
  const index = isThrone ? EDITABLE_ROOMS : camp.checkpoint;
  const label = isThrone ? 'the Throne Room' : `Room ${index + 1}`;
  camp.dayTone = 'battle';
  let wave = activeParty(camp);

  if (isThrone && !camp.party.some((m) => m.king)) {
    const alone = wave.length === 0;
    // Join the wave that actually arrived, not the muster counter: a suppressed
    // backup can leave those two out of step, which would strand his Ward.
    const king = makeKing(camp, mods, alone ? camp.waveIndex : wave[0].wave);
    king.doubledEffect = alone;
    camp.party = [...camp.party, king];
    wave = activeParty(camp);
    camp.log.push({
      day: camp.day,
      kind: 'king',
      text: alone ? KING_LINE : `King Arthur joins the survivors at ${label}.`
    });
    if (alone) {
      camp.dayTitle = 'The King Has Arrived';
      camp.dayBody = KING_LINE;
    }
  }

  if (wave.length === 0) {
    camp.dayTitle = 'No One Comes';
    camp.dayBody = 'Your halls stay silent. Nobody arrives to test them today.';
    camp.log.push({ day: camp.day, kind: 'empty-checkpoint', text: 'No party reached the gate.' });
    return;
  }

  const wantsOut = isThrone ? [] : wave.filter((m) => wantsToFlee(m.hero, heroDef(m.hero.defId), rng));

  if (wantsOut.length * 2 > wave.length) {
    out.push({ t: 'decision', intent: 'flee', note: fleeNote(wantsOut[0].hero, heroDef(wantsOut[0].hero.defId)) });
    out.push({ t: 'heroFlee', fromRoom: index });
    out.push({ t: 'reaction', kind: 'panic' });
    for (const m of wave) {
      m.fled = true;
      camp.totals.goldStolen += m.hero.looted;
    }
    camp.dayTitle = 'They Turn Back';
    camp.dayBody = `The party breaks off short of ${label} and runs for the entrance.`;
    camp.log.push({ day: camp.day, kind: 'flee', text: `Wave ${camp.waveIndex} withdrew from ${label}.` });
    const reward = checkpointReward(camp.setup.tierScale, mods, true);
    camp.totals.gold += reward.gold;
    camp.totals.souls += reward.souls;
    callBackup(camp, mods, dayRng(camp, 3), out);
    return;
  }

  const built = isThrone
    ? { slot: { kind: 'empty' as const }, level: 1 }
    : camp.setup.dungeon.rooms[index] || { slot: { kind: 'empty' as const }, level: 1 };
  const roomIndex = isThrone ? EDITABLE_ROOMS : index;

  const res = runCheckpoint({
    roomIndex,
    built,
    isThrone,
    party: wave.map((m) => ({
      hero: m.hero,
      def: heroDef(m.hero.defId),
      king: m.king,
      doubled: m.doubledEffect
    })),
    runtime: camp.monsters[roomIndex],
    world: mods,
    rng,
    lord: isThrone
      ? {
          level: camp.setup.dungeon.lordLevel,
          weaponId: camp.setup.dungeon.lordWeaponId,
          guardianId: camp.setup.guardianId
        }
      : null,
    killedByTag: null
  });

  for (const e of res.events) out.push(e);
  for (const m of wave) {
    clearCombatScoped(m.hero, out);
    if (m.hero.hp <= 0) m.alive = false;
  }
  camp.monsters = camp.monsters.map((rt, i) => (i === roomIndex ? res.runtime : rt));

  const reward = checkpointReward(camp.setup.tierScale, mods, res.wiped);
  camp.totals.gold += reward.gold;
  camp.totals.souls += reward.souls;

  const fallen = wave.filter((m) => !m.alive).length;

  if (res.wiped) {
    if (res.killedByTag) camp.knowledge[res.killedByTag] = (camp.knowledge[res.killedByTag] || 0) + 1;
    camp.dayTitle = isThrone ? 'Nekrokos Holds' : `${label} Holds`;
    camp.dayBody = `Wave ${camp.waveIndex} dies in ${label}. Word goes back for another.`;
    camp.log.push({ day: camp.day, kind: 'wipe', text: `Wave ${camp.waveIndex} wiped at ${label}.` });
    if (isThrone) {
      finish(camp, 'dungeonWin');
      return;
    }
    callBackup(camp, mods, dayRng(camp, 4), out);
    return;
  }

  if (res.stalled) {
    queueProc(camp, res.procs);
    out.push({ t: 'stalled', room: roomIndex });
    camp.dayTitle = 'A Long Standoff';
    camp.dayBody = `Neither side breaks in ${label}. The party pulls back to try again.`;
    camp.log.push({ day: camp.day, kind: 'stall', text: `${label} ended in a standoff.` });
    return;
  }

  camp.totals.checkpointsCleared += 1;
  camp.checkpoint = index + 1;

  if (isThrone) {
    camp.dayTitle = 'The Throne Falls';
    camp.dayBody = 'Nekrokos goes down. What is left of the party walks out with your gold.';
    camp.log.push({ day: camp.day, kind: 'breach', text: 'The Throne Room was breached.' });
    for (const m of wave) if (m.alive) camp.totals.goldStolen += m.hero.looted;
    finish(camp, 'heroVictory');
    return;
  }

  queueProc(camp, res.procs);

  camp.dayTitle = `${label} Falls`;
  camp.dayBody =
    fallen > 0
      ? `The party clears ${label}, ${fallen} of them left behind, and moves deeper.`
      : `The party clears ${label} intact and moves deeper.`;
  camp.log.push({
    day: camp.day,
    kind: 'cleared',
    text: fallen > 0 ? `${label} cleared; ${fallen} dead.` : `${label} cleared.`
  });
}
