export type Tag = 'physical' | 'fire' | 'poison' | 'frost' | 'arcane' | 'oil' | 'bind' | 'nature';

export type StatusKind =
  | 'poison'
  | 'burn'
  | 'chill'
  | 'weaken'
  | 'oiled'
  | 'bound'
  | 'fear'
  | 'greedy'
  | 'brace'
  | 'vanish';

export type TraitId = 'rage' | 'regen' | 'burst' | 'ramp' | 'dodge' | 'mitigate';

export interface StatusDef {
  kind: StatusKind;
  name: string;
  short: string;
  duration: number;
  dmgPerTick: number;
  evasionDelta: number;
  atkMult: number;
  defMult: number;
  fleeDelta: number;
  blocksTraits: TraitId[];
  tags: Tag[];
  desc: string;
}

export interface ActiveStatus {
  kind: StatusKind;
  ticksLeft: number;
  potency: number;
}

export interface Interaction {
  id: string;
  incomingTag: Tag;
  requiresStatus: StatusKind;
  consumes: boolean;
  dmgMult: number;
  applies?: StatusKind;
  name: string;
  hint: string;
}

export interface ComboTrophy {
  id: string;
  name: string;
  desc: string;
}

export interface Challenge {
  id: string;
  title: string;
  desc: string;
  stageMin?: number;
  soulReward: number;
}

export interface HeroAbility {
  id: string;
  name: string;
  blurb: string;
}

export type HeroFamily = 'warrior' | 'rogue' | 'mage';

export interface HeroDef {
  id: string;
  name: string;
  family: HeroFamily;
  role: string;
  color: string;
  hp: number;
  atk: number;
  def: number;
  evasion: number;
  mitigate: number;
  regen: number;
  burst: number;
  rampPerRound: number;
  rampCap: number;
  rage: { hpPct: number; atkMult: number; healPct: number } | null;
  fearImmune: boolean;
  resist: Tag[];
  vuln: Tag[];
  fleeThreshold: number;
  greed: number;
  disarmChance: number;
  ability: HeroAbility;
  strengths: string;
  weaknesses: string;
}

export interface MonsterDef {
  id: string;
  name: string;
  tag: Tag;
  hp: number;
  atk: number;
  def: number;
  hpPerLevel: number;
  atkPerLevel: number;
  hitsPerRound: number;
  cadence: number;
  strikesFirst: boolean;
  defPierce: number;
  evasion: number;
  splitAt: number;
  ranged: boolean;
  applies: { kind: StatusKind; days: number } | null;
  desc: string;
  goldCost: number;
  goldValue: number;
  soulValue: number;
}

export interface TrapDef {
  id: string;
  name: string;
  tag: Tag;
  damage: number;
  dmgPerLevel: number;
  applies: { kind: StatusKind; days: number } | null;
  desc: string;
  goldCost: number;
}

export interface TreasureDef {
  id: string;
  name: string;
  gold: number;
  goldPerLevel: number;
  lure: number;
  applies: { kind: StatusKind; days: number } | null;
  desc: string;
  goldCost: number;
}

export type RoomSlot =
  | { kind: 'empty' }
  | { kind: 'trap'; id: string }
  | { kind: 'monster'; id: string }
  | { kind: 'treasure'; id: string };

export type RoomKind = RoomSlot['kind'] | 'throne';

export interface BuiltRoom {
  slot: RoomSlot;
  level: number;
}

export interface Dungeon {
  rooms: BuiltRoom[];
  lordLevel: number;
  lordWeaponId: string;
}

export interface MonsterUnit {
  hp: number | null;
  status: ActiveStatus[];
  dead: boolean;
}

export interface MonsterRuntime {
  id: string;
  units: MonsterUnit[];
}

export type ExpTier = 'early' | 'mid' | 'late';

export interface StageDef {
  id: number;
  title: string;
  teaches: string;
  heroPool: string[];
  unlockTraps: string[];
  unlockMonsters: string[];
  unlockTreasure: string[];
  lordLevel: number;
  heroLevel: number;
}

export interface HeroRecord {
  uid: string;
  defId: string;
  name: string;
  title: string;
  level: number;
  raids: number;
  deaths: number;
  scars: Tag[];
}

export interface HeroSnapshot {
  uid: string;
  defId: string;
  name: string;
  title: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  scars: Tag[];
}

export interface HeroInstance extends HeroSnapshot {
  status: ActiveStatus[];
  raged: boolean;
  looted: number;
  cooldown: number;
}

export type ReactionKind =
  | 'surprise'
  | 'pain'
  | 'panic'
  | 'fear'
  | 'rage'
  | 'heal'
  | 'greed'
  | 'relief'
  | 'dead';

