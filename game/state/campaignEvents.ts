import type { DayEvent, DayEventOption, MonsterUnit, RaidEvent, StatusKind, Tag } from '../types';
import { EDITABLE_ROOMS } from '../types';
import { DAY_EVENTS } from '../content/dayEvents';
import { INTERACTIONS } from '../content/interactions';
import { monsterDef } from '../content/monsters';
import { trapDef } from '../content/traps';
import { lordWeapon } from '../content/lordWeapons';
import { heroDef } from '../content/heroes';
import { applyStatus, applyStatusToUnit, heal } from '../sim/hero';
import type { Rng } from '../sim/rng';
import type { CampaignModifier, CampaignState, PendingChoice } from './campaignState';
import { daysToCheckpoint, livingMembers } from './campaignState';

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

export function setupStatusesFor(tag: Tag): StatusKind[] {
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

export function overlapScore(e: DayEvent, roomTag: Tag | null): number {
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

export function pickEvent(camp: CampaignState, rng: Rng): DayEvent | null {
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

export function toPending(e: DayEvent): PendingChoice {
  return {
    eventId: e.id,
    kind: e.kind === 'narrative' ? 'choice' : e.kind,
    title: e.title,
    body: e.body,
    options: e.options.map((o) => ({ id: o.id, label: o.label, hint: o.hint }))
  };
}

export function applyOption(camp: CampaignState, e: DayEvent, option: DayEventOption, out: RaidEvent[]): void {
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

export function decayMods(camp: CampaignState): void {
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
