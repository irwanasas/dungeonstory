'use client';

import { CHECKPOINTS } from '../../../game/types';
import type { DayTone, ExpeditionState } from '../../../game/state/expedition';
import { activeParty, daysToCheckpoint, isCheckpointDay } from '../../../game/state/expedition';
import { statusDef } from '../../../game/content/statuses';

const TONE_LABEL: Record<DayTone, string> = {
  blessed: 'fortune',
  cursed: 'ill omen',
  neutral: 'the road',
  omen: 'portent',
  battle: 'your gate'
};

interface DayPanelProps {
  exp: ExpeditionState;
  busy: boolean;
  onChoose: (optionId: string) => void;
  onNextDay: () => void;
  onFinish: () => void;
}

export function DayPanel({ exp, busy, onChoose, onNextDay, onFinish }: DayPanelProps) {
  const pending = exp.pending;
  const wave = activeParty(exp);
  const gap = daysToCheckpoint(exp);
  const tone: DayTone = exp.dayTone || 'neutral';
  const title = pending ? pending.title : exp.dayTitle;
  const body = pending ? pending.body : exp.dayBody;
  const done = exp.status === 'complete';

  const ahead = done
    ? 'the road ends'
    : isCheckpointDay(exp)
      ? 'they reach your gate'
      : gap === 1
        ? 'your gate tomorrow'
        : `your gate in ${gap} days`;

  return (
    <div className={'story tone-' + tone}>
      <div className="story-head">
        <span className="story-day">
          Day {exp.day}
          <span className="story-of">/{exp.setup.totalDays}</span>
        </span>
        <span className="story-track">
          {Math.min(exp.checkpoint + 1, CHECKPOINTS)} of {CHECKPOINTS} · {ahead}
        </span>
      </div>

      <div className="story-scroll">
        <div className="story-inner">
          <span className="story-tag">{TONE_LABEL[tone]}</span>
          <h2 className="story-title">{title}</h2>
          <p className="story-body">{body}</p>
          {exp.aura && <div className="story-aura">{exp.aura.label}</div>}
        </div>
      </div>

      <div className="story-party">
        {wave.length === 0 ? (
          <span className="story-none">No one on the road.</span>
        ) : (
          wave.map((m) => {
            const pct = Math.max(0, Math.min(100, (m.hero.hp / Math.max(1, m.hero.maxHp)) * 100));
            return (
              <div key={m.hero.uid} className={'story-hero' + (m.king ? ' king' : '')}>
                <span className="story-hero-top">
                  <span className="story-hero-name">{m.hero.name}</span>
                  <span className="story-hero-hp">
                    {Math.max(0, m.hero.hp)}/{m.hero.maxHp}
                  </span>
                </span>
                <span className="story-hero-bar">
                  <span className={'story-hero-fill' + (pct <= 32 ? ' low' : '')} style={{ width: pct + '%' }} />
                </span>
                {m.hero.status.length > 0 && (
                  <span className="story-hero-tags">
                    {m.hero.status.map((s) => (
                      <span key={s.kind} className={'badge ' + s.kind}>
                        {statusDef(s.kind).short}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="story-actions">
        {done ? (
          <button className="next btn" onClick={onFinish} disabled={busy}>
            See the report
          </button>
        ) : pending ? (
          pending.options.map((o) => (
            <button key={o.id} className="story-option btn" onClick={() => onChoose(o.id)} disabled={busy}>
              <span className="story-option-label">{o.label}</span>
              <span className="story-option-hint">{o.hint}</span>
            </button>
          ))
        ) : (
          <button className="next btn" onClick={onNextDay} disabled={busy}>
            {isCheckpointDay(exp) ? 'They reach your gate' : 'Next Day'}
          </button>
        )}
      </div>
    </div>
  );
}
