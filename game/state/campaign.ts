import type {
  ActiveStatus,
  Dungeon,
  CampaignTier,
  HeroRecord,
  MonsterRuntime,
  MonsterUnit,
  Outcome,
  RaidEvent,
  RaidResult,
  RoomSlot,
  Tag,
  WorldEffect,
  WorldEvent,
  WorldModifiers,
  WorldState
} from '../types';
import { CAMPAIGN_MAX, EDITABLE_ROOMS, FAME_MAX, MAX_PER_ID } from '../types';
import { dayEvent, procFlavour } from '../content/dayEvents';
import { MONSTERS, monsterDef } from '../content/monsters';
import { TRAPS, trapDef } from '../content/traps';
import { HEROES, heroDef } from '../content/heroes';
import { STAGE_MAX, stageDef } from '../content/stages';
import { makeName } from '../content/names';
import { legacyFrom, trophiesFrom } from '../content/milestones';
import { challengeSouls, challengesFrom } from '../content/challenges';
import {
  advanceStatusList,
  buildHero,
  clearCombatScoped,
  snapshot,
  tickStatusDamage
} from '../sim/hero';
import { fleeNote, wantsToFlee } from '../sim/ai';
import { runCheckpoint, type ProcOffer } from '../sim/checkpoint';
import { simulateRaid } from '../sim/raid';
import { seeded, type Rng } from '../sim/rng';
import { campaignPerformanceReward, checkpointReward, toDungeon, upgradeCost, type PerformanceInputs } from './economy';
import { absorbResult } from './roster';
import { composeModifiers, activeEffects, tickWorld, CAMPAIGN_CLAMP } from './world';
import type { GameState } from './save';

import type { BattleSeed, CampaignState, DayOutcome, MilestoneStop, PartyMember, PendingChoice } from './campaignState';
import {
  CAMPAIGN_SHAPE,
  CAMPAIGN_START_UNLOCKED,
  CAMPAIGN_START_WALLET,
  MAX_WAVES,
  MILESTONE_TABLE,
  activeParty,
  campaignTier,
  daysToCheckpoint,
  familyEffect,
  isCheckpointDay,
  isFinalDay,
  milestoneAt,
  nextMilestone,
  waveSizeFor
} from './campaignState';
import { applyOption, decayMods, pickEvent, toPending } from './campaignEvents';

const RANDOM_BATTLE_CHANCE = 0.35;
const MILESTONE_HERO_BUFF: Record<MilestoneStop['kind'], number> = { mini: 1, elite: 1.18, final: 1 };

const KEPT_EVENTS = new Set([
  'interaction',
  'monsterSplit',
  'trapFire',
  'monsterDown',
  'treasureTaken',
  'kingArrives',
  'throneGuardian'
]);

