import type { HeroDef, HeroInstance, Intent, RaidEvent, TreasureDef } from '../types';
import { applyStatus, fleeThresholdOf, hasStatus, heal, traitBlocked } from './hero';
import type { Rng } from './rng';

export function hpPct(hero: HeroInstance): number {
  return hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
}

export function wantsToFlee(hero: HeroInstance, def: HeroDef, rng: Rng): boolean {
  const threshold = fleeThresholdOf(hero, def);
  if (threshold <= 0) return false;
  if (hpPct(hero) > threshold) return false;
  return rng() < 0.75;
}

export function fleeNote(hero: HeroInstance, def: HeroDef): string {
  if (hasStatus(hero, 'fear')) return `${hero.name} panics and bolts for the entrance.`;
  if (def.fleeThreshold >= 0.25) return `${hero.name} decides the loot is not worth dying for.`;
  return `${hero.name} is too badly hurt to go on.`;
}

export function decideLoot(def: HeroDef, treasure: TreasureDef, rng: Rng): Intent {
  const pull = Math.min(0.95, def.greed + treasure.lure);
  return rng() < pull ? 'loot' : 'ignoreLoot';
}

export function lootNote(hero: HeroInstance, taken: boolean, treasure: TreasureDef): string {
  return taken
    ? `${hero.name} cannot resist the ${treasure.name} and stops to fill their pack.`
    : `${hero.name} eyes the ${treasure.name} and keeps walking.`;
}

export function decideDisarm(hero: HeroInstance, def: HeroDef, rng: Rng): boolean {
  if (def.disarmChance <= 0) return false;
  if (traitBlocked(hero, 'dodge')) return false;
  return rng() < def.disarmChance;
}

export interface KingContext {
  doubled: boolean;
  ward: { hero: HeroInstance; def: HeroDef }[];
}

export function tryAbility(hero: HeroInstance, def: HeroDef, out: RaidEvent[], king?: KingContext): boolean {
  if (hero.cooldown > 0) {
    hero.cooldown -= 1;
    return false;
  }
  const pct = hpPct(hero);
  const x = king ? (king.doubled ? 2 : 1) : 1;

  if (def.ability.id === 'rage' && def.rage) {
    // The King does not rage at a third health. He refuses to die instead,
    // handled once at zero HP in combat.ts.
    if (king) return false;
    if (hero.raged || pct > def.rage.hpPct) return false;
    if (traitBlocked(hero, 'rage')) return false;
    hero.raged = true;
    hero.cooldown = 99;
    out.push({ t: 'ability', id: 'rage', name: def.ability.name });
    out.push({ t: 'reaction', kind: 'rage' });
    heal(hero, hero.maxHp * def.rage.healPct, out);
    return true;
  }

  if (def.ability.id === 'brace') {
    if (pct > 0.45 || hasStatus(hero, 'brace')) return false;
    hero.cooldown = 2;
    out.push({ t: 'ability', id: 'brace', name: def.ability.name });
    applyStatus(hero, 'brace', 2 * x, def, out);
    if (king) for (const w of king.ward) applyStatus(w.hero, 'brace', 2, w.def, out);
    return true;
  }

  if (def.ability.id === 'vanish') {
    const kind = king ? 'warded' : 'vanish';
    if (pct > 0.32 || hasStatus(hero, kind)) return false;
    if (traitBlocked(hero, 'dodge')) return false;
    hero.cooldown = 3;
    out.push({ t: 'ability', id: 'vanish', name: def.ability.name });
    applyStatus(hero, kind, 2 * x, def, out);
    return true;
  }

  if (def.ability.id === 'bloom') {
    if (pct > 0.52) return false;
    hero.cooldown = 4;
    out.push({ t: 'ability', id: 'bloom', name: def.ability.name });
    out.push({ t: 'reaction', kind: 'heal' });
    heal(hero, hero.maxHp * 0.15 * x, out);
    if (king) for (const w of king.ward) heal(w.hero, w.hero.maxHp * 0.15, out);
    return true;
  }

  // Death Mark and Surge are pure data for an ordinary hero, read during damage
  // computation rather than triggered here. The King's versions extend them in
  // the same place, in combat.ts.
  return false;
}
