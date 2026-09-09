import type { Dungeon, HeroRecord, Outcome, RaidEvent, RaidResult, Tag, WorldModifiers } from '../types';
import { EDITABLE_ROOMS } from '../types';
import { heroDef } from '../content/heroes';
import { raidRewards } from '../state/economy';
import { noWorld } from '../state/world';
import { advanceStatuses, buildHero, snapshot } from './hero';
import { fleeNote, wantsToFlee } from './ai';
import { runCheckpoint, type CombatMember } from './checkpoint';
import { systemRng, type Rng } from './rng';

export interface RaidOptions {
  rng?: Rng;
  collectEvents?: boolean;
  world?: WorldModifiers;
}

export function simulateRaid(dungeon: Dungeon, record: HeroRecord, tier: number, options: RaidOptions = {}): RaidResult {
  const rng = options.rng || systemRng;
  const collect = options.collectEvents !== false;
  const world = options.world || noWorld();
  const hero = buildHero(record, world);
  const def = heroDef(record.defId);
  const events: RaidEvent[] = [];
  const party: CombatMember[] = [{ hero, def }];
  let killedByTag: Tag | null = null;

  const start = snapshot(hero);
  events.push({ t: 'raidStart', hero: start });

  let outcome: Outcome = 'heroVictory';
  let roomsEntered = 0;
  let fled = false;
  let died = false;

  for (let i = 0; i < EDITABLE_ROOMS; i++) {
    const built = dungeon.rooms[i] || { slot: { kind: 'empty' as const }, level: 1 };

    if (wantsToFlee(hero, def, rng)) {
      events.push({ t: 'decision', intent: 'flee', note: fleeNote(hero, def) });
      events.push({ t: 'heroFlee', fromRoom: i });
      events.push({ t: 'reaction', kind: 'panic' });
      fled = true;
      break;
    }

    roomsEntered += 1;
    const res = runCheckpoint({
      roomIndex: i,
      built,
      isThrone: false,
      party,
      runtime: null,
      world,
      rng,
      lord: null,
      killedByTag,
      foeCap: 1
    });
    events.push(...res.events);
    killedByTag = res.killedByTag;

    if (res.wiped) {
      died = true;
      break;
    }

    advanceStatuses(hero, events);
    if (hero.hp > 0) events.push({ t: 'roomClear', room: i });
  }

  if (died) {
    events.push({ t: 'reaction', kind: 'dead' });
    events.push({ t: 'heroDown' });
    outcome = 'dungeonWin';
  } else if (fled) {
    outcome = 'heroEscape';
  } else {
    if (wantsToFlee(hero, def, rng)) {
      events.push({ t: 'decision', intent: 'flee', note: `${hero.name} sees the throne doors and turns back.` });
      events.push({ t: 'heroFlee', fromRoom: EDITABLE_ROOMS });
      events.push({ t: 'reaction', kind: 'panic' });
      outcome = 'heroEscape';
    } else {
      roomsEntered += 1;
      const res = runCheckpoint({
        roomIndex: EDITABLE_ROOMS,
        built: { slot: { kind: 'empty' as const }, level: 1 },
        isThrone: true,
        party,
        runtime: null,
        world,
        rng,
        lord: { level: dungeon.lordLevel, weaponId: dungeon.lordWeaponId },
        killedByTag
      });
      events.push(...res.events);
      killedByTag = res.killedByTag;

      if (res.wiped) {
        events.push({ t: 'reaction', kind: 'dead' });
        events.push({ t: 'heroDown' });
        outcome = 'dungeonWin';
      } else if (res.cleared) {
        outcome = 'heroVictory';
      } else {
        events.push({ t: 'heroFlee', fromRoom: EDITABLE_ROOMS });
        outcome = 'heroEscape';
      }
    }
  }

  const survived = outcome !== 'dungeonWin';
  const base = raidRewards(outcome, roomsEntered, tier, world);
  const goldStolen = survived ? hero.looted : 0;
  const gold = Math.max(0, base.gold - goldStolen);

  events.push({ t: 'raidEnd', outcome, gold, souls: base.souls, goldStolen });

  return {
    events: collect ? events : [],
    outcome,
    gold,
    souls: base.souls,
    goldStolen,
    roomsCleared: roomsEntered,
    hero: start,
    killedByTag,
    survived
  };
}
