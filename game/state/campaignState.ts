import type {
  CampaignTier,
  Dungeon,
  HeroFamily,
  HeroInstance,
  HeroRecord,
  MonsterRuntime,
  Outcome,
  RaidEvent,
  RoomSlot,
  StatusKind,
  Tag,
  WorldEffect
} from '../types';
import { CAMPAIGN_MAX, EDITABLE_ROOMS } from '../types';
import { dayEvent } from '../content/dayEvents';
import { NO_TALENTS } from '../content/talents';
import { HEROES } from '../content/heroes';

export const CAMPAIGN_SHAPE = 4;

export interface MilestoneStop {
  day: number;
  kind: 'mini' | 'elite' | 'final';
}

export const MILESTONE_TABLE: Record<CampaignTier, MilestoneStop[]> = {
  early: [
    { day: 10, kind: 'mini' },
    { day: 20, kind: 'final' }
  ],
  mid: [
    { day: 20, kind: 'mini' },
    { day: 40, kind: 'final' }
  ],
  late: [
    { day: 20, kind: 'mini' },
    { day: 40, kind: 'elite' },
    { day: 60, kind: 'final' }
  ]
};

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
  return n <= 3 ? 'early' : n <= 7 ? 'mid' : 'late';
}

export function familyEffect(n: number): WorldEffect {
  return { heroBias: familyHeroes(campaignFamily(n)) };
}

export interface CampaignSetup {
  campaignNumber: number;
  tier: CampaignTier;
  totalDays: number;
  milestoneDays: number[];
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
  source: 'choice' | 'altar';
  label: string;
  daysLeft: number;
  effect: WorldEffect;
}

export interface PendingChoice {
  eventId: string;
  kind: 'choice' | 'altar' | 'ecosystem' | 'proc' | 'prep' | 'dwarfOffer' | 'merchantShop';
  title: string;
  body: string;
  options: { id: string; label: string; hint: string }[];
  proc?: { kind: StatusKind; uid: string; trapId: string };
  merchant?: { id: string; kind: 'trap' | 'monster'; cost: number }[];
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
  wallet: { gold: number; souls: number };
  runRooms: RoomSlot[];
  runLevels: Record<string, number>;
  runUnlocked: string[];
  outcome: Outcome | null;
}

export const CAMPAIGN_START_UNLOCKED = ['spike', 'goblin'];

export const CAMPAIGN_START_WALLET = { gold: 50, souls: 10 };

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
  if (!Array.isArray(setup.milestoneDays) || setup.milestoneDays.length < 2 || setup.milestoneDays.length > 3)
    return null;
  if (typeof setup.totalDays !== 'number' || setup.totalDays !== setup.milestoneDays[setup.milestoneDays.length - 1])
    return null;
  if (typeof setup.campaignNumber !== 'number' || setup.campaignNumber < 1 || setup.campaignNumber > CAMPAIGN_MAX)
    return null;
  if (!setup.dungeon || !Array.isArray(setup.dungeon.rooms)) return null;
  if (!setup.dungeon.talents) setup.dungeon.talents = { ...NO_TALENTS };
  if (typeof e.day !== 'number' || e.day < 1 || e.day > setup.totalDays + 1) return null;
  if (!Array.isArray(e.party) || e.party.length === 0) return null;
  if (!Array.isArray(e.monsters) || e.monsters.length !== EDITABLE_ROOMS + 1) return null;
  if (e.status !== 'active' && e.status !== 'complete') return null;
  if (e.pending && (!Array.isArray(e.pending.options) || e.pending.options.length === 0)) return null;
  const CAMPAIGN_KINDS = new Set(['proc', 'prep', 'dwarfOffer', 'merchantShop']);
  if (e.pending && !CAMPAIGN_KINDS.has(e.pending.kind) && !dayEvent(e.pending.eventId)) return null;
  if (e.pending && e.pending.kind === 'proc' && !e.pending.proc) return null;
  if (e.pending && e.pending.kind === 'merchantShop' && !Array.isArray(e.pending.merchant)) return null;
  for (const m of e.party) {
    if (!m || !m.hero || typeof m.hero.hp !== 'number' || !Array.isArray(m.hero.status)) return null;
  }
  if (!e.wallet || typeof e.wallet.gold !== 'number' || typeof e.wallet.souls !== 'number') {
    e.wallet = { ...CAMPAIGN_START_WALLET };
  }
  if (!Array.isArray(e.runRooms) || e.runRooms.length !== EDITABLE_ROOMS) {
    e.runRooms = Array.from({ length: EDITABLE_ROOMS }, () => ({ kind: 'empty' as const }));
  }
  if (!e.runLevels || typeof e.runLevels !== 'object') e.runLevels = {};
  if (!Array.isArray(e.runUnlocked)) e.runUnlocked = [...CAMPAIGN_START_UNLOCKED];
  return e as CampaignState;
}

export function isCheckpointDay(camp: CampaignState): boolean {
  return camp.setup.milestoneDays.includes(camp.day);
}

export function isFinalDay(camp: CampaignState): boolean {
  return camp.day >= camp.setup.totalDays;
}

export function milestoneAt(camp: CampaignState): MilestoneStop | undefined {
  return MILESTONE_TABLE[camp.setup.tier].find((m) => m.day === camp.day);
}

export function nextMilestone(camp: CampaignState): MilestoneStop {
  const table = MILESTONE_TABLE[camp.setup.tier];
  return table.find((m) => m.day > camp.day) ?? table[table.length - 1];
}

export function daysToCheckpoint(camp: CampaignState): number {
  for (const d of camp.setup.milestoneDays) if (d >= camp.day) return d - camp.day;
  return 0;
}

export function livingMembers(camp: CampaignState): PartyMember[] {
  return camp.party.filter((m) => m.alive && !m.fled);
}

export function activeParty(camp: CampaignState): PartyMember[] {
  const living = livingMembers(camp);
  if (living.length === 0) return [];
  const wave = Math.max(...living.map((m) => m.wave));
  return living.filter((m) => m.wave === wave);
}
