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
  Tag,
  WorldEffect,
  WorldEvent,
  WorldModifiers,
  WorldState
} from '../types';
import { CAMPAIGN_MAX, CHECKPOINTS, EDITABLE_ROOMS, FAME_MAX } from '../types';
import { dayEvent, procFlavour } from '../content/dayEvents';
import { MONSTERS, monsterDef } from '../content/monsters';
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
import { seeded, type Rng } from '../sim/rng';
import { checkpointReward, toDungeon } from './economy';
import { absorbResult } from './roster';
import { composeModifiers, activeEffects, tickWorld, CAMPAIGN_CLAMP } from './world';
import type { GameState } from './save';

import type { CampaignState, DayOutcome, PartyMember } from './campaignState';
import {
  CAMPAIGN_SHAPE,
  MAX_WAVES,
  activeParty,
  campaignTier,
  daysToCheckpoint,
  familyEffect,
  isCheckpointDay,
  waveSizeFor
} from './campaignState';
import { applyOption, decayMods, pickEvent, toPending } from './campaignEvents';
import { GAP } from './campaignState';

const KEPT_EVENTS = new Set(['interaction', 'monsterSplit', 'trapFire', 'monsterDown', 'treasureTaken']);

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
  const gap = GAP[tier];
  const totalDays = gap * CHECKPOINTS;
  const checkpointDays: number[] = [];
  for (let i = 1; i <= CHECKPOINTS; i++) checkpointDays.push(gap * i);

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

  return { state: next, fired: turned.fired };
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
  const tier = campaignTier(state.campaignNumber);
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
  // If the only checkpoint left is the Throne, no relief column can reach it in
  // time. Nobody else is coming, and the King arrives alone.
  const nextCheckpoint = camp.setup.checkpointDays.find((d) => d > camp.day);
  if (nextCheckpoint === undefined || nextCheckpoint >= camp.setup.totalDays || camp.waveIndex >= MAX_WAVES) {
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
    talents: camp.setup.dungeon.talents,
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

export type { CampaignModifier, CampaignSetup, CampaignState, DayOutcome, DayTone, PartyMember, PendingChoice } from './campaignState';
export {
  CAMPAIGN_SHAPE,
  MAX_WAVES,
  waveSizeFor,
  actingMember,
  activeParty,
  campaignFamily,
  campaignTier,
  daysToCheckpoint,
  familyEffect,
  familyHeroes,
  isCheckpointDay,
  normalizeCampaign
} from './campaignState';
export { dayEventWeights, eligibleEvents, upcomingTag, weightsFor } from './campaignEvents';
export type { WeightCtx } from './campaignEvents';
