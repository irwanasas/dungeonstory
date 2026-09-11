'use client';

import { useEffect, useRef } from 'react';
import { TALENTS, TALENT_DELTA, TALENT_MAX, TALENT_NAME, talentBonus } from '../../../game/content/talents';
import type { GameState } from '../../../game/state/save';
import { ICON } from '../art';

interface TalentProps {
  state: GameState;
  onBuy: (index: number, souls: number) => void;
}

export function TalentPanel({ state, onBuy }: TalentProps) {
  const owned = state.talentLevel;
  const total = talentBonus(owned);
  const ladder = [...TALENTS].reverse();
  const active = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (active.current) active.current.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div className="talents">
      <div className="talent-sum">
        <span className="talent-sum-title">
          Dungeon Talents<span className="row-lvl">{owned}/{TALENT_MAX}</span>
        </span>
        <span className="talent-sum-body">
          Every monster and trap you own carries these. +{total.hp} HP&nbsp;&nbsp;+{total.atk} atk&nbsp;&nbsp;+
          {total.def} def&nbsp;&nbsp;+{total.trapDmg} trap dmg
        </span>
      </div>

      <div className="talent-track">
        {ladder.map((node) => {
          const bought = node.index < owned;
          const next = node.index === owned;
          const afford = state.souls >= node.soulCost;
          const cls = bought ? 'on' : next ? 'next' : 'off';
          return (
            <div key={node.index} className={'talent-node ' + cls} ref={next ? active : undefined}>
              <span className="talent-link" />
              <button
                className={'talent-hex btn'}
                disabled={!next || !afford}
                onClick={() => onBuy(node.index, node.soulCost)}
              >
                <span className="talent-amt">+{node.amount}</span>
                <span className="talent-kind">{TALENT_DELTA[node.kind]}</span>
              </button>
              <span className="talent-info">
                <span className="talent-name">{TALENT_NAME[node.kind]}</span>
                {bought ? (
                  <span className="talent-state">Learned</span>
                ) : (
                  <span className={'talent-cost' + (next && afford ? '' : ' cant')}>
                    <img src={ICON.soul} alt="" />
                    {node.soulCost}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