function dayRng(camp: CampaignState, salt: number): Rng {
  return seeded((camp.seed ^ Math.imul(camp.day + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0);
}

export function campaignEffects(camp: CampaignState): WorldEffect[] {
  const out = camp.mods.map((m) => m.effect);
  out.push(familyEffect(camp.setup.campaignNumber));
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

function liveDungeon(camp: CampaignState): Dungeon {
  return {
    rooms: camp.runRooms.map((slot) => ({
      slot,
      level: slot.kind === 'empty' ? 1 : camp.runLevels[slot.id] || 1
    })),
    lordLevel: camp.setup.dungeon.lordLevel,
    lordWeaponId: camp.setup.dungeon.lordWeaponId,
    talents: camp.setup.dungeon.talents
  };
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

function rollWave(
  pool: string[],
  level: number,
  uidBase: string,
  wave: number,
  size: number,
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
  while (out.length < size) {
    const fresh = from.filter((id) => !taken.includes(id));
    const open = fresh.length > 0 ? fresh : from;
    const favoured = world.heroBias.filter((id) => open.includes(id));
    const draw = favoured.length > 0 && rng() < 0.6 ? favoured : open;
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
  const campaignNumber = Math.max(1, Math.min(CAMPAIGN_MAX, state.campaignNumber));
  const waveSize = waveSizeFor(campaignNumber);
  const tier = campaignTier(campaignNumber);
  const milestones = MILESTONE_TABLE[tier];
  const milestoneDays = milestones.map((m) => m.day);
  const totalDays = milestones[milestones.length - 1].day;

  const dungeon: Dungeon = { ...toDungeon(state), lordLevel: Math.max(state.lordLevel, stage.lordLevel) };
  const level = Math.max(record.level, stage.heroLevel);
  const world = composeModifiers([...activeEffects(state.world), familyEffect(campaignNumber)], CAMPAIGN_CLAMP);
  const seed = Math.floor(rng() * 0xffffffff) >>> 0;
  const seedBase = 'camp' + seed.toString(36);

  return {
    shape: CAMPAIGN_SHAPE,
    seed,
    setup: {
      campaignNumber,
      tier,
      totalDays,
      milestoneDays,
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
    dayBody: `A party of ${waveSize} sets out for your gate, ${record.name} at the front. ${totalDays} days of road lie between.`,
    party: rollWave(stage.heroPool, level, seedBase, 1, waveSize, world, rng, record),
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
    wallet: { ...CAMPAIGN_START_WALLET },
    runRooms: Array.from({ length: EDITABLE_ROOMS }, () => ({ kind: 'empty' as const })),
    runLevels: {},
    runUnlocked: [...CAMPAIGN_START_UNLOCKED],
    outcome: null
  };
}

export function endCampaign(
  state: GameState,
  camp: CampaignState,
  rng: Rng
): { state: GameState; fired: WorldEvent | null; payout: { gold: number; souls: number } } {
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

  const milestonesTotal = camp.setup.milestoneDays.length;
  const milestonesCleared = camp.setup.milestoneDays.filter((d) => d <= camp.day).length;
  const payout = campaignPerformanceReward({
    outcome,
    daysSurvived: camp.day,
    totalDays: camp.setup.totalDays,
    milestonesCleared,
    milestonesTotal,
    checkpointsCleared: camp.totals.checkpointsCleared,
    wavesLost: camp.totals.wavesLost,
    goldEarned: camp.totals.gold,
    soulsEarned: camp.totals.souls,
    goldStolen: camp.totals.goldStolen,
    eventsResolved: camp.log.length,
    tier: camp.setup.tier,
    campaignNumber: camp.setup.campaignNumber
  } satisfies PerformanceInputs);

  let roster = state.roster;
  for (const m of camp.party) {
    if (m.king) continue;
    roster = absorbResult(roster, m.record, { survived: m.alive || m.fled, killedByTag: m.killedByTag });
  }

  const earned = [
    ...trophiesFrom(camp.record, outcome === 'dungeonWin'),
    ...challengesFrom(camp.setup.dungeon, camp.setup.stage, synthetic, camp.setup.campaignNumber)
  ].filter((id) => !state.unlockedMilestones.includes(id));

  const hero = roster.find((h) => h.uid === camp.party[0].record.uid) || roster[0];
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
    gold: state.gold + payout.gold,
    souls: state.souls + payout.souls + challengeSouls(earned),
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

  const n = camp.setup.campaignNumber;
  next.bestDaysByCampaign = {
    ...state.bestDaysByCampaign,
    [n]: Math.max(state.bestDaysByCampaign[n] || 0, camp.day)
  };
  if (outcome === 'dungeonWin') next.campaignNumber = Math.min(CAMPAIGN_MAX, n + 1);

  if (outcome !== 'heroVictory') {
    next.maxStageCleared = Math.max(state.maxStageCleared, state.stage);
    if (state.stage < STAGE_MAX) next.stage = state.stage + 1;
  }

  return { state: next, fired: turned.fired, payout };
}

export interface Intel {
  tier: CampaignTier;
  totalDays: number;
  milestones: MilestoneStop[];
  waveSize: number;
  pool: { defId: string; name: string; role: string }[];
  arthur: { defId: string; name: string; ability: string; blurb: string };
  lordLevel: number;
}

export function campaignIntel(state: GameState, arthurDefId: string): Intel {
  const stage = stageDef(state.stage);
  const tier = campaignTier(state.campaignNumber);
  const milestones = MILESTONE_TABLE[tier];
  const pool = (stage.heroPool.length > 0 ? stage.heroPool : HEROES.map((h) => h.id)).map((id) => {
    const d = heroDef(id);
    return { defId: id, name: d.name, role: d.role };
  });
  const a = heroDef(arthurDefId);
  return {
    tier,
    totalDays: milestones[milestones.length - 1].day,
    milestones,
    waveSize: waveSizeFor(state.campaignNumber),
    pool,
    arthur: { defId: a.id, name: a.name, ability: a.ability.name, blurb: a.ability.blurb },
    lordLevel: Math.max(state.lordLevel, stage.lordLevel)
  };
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
  if (camp.day >= camp.setup.totalDays - 1 || camp.waveIndex >= MAX_WAVES) {
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
      waveSizeFor(camp.setup.campaignNumber),
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
    totals: { ...camp.totals },
    wallet: { ...camp.wallet },
    runRooms: camp.runRooms.map((s) => ({ ...s })),
    runLevels: { ...camp.runLevels },
    runUnlocked: camp.runUnlocked.slice()
  };

  const out: RaidEvent[] = [];
  decayMods(next);
  const mods = modifiersFor(next, world);
  const rng = dayRng(next, 2);
  const preWave = activeParty(next);

  let battle = false;
  if (isFinalDay(next)) {
    resolveFinalDay(next, mods, rng, out);
    battle = true;
  } else if (isCheckpointDay(next)) {
    resolveMilestoneBattle(next, mods, rng, out);
    battle = true;
  } else if (isPrepDay(next)) {
    resolveForcedPrep(next);
  } else if (rng() < RANDOM_BATTLE_CHANCE) {
    resolveRandomBattle(next, mods, rng, out);
    battle = true;
  } else {
    resolveDayEvent(next, out);
  }

  const raidStart = out.find((e): e is Extract<RaidEvent, { t: 'raidStart' }> => e.t === 'raidStart');
  const seeds: BattleSeed[] = raidStart
    ? [{ name: raidStart.hero.name, defId: raidStart.hero.defId, hp: raidStart.hero.hp, maxHp: raidStart.hero.maxHp }]
    : preWave.map((m) => ({ name: m.hero.name, defId: m.hero.defId, hp: m.hero.hp, maxHp: m.hero.maxHp }));

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

  return { camp: next, events: out, battle, seeds };
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

  if (camp.pending.kind === 'prep') {
    const next: CampaignState = {
      ...camp,
      mods: camp.mods.map((m) => ({ ...m })),
      log: camp.log.slice()
    };
    if (optionId === 'merchant') {
      next.pending = rollMerchantShop(next);
      next.log.push({ day: next.day, kind: 'prep:merchant', text: 'A traveling merchant sets up shop.' });
      return { camp: next, events: [] };
    }
    if (optionId === 'dwarf') {
      next.pending = {
        eventId: 'prep-dwarf',
        kind: 'dwarfOffer',
        title: 'Wandering Dwarf',
        body: 'A dwarf looks over your traps and monsters, tools in hand.',
        options: [
          { id: 'upgrade', label: 'Upgrade', hint: 'Pay him to upgrade something you already have.' },
          { id: 'leave', label: 'Leave', hint: 'Send him on his way.' }
        ]
      };
      next.log.push({ day: next.day, kind: 'prep:dwarf', text: 'A wandering dwarf offers his services.' });
      return { camp: next, events: [] };
    }
    if (optionId === 'party') {
      next.mods = [
        ...next.mods.filter((m) => m.id !== 'prep:party'),
        { id: 'prep:party', source: 'choice' as const, label: 'Campfire Council', daysLeft: 4, effect: { heroAtk: 1.1, heroHp: 1.1 } }
      ];
      next.log.push({ day: next.day, kind: 'prep:party', text: 'The party rallies around the fire.' });
      next.pending = null;
      next.dayBody = `${next.dayBody}\n\nThe party rallies around the fire, ready for what comes next.`;
      return { camp: next, events: [] };
    }
    return { camp, events: [] };
  }

  if (camp.pending.kind === 'dwarfOffer') {
    const next: CampaignState = { ...camp, log: camp.log.slice() };
    next.pending = null;
    if (optionId === 'upgrade') {
      next.log.push({ day: next.day, kind: 'prep:dwarf-upgrade', text: 'The dwarf sets up his tools.' });
    } else {
      next.log.push({ day: next.day, kind: 'prep:dwarf-leave', text: 'The dwarf is sent on his way.' });
    }
    return { camp: next, events: [] };
  }

  if (camp.pending.kind === 'merchantShop') {
    const next: CampaignState = { ...camp, log: camp.log.slice() };
    next.pending = null;
    next.log.push({ day: next.day, kind: 'prep:merchant-leave', text: 'The merchant packs up and moves on.' });
    return { camp: next, events: [] };
  }

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

function resolveFinalDay(camp: CampaignState, mods: WorldModifiers, rng: Rng, out: RaidEvent[]): void {
  const label = 'the Throne Room';
  camp.dayTone = 'battle';
  let wave = activeParty(camp);

  if (!camp.party.some((m) => m.king)) {
    const alone = wave.length === 0;
    const king = makeKing(camp, mods, alone ? camp.waveIndex : wave[0].wave);
    king.doubledEffect = alone;
    camp.party = [...camp.party, king];
    wave = activeParty(camp);
    out.push({ t: 'kingArrives', defId: camp.setup.arthurDefId, alone, hp: king.hero.hp, maxHp: king.hero.maxHp });
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

  out.push({ t: 'throneGuardian', id: camp.setup.guardianId });

  const res = runCheckpoint({
    roomIndex: EDITABLE_ROOMS,
    built: { slot: { kind: 'empty' as const }, level: 1 },
    isThrone: true,
    party: wave.map((m) => ({
      hero: m.hero,
      def: heroDef(m.hero.defId),
      king: m.king,
      doubled: m.doubledEffect
    })),
    runtime: camp.monsters[EDITABLE_ROOMS],
    world: mods,
    talents: camp.setup.dungeon.talents,
    rng,
    lord: {
      level: camp.setup.dungeon.lordLevel,
      weaponId: camp.setup.dungeon.lordWeaponId,
      guardianId: camp.setup.guardianId
    },
    killedByTag: null
  });

  for (const e of res.events) out.push(e);
  for (const m of wave) {
    clearCombatScoped(m.hero, out);
    if (m.hero.hp <= 0) m.alive = false;
  }
  camp.monsters = camp.monsters.map((rt, i) => (i === EDITABLE_ROOMS ? res.runtime : rt));

  const reward = checkpointReward(camp.setup.tierScale, mods, res.wiped);
  camp.totals.gold += reward.gold;
  camp.totals.souls += reward.souls;

  if (res.wiped) {
    if (res.killedByTag) camp.knowledge[res.killedByTag] = (camp.knowledge[res.killedByTag] || 0) + 1;
    camp.dayTitle = 'Nekrokos Holds';
    camp.dayBody = `Wave ${camp.waveIndex} dies in ${label}. Word goes back for another.`;
    camp.log.push({ day: camp.day, kind: 'wipe', text: `Wave ${camp.waveIndex} wiped at ${label}.` });
    finish(camp, 'dungeonWin');
    return;
  }

  if (res.stalled) {
    queueProc(camp, res.procs);
    out.push({ t: 'stalled', room: EDITABLE_ROOMS });
    camp.dayTitle = 'A Long Standoff';
    camp.dayBody = 'Neither side breaks in the Throne Room. Nekrokos lets them go, and regroups at full strength for the next attempt.';
    camp.log.push({ day: camp.day, kind: 'stall', text: `${label} ended in a standoff.` });
    return;
  }

  camp.totals.checkpointsCleared += 1;
  camp.checkpoint += 1;
  camp.dayTitle = 'The Throne Falls';
  camp.dayBody = 'Nekrokos goes down. What is left of the party walks out with your gold.';
  camp.log.push({ day: camp.day, kind: 'breach', text: 'The Throne Room was breached.' });
  for (const m of wave) if (m.alive) camp.totals.goldStolen += m.hero.looted;
  finish(camp, 'heroVictory');
}

function resolveMilestoneBattle(camp: CampaignState, mods: WorldModifiers, rng: Rng, out: RaidEvent[]): void {
  const stop = milestoneAt(camp);
  const kind = stop ? stop.kind : 'mini';
  const label = kind === 'elite' ? 'the Elite Boss' : 'the Mini Boss';
  const buff = MILESTONE_HERO_BUFF[kind];
  const battleMods = buff === 1 ? mods : composeModifiers([mods, { heroAtk: buff, heroHp: buff }], CAMPAIGN_CLAMP);
  camp.dayTone = 'battle';

  let wave = activeParty(camp);
  if (wave.length === 0) {
    camp.dayTitle = 'No One Comes';
    camp.dayBody = 'Your halls stay silent. Nobody arrives to test them today.';
    camp.log.push({ day: camp.day, kind: 'empty-checkpoint', text: 'No party reached the gate.' });
    return;
  }

  let fallenTotal = 0;
  let outcome: 'cleared' | 'wiped' | 'fled' | 'stalled' = 'cleared';

  for (let i = 0; i < EDITABLE_ROOMS; i++) {
    wave = activeParty(camp);
    if (wave.length === 0) {
      outcome = 'wiped';
      break;
    }

    const wantsOut = wave.filter((m) => wantsToFlee(m.hero, heroDef(m.hero.defId), rng));
    if (wantsOut.length * 2 > wave.length) {
      out.push({ t: 'decision', intent: 'flee', note: fleeNote(wantsOut[0].hero, heroDef(wantsOut[0].hero.defId)) });
      out.push({ t: 'heroFlee', fromRoom: i });
      out.push({ t: 'reaction', kind: 'panic' });
      for (const m of wave) {
        m.fled = true;
        camp.totals.goldStolen += m.hero.looted;
      }
      outcome = 'fled';
      break;
    }

    const built = liveDungeon(camp).rooms[i] || { slot: { kind: 'empty' as const }, level: 1 };
    const res = runCheckpoint({
      roomIndex: i,
      built,
      isThrone: false,
      party: wave.map((m) => ({
        hero: m.hero,
        def: heroDef(m.hero.defId),
        king: m.king,
        doubled: m.doubledEffect
      })),
      runtime: camp.monsters[i],
      world: battleMods,
      talents: camp.setup.dungeon.talents,
      rng,
      lord: null,
      killedByTag: null
    });

    for (const e of res.events) out.push(e);
    for (const m of wave) {
      clearCombatScoped(m.hero, out);
      if (m.hero.hp <= 0) m.alive = false;
    }
    camp.monsters = camp.monsters.map((rt, idx) => (idx === i ? res.runtime : rt));

    const reward = checkpointReward(camp.setup.tierScale, battleMods, !res.wiped);
    camp.totals.gold += reward.gold;
    camp.totals.souls += reward.souls;
    fallenTotal += wave.filter((m) => !m.alive).length;

    if (res.wiped) {
      if (res.killedByTag) camp.knowledge[res.killedByTag] = (camp.knowledge[res.killedByTag] || 0) + 1;
      outcome = 'wiped';
      break;
    }
    if (res.stalled) {
      queueProc(camp, res.procs);
      outcome = 'stalled';
      break;
    }

    camp.totals.checkpointsCleared += 1;
    camp.checkpoint += 1;
    queueProc(camp, res.procs);
  }

  if (outcome === 'fled') {
    camp.dayTitle = 'They Turn Back';
    camp.dayBody = `The party breaks off during ${label} and runs for the entrance.`;
    camp.log.push({ day: camp.day, kind: 'flee', text: `Wave ${camp.waveIndex} withdrew from ${label}.` });
    callBackup(camp, mods, dayRng(camp, 3), out);
    return;
  }
  if (outcome === 'wiped') {
    camp.dayTitle = `${label} Holds`;
    camp.dayBody = `Wave ${camp.waveIndex} is broken during ${label}. Word goes back for another.`;
    camp.log.push({ day: camp.day, kind: 'wipe', text: `Wave ${camp.waveIndex} wiped at ${label}.` });
    callBackup(camp, mods, dayRng(camp, 4), out);
    return;
  }
  if (outcome === 'stalled') {
    camp.dayTitle = 'A Long Standoff';
    camp.dayBody = `Neither side breaks during ${label}. The party pulls back to try again.`;
    camp.log.push({ day: camp.day, kind: 'stall', text: `${label} ended in a standoff.` });
    return;
  }

  camp.dayTitle = `${label} Falls`;
  camp.dayBody =
    fallenTotal > 0
      ? `The party clears ${label}, ${fallenTotal} of them left behind, and pulls back from the gate.`
      : `The party clears ${label} intact and pulls back from the gate.`;
  camp.log.push({
    day: camp.day,
    kind: 'milestone',
    text: fallenTotal > 0 ? `${label} cleared; ${fallenTotal} dead.` : `${label} cleared.`
  });
}

const RANDOM_BATTLE_LEVEL_MULT: Record<MilestoneStop['kind'], number> = { mini: 1, elite: 1.15, final: 1.3 };

function resolveRandomBattle(camp: CampaignState, mods: WorldModifiers, rng: Rng, out: RaidEvent[]): void {
  camp.dayTone = 'battle';
  const ceiling = nextMilestone(camp);
  const stage = stageDef(camp.setup.stage);
  const pool = camp.setup.pool.length > 0 ? camp.setup.pool : HEROES.map((h) => h.id);
  const defId = pool[Math.floor(rng() * pool.length) % pool.length];
  const def = heroDef(defId);
  const level = Math.round(stage.heroLevel * RANDOM_BATTLE_LEVEL_MULT[ceiling.kind]);
  const record: HeroRecord = {
    uid: 'rb' + camp.seed.toString(36) + camp.day,
    defId,
    name: makeName(defId, rng).name,
    title: def.role,
    level,
    raids: 0,
    deaths: 0,
    scars: []
  };
  const result = simulateRaid(liveDungeon(camp), record, camp.setup.tierScale, { rng, world: mods });
  for (const e of result.events) out.push(e);
  camp.wallet.gold += result.gold;
  camp.wallet.souls += result.souls;
  camp.totals.gold += result.gold;
  camp.totals.souls += result.souls;
  if (result.outcome === 'dungeonWin') camp.totals.checkpointsCleared += 1;
  camp.dayTitle = result.outcome === 'dungeonWin' ? 'An Opportunist Falls' : 'An Opportunist Tries Their Luck';
  camp.dayBody =
    result.outcome === 'dungeonWin'
      ? `${record.name} the ${def.role} probes your dungeon and does not come back out.`
      : `${record.name} the ${def.role} probes your dungeon and gets away with some of your gold.`;
  camp.log.push({ day: camp.day, kind: 'random-battle', text: `${record.name} raided your dungeon.` });
}

function isPrepDay(camp: CampaignState): boolean {
  return camp.setup.milestoneDays.includes(camp.day + 1);
}

function resolveForcedPrep(camp: CampaignState): void {
  camp.dayTone = 'neutral';
  camp.dayTitle = 'The Road Splits';
  camp.dayBody = 'Before the next trial, three offers reach your gate.';
  camp.pending = {
    eventId: 'prep',
    kind: 'prep',
    title: 'The Road Splits',
    body: 'Before the next trial, three offers reach your gate.',
    options: [
      { id: 'merchant', label: 'Traveling Merchant', hint: 'Browse a fresh stock of traps and a monster, buy what you can afford.' },
      { id: 'dwarf', label: 'Wandering Dwarf', hint: 'Pay him to upgrade something you already have.' },
      { id: 'party', label: 'Campfire Council', hint: 'A campaign-wide buff for a few days.' }
    ]
  };
  camp.log.push({ day: camp.day, kind: 'prep', text: 'A prep-day offer reaches the gate.' });
}

function rollMerchantShop(camp: CampaignState): PendingChoice {
  const rng = dayRng(camp, 5);
  const trapPool = TRAPS.filter((t) => !camp.runUnlocked.includes(t.id));
  const monsterPool = MONSTERS.filter((m) => !camp.runUnlocked.includes(m.id));
  const pickTrap = () =>
    trapPool.length > 0
      ? trapPool[Math.floor(rng() * trapPool.length) % trapPool.length].id
      : TRAPS[Math.floor(rng() * TRAPS.length) % TRAPS.length].id;
  const t1 = pickTrap();
  let t2 = pickTrap();
  let guard = 0;
  while (t2 === t1 && trapPool.length > 1 && guard++ < 5) t2 = pickTrap();
  const monster =
    monsterPool.length > 0
      ? monsterPool[Math.floor(rng() * monsterPool.length) % monsterPool.length].id
      : MONSTERS[Math.floor(rng() * MONSTERS.length) % MONSTERS.length].id;

  return {
    eventId: 'prep-merchant',
    kind: 'merchantShop',
    title: 'Traveling Merchant',
    body: 'A merchant lays out her stock for you to pick through.',
    options: [{ id: 'leave', label: 'Leave', hint: 'Pack up and move on.' }],
    merchant: [
      { id: t1, kind: 'trap', cost: trapDef(t1).goldCost },
      { id: t2, kind: 'trap', cost: trapDef(t2).goldCost },
      { id: monster, kind: 'monster', cost: monsterDef(monster).goldCost }
    ]
  };
}

export function buyMerchantItem(camp: CampaignState, id: string): CampaignState {
  if (!camp.pending || camp.pending.kind !== 'merchantShop' || !camp.pending.merchant) return camp;
  const item = camp.pending.merchant.find((x) => x.id === id);
  if (!item || camp.runUnlocked.includes(id) || camp.wallet.gold < item.cost) return camp;
  return {
    ...camp,
    wallet: { ...camp.wallet, gold: camp.wallet.gold - item.cost },
    runUnlocked: [...camp.runUnlocked, id],
    log: [...camp.log, { day: camp.day, kind: 'prep:merchant-buy', text: `Bought ${(item.kind === 'trap' ? trapDef : monsterDef)(id).name} from the merchant.` }]
  };
}

function runIdCounts(rooms: RoomSlot[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slot of rooms) {
    if (slot.kind === 'empty') continue;
    counts[slot.id] = (counts[slot.id] || 0) + 1;
  }
  return counts;
}

export function placeRunRoom(camp: CampaignState, index: number, slot: RoomSlot): CampaignState {
  if (index < 0 || index >= EDITABLE_ROOMS) return camp;
  if (slot.kind !== 'empty') {
    const counts = runIdCounts(camp.runRooms);
    const here = camp.runRooms[index];
    const used = (counts[slot.id] || 0) - (here.kind !== 'empty' && here.id === slot.id ? 1 : 0);
    if (used >= MAX_PER_ID) return camp;
  }
  const runRooms = camp.runRooms.slice();
  runRooms[index] = slot;
  return { ...camp, runRooms };
}

export function levelRunContent(camp: CampaignState, id: string, goldCost: number): CampaignState {
  const level = camp.runLevels[id] || 1;
  const cost = upgradeCost(goldCost, level);
  if (camp.wallet.gold < cost) return camp;
  return {
    ...camp,
    wallet: { ...camp.wallet, gold: camp.wallet.gold - cost },
    runLevels: { ...camp.runLevels, [id]: level + 1 }
  };
}

export type { CampaignModifier, CampaignSetup, CampaignState, DayOutcome, DayTone, MilestoneStop, PartyMember, PendingChoice } from './campaignState';
export {
  CAMPAIGN_SHAPE,
  MAX_WAVES,
  MILESTONE_TABLE,
  waveSizeFor,
  activeParty,
  campaignFamily,
  campaignTier,
  daysToCheckpoint,
  familyEffect,
  familyHeroes,
  isCheckpointDay,
  isFinalDay,
  milestoneAt,
  normalizeCampaign
} from './campaignState';
export { dayEventWeights, eligibleEvents, upcomingTag, weightsFor } from './campaignEvents';
export type { WeightCtx } from './campaignEvents';