export type Intent = 'advance' | 'flee' | 'loot' | 'ignoreLoot' | 'disarm';

export type Outcome = 'dungeonWin' | 'heroEscape' | 'heroVictory';

export type RaidEvent =
  | { t: 'raidStart'; hero: HeroSnapshot }
  | { t: 'enterRoom'; room: number; kind: RoomKind; contentId: string | null }
  | { t: 'doorOpen'; room: number }
  | { t: 'decision'; intent: Intent; note: string }
  | { t: 'trapFire'; trapId: string; disarmed: boolean }
  | { t: 'monsterAppear'; monsterId: string; hp: number; maxHp: number }
  | { t: 'monsterSplit'; monsterId: string; hp: number; maxHp: number }
  | { t: 'heroAttack'; dmg: number; crit: boolean; miss: boolean; targetHp: number; targetMaxHp: number }
  | { t: 'enemyWindup'; ranged: boolean }
  | { t: 'ability'; id: string; name: string }
  | { t: 'interaction'; id: string; name: string; hint: string }
  | { t: 'damage'; source: 'trap' | 'monster' | 'lord'; tag: Tag; dmg: number; evaded: boolean; heroHp: number; heroMaxHp: number }
  | { t: 'heal'; amount: number; heroHp: number }
  | { t: 'statusOn'; kind: StatusKind }
  | { t: 'statusOff'; kind: StatusKind }
  | { t: 'statusTick'; kind: StatusKind; dmg: number; heroHp: number }
  | { t: 'monsterDown'; monsterId: string }
  | { t: 'roomClear'; room: number }
  | { t: 'treasureTaken'; treasureId: string; gold: number }
  | { t: 'lordAppear'; level: number; hp: number; maxHp: number }
  | { t: 'reaction'; kind: ReactionKind }
  | { t: 'heroDown' }
  | { t: 'stalled'; room: number }
  | { t: 'heroFlee'; fromRoom: number }
  | { t: 'raidEnd'; outcome: Outcome; gold: number; souls: number; goldStolen: number };

export interface RaidResult {
  events: RaidEvent[];
  outcome: Outcome;
  gold: number;
  souls: number;
  goldStolen: number;
  roomsCleared: number;
  hero: HeroSnapshot;
  killedByTag: Tag | null;
  survived: boolean;
}

export type EventCategory =
  | 'rumor'
  | 'news'
  | 'politics'
  | 'war'
  | 'disaster'
  | 'discovery'
  | 'celebration';

export type EventTone = 'good' | 'neutral' | 'bad';

export interface WorldEffect {
  heroAtk?: number;
  heroHp?: number;
  familyAtk?: Partial<Record<HeroFamily, number>>;
  familyHp?: Partial<Record<HeroFamily, number>>;
  monsterAtk?: number;
  monsterHp?: number;
  trapDamage?: number;
  tagDamage?: Partial<Record<Tag, number>>;
  gold?: number;
  souls?: number;
  heroBias?: string[];
}

export interface WorldEvent {
  id: string;
  headline: string;
  body: string;
  category: EventCategory;
  tone: EventTone;
  duration: number;
  effect?: WorldEffect;
  leadsTo?: { id: string; chance: number }[];
  minStage?: number;
}

export interface ActiveEvent {
  id: string;
  raidsLeft: number;
}

export interface WorldState {
  active: ActiveEvent[];
  queued: string[];
  history: string[];
  nextIn: number;
  unread: number;
}

export interface WorldModifiers {
  heroAtk: number;
  heroHp: number;
  familyAtk: Partial<Record<HeroFamily, number>>;
  familyHp: Partial<Record<HeroFamily, number>>;
  monsterAtk: number;
  monsterHp: number;
  trapDamage: number;
  tagDamage: Partial<Record<Tag, number>>;
  gold: number;
  souls: number;
  heroBias: string[];
}

export type DayEventCategory = 'blessed' | 'cursed' | 'neutral' | 'omen';

export type DayEventKind = 'narrative' | 'choice' | 'altar' | 'ecosystem';

export interface DayEventOption {
  id: string;
  label: string;
  hint: string;
  effect?: WorldEffect;
  days?: number;
  applyStatus?: { kind: StatusKind; days: number; to: 'party' | 'monsters' | 'both'; except?: string[] };
  healPct?: number;
}

export interface DayEvent {
  id: string;
  kind: DayEventKind;
  category: DayEventCategory;
  title: string;
  body: string;
  weight: number;
  tiers: ExpTier[];
  tags?: Tag[];
  requiresStatus?: StatusKind[];
  options: DayEventOption[];
}

export const EDITABLE_ROOMS = 5;
export const MAX_PER_ID = 2;
export const CHECKPOINTS = 6;
export const FAME_MAX = 20;
