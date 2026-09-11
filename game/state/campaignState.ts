import type {
  CampaignTier,
  Dungeon,
  HeroFamily,
  HeroInstance,
  HeroRecord,
  MonsterRuntime,
  Outcome,
  RaidEvent,
  StatusKind,
  Tag,
  WorldEffect
} from '../types';
import { CAMPAIGN_MAX, CHECKPOINTS, EDITABLE_ROOMS } from '../types';
import { dayEvent } from '../content/dayEvents';
import { NO_TALENTS } from '../content/talents';
import { HEROES } from '../content/heroes';

export const CAMPAIGN_SHAPE = 3;

export const GAP: Record<CampaignTier, number> = { early: 3, mid: 4, late: 5 };

const FAMILY_CYCLE: HeroFamily[] = ['warrior', 'rogue', 'mage'];

export function campaignFamily(n: number): HeroFamily {
  return FAMILY_CYCLE[(Math.max(1, n) - 1) % FAMILY_CYCLE.length];
}

export function familyHeroes(family: HeroFamily): string[] {
  return HEROES.filter((h) => h.family === family).map((h) => h.id);
}

export const MAX_WAVES = 3;

export function waveSizeFor(n: number): number {
  return n <= 3 ? 1 : n <= 7 ? 2 : 3;
}

export function campaignTier(n: number): CampaignTier {
  return n <= 3 ? 'early' : n <= 6 ? 'mid' : 'late';
}

export function familyEffect(n: number): WorldEffect {
  return { heroBias: familyHeroes(campaignFamily(n)) };
}

export interface CampaignSetup {
  campaignNumber: number;
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

export function normalizeCampaign(input: unknown): CampaignState | null {
  if (!input || typeof input !== 'object') return null;
  const e = input as Partial<CampaignState>;
  const setup = e.setup;
  if (e.shape !== CAMPAIGN_SHAPE) return null;
  if (!setup || typeof setup !== 'object') return null;
  if (!Array.isArray(setup.checkpointDays) || setup.checkpointDays.length !== CHECKPOINTS) return null;
  if (typeof setup.totalDays !== 'number' || setup.totalDays < CHECKPOINTS) return null;
  if (typeof setup.campaignNumber !== 'number' || setup.campaignNumber < 1 || setup.campaignNumber > CAMPAIGN_MAX)
    return null;
  if (!setup.dungeon || !Array.isArray(setup.dungeon.rooms)) return null;
  if (!setup.dungeon.talents) setup.dungeon.talents = { ...NO_TALENTS };
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

export function isCheckpointDay(camp: CampaignState): boolean {
  return camp.setup.checkpointDays.includes(camp.day);
}

export function daysToCheckpoint(camp: CampaignState): number {
  for (const d of camp.setup.checkpointDays) if (d >= camp.day) return d - camp.day;
  return 0;
}

export function livingMembers(camp: CampaignState): PartyMember[] {
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
