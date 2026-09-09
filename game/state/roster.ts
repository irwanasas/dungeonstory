import type { HeroRecord, RaidResult } from '../types';
import { makeName, makeUid, SCAR_TITLE } from '../content/names';
import type { Rng } from '../sim/rng';

const ROSTER_CAP = 6;
const LEVEL_CAP = 15;

function newHero(defId: string, level: number, rng: Rng): HeroRecord {
  const { name, title } = makeName(defId, rng);
  return { uid: makeUid(), defId, name, title, level: Math.max(1, level), raids: 0, deaths: 0, scars: [] };
}

export function pickRaider(roster: HeroRecord[], pool: string[], level: number, rng: Rng, bias: string[] = []): HeroRecord {
  const favoured = bias.filter((id) => pool.includes(id));
  const draw = favoured.length > 0 && rng() < 0.6 ? favoured : pool;

  const veterans = roster.filter((h) => draw.includes(h.defId));
  if (veterans.length > 0 && rng() < 0.55) {
    const chosen = veterans[Math.floor(rng() * veterans.length) % veterans.length];
    return { ...chosen, level: Math.max(chosen.level, level) };
  }
  const defId = draw[Math.floor(rng() * draw.length) % draw.length] || 'paladin';
  return newHero(defId, level, rng);
}

export function absorbResult(
  roster: HeroRecord[],
  raider: HeroRecord,
  result: Pick<RaidResult, 'survived' | 'killedByTag'>
): HeroRecord[] {
  const next: HeroRecord = {
    ...raider,
    raids: raider.raids + 1,
    level: Math.min(LEVEL_CAP, raider.level + 1),
    scars: raider.scars.slice()
  };

  if (!result.survived) {
    next.deaths += 1;
    const tag = result.killedByTag;
    if (tag && !next.scars.includes(tag) && next.scars.length < 2) {
      next.scars.push(tag);
      next.title = SCAR_TITLE[tag] || next.title;
    }
  }

  const rest = roster.filter((h) => h.uid !== next.uid);
  rest.unshift(next);
  return rest.slice(0, ROSTER_CAP);
}

export function returningNote(record: HeroRecord): string | null {
  if (record.raids === 0) return null;
  if (record.deaths > 0 && record.scars.length > 0) {
    return `Back again — and this time ${record.scars.join(' and ')} will not work.`;
  }
  return `Back for raid ${record.raids + 1}. Stronger than last time.`;
}
