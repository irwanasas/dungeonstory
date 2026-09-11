import type { TalentBonus } from '../types';

export type TalentKind = 'hp' | 'atk' | 'def' | 'trap';

export interface TalentNode {
  index: number;
  kind: TalentKind;
  amount: number;
  soulCost: number;
}

export const TALENT_MAX = 30;

const PATTERN: TalentKind[] = ['hp', 'atk', 'hp', 'def', 'atk', 'trap'];
const BASE: Record<TalentKind, number> = { hp: 5, atk: 2, def: 1, trap: 2 };

export const TALENT_NAME: Record<TalentKind, string> = {
  hp: 'Deep Roots',
  atk: 'Sharpened Fangs',
  def: 'Stone Hide',
  trap: 'Cruel Mechanisms'
};

export const TALENT_DELTA: Record<TalentKind, string> = {
  hp: 'HP',
  atk: 'atk',
  def: 'def',
  trap: 'trap dmg'
};

export const TALENTS: TalentNode[] = Array.from({ length: TALENT_MAX }, (_, i) => {
  const kind = PATTERN[i % PATTERN.length];
  const tier = Math.floor(i / PATTERN.length) + 1;
  return {
    index: i,
    kind,
    amount: BASE[kind] * tier,
    soulCost: Math.round(2 * Math.pow(1.12, i))
  };
});

export const NO_TALENTS: TalentBonus = { hp: 0, atk: 0, def: 0, trapDmg: 0 };

export function talentBonus(level: number): TalentBonus {
  const bought = Math.max(0, Math.min(TALENT_MAX, Math.floor(level) || 0));
  const bonus: TalentBonus = { ...NO_TALENTS };
  for (let i = 0; i < bought; i++) {
    const node = TALENTS[i];
    if (node.kind === 'hp') bonus.hp += node.amount;
    else if (node.kind === 'atk') bonus.atk += node.amount;
    else if (node.kind === 'def') bonus.def += node.amount;
    else bonus.trapDmg += node.amount;
  }
  return bonus;
}

export function talentCost(level: number): number | null {
  const node = TALENTS[Math.max(0, Math.floor(level) || 0)];
  return node ? node.soulCost : null;
}
