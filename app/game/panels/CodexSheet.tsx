'use client';

import { useState } from 'react';
import { HEROES } from '../../../game/content/heroes';
import { CHALLENGES } from '../../../game/content/challenges';
import { LEGACY, TROPHIES } from '../../../game/content/milestones';
import { STAGES } from '../../../game/content/stages';
import type { GameState } from '../../../game/state/save';
import { ICON, heroArt } from '../art';
import { Sheet } from './Sheet';

type CodexTab = 'dungeon' | 'heroes' | 'challenges';

const TABS: { id: CodexTab; label: string }[] = [
  { id: 'dungeon', label: 'Dungeon' },
  { id: 'heroes', label: 'Heroes' },
  { id: 'challenges', label: 'Challenges' }
];

export function CodexSheet({ open, state, onClose }: { open: boolean; state: GameState; onClose: () => void }) {
  const [tab, setTab] = useState<CodexTab>('dungeon');
  const stage = STAGES[Math.min(STAGES.length, Math.max(1, state.stage)) - 1];
  const found = TROPHIES.filter((t) => state.unlockedMilestones.includes(t.id)).length;
  const done = CHALLENGES.filter((c) => state.unlockedMilestones.includes(c.id)).length;

  return (
    <Sheet open={open} title="Codex" onClose={onClose}>
      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t.id} className={'subtab btn' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dungeon' && (
        <>
          {state.mode === 'rush' && (
            <>
              <div className="sheet-group">This Stage</div>
              <div className="row plate">
                <span className="row-body">
                  <span className="row-name">
                    {stage.id}. {stage.title}
                  </span>
                  <span className="row-hint">{stage.teaches}</span>
                </span>
              </div>
            </>
          )}
          <div className="sheet-group">
            Trophies {found}/{TROPHIES.length}
          </div>
          {TROPHIES.map((t) => {
            const got = state.unlockedMilestones.includes(t.id);
            const reveal = got || t.discoveryType === 'collection';
            return (
              <div key={t.id} className={'row inset' + (got ? '' : ' locked')}>
                <span className="row-body">
                  <span className="row-name">{reveal ? t.name : '???'}</span>
                  <span className="row-hint">{reveal ? t.desc : 'Not yet discovered.'}</span>
                </span>
              </div>
            );
          })}
        </>
      )}

      {tab === 'heroes' && (
        <>
          <div className="sheet-group">Heroes You Have Met</div>
          {HEROES.map((h) => {
            const met = state.roster.some((r) => r.defId === h.id) || state.stats.raids > 0;
            return (
              <div key={h.id} className={'row inset' + (met ? '' : ' locked')}>
                <img src={met ? heroArt(h.id) : ICON.lock} alt="" />
                <span className="row-body">
                  <span className="row-name">
                    {h.name}
                    <span className="row-lvl">{h.role}</span>
                  </span>
                  {met ? (
                    <>
                      <span className="row-desc">{h.strengths}</span>
                      <span className="row-hint">{h.weaknesses}</span>
                    </>
                  ) : (
                    <span className="row-desc">Not yet seen in your dungeon.</span>
                  )}
                </span>
              </div>
            );
          })}

          <div className="sheet-group">Veterans</div>
          {state.roster.length === 0 && (
            <div className="row inset">
              <span className="row-body">
                <span className="row-desc">No hero has survived long enough to matter. Yet.</span>
              </span>
            </div>
          )}
          {state.roster.map((r) => (
            <div key={r.uid} className="row inset">
              <img src={heroArt(r.defId)} alt="" />
              <span className="row-body">
                <span className="row-name">
                  {r.name} {r.title}
                  <span className="row-lvl">Lv{r.level}</span>
                </span>
                <span className="row-desc">
                  {r.raids} raids &middot; {r.deaths} deaths
                </span>
                {r.scars.length > 0 && (
                  <span className="row-hint">
                    {r.scars.map((s) => (
                      <span key={s} className="codex-tag good">
                        {s} resist
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          ))}

          <div className="sheet-group">Hall of Fame</div>
          {state.hallOfFame.length === 0 && (
            <div className="row inset">
              <span className="row-body">
                <span className="row-desc">No hero has earned a place here. They rarely last that long.</span>
              </span>
            </div>
          )}
          {state.hallOfFame.map((e) => {
            const def = LEGACY.find((l) => l.id === e.milestoneId);
            return (
              <div key={e.uid + e.milestoneId} className="row inset">
                <span className="row-body">
                  <span className="row-name">
                    {e.heroName} {e.title}
                    <span className="row-lvl">{def ? def.name : e.milestoneId}</span>
                  </span>
                  <span className="row-hint">{def ? def.desc : ''}</span>
                </span>
              </div>
            );
          })}
        </>
      )}

      {tab === 'challenges' && (
        <>
          <div className="sheet-group">
            Mastery {done}/{CHALLENGES.length}
          </div>
          {CHALLENGES.map((c) => {
            const got = state.unlockedMilestones.includes(c.id);
            return (
              <div key={c.id} className={'row inset' + (got ? '' : ' locked')}>
                <span className="row-body">
                  <span className="row-name">
                    {got ? '✓ ' : ''}
                    {c.title}
                    <span className="row-lvl">
                      {c.soulReward} {c.soulReward === 1 ? 'soul' : 'souls'}
                    </span>
                  </span>
                  <span className="row-hint">{c.desc}</span>
                  {c.stageMin && !got && <span className="row-hint">Stage {c.stageMin} or later.</span>}
                </span>
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
