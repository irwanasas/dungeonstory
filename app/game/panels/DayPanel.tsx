'use client';

import { CHECKPOINTS } from '../../../game/types';
import type { DayTone, CampaignState } from '../../../game/state/campaign';
import { activeParty, daysToCheckpoint, isCheckpointDay } from '../../../game/state/campaign';
import { statusDef } from '../../../game/content/statuses';
import { dayEvent } from '../../../game/content/dayEvents';
import { describeEffect } from '../../../game/state/world';

const STATUS_TO = { party: '', monsters: ' on monsters', both: ' on both' } as const;

// The pending choice only carries id/label/hint, so read the mechanics off the
// event definition it came from.
function optionEffect(pending: NonNullable<CampaignState['pending']>, optionId: string): string {
  if (pending.kind === 'proc') {
    const kind = pending.proc ? statusDef(pending.proc.kind).name : 'the effect';
    return optionId === 'amp' ? `${kind} potency x1.6` : `${kind} +2 days`;
  }
  const o = dayEvent(pending.eventId)?.options.find((x) => x.id === optionId);
  if (!o) return 'No effect';
  const parts = describeEffect(o.effect);
  if (o.effect && o.days !== undefined) parts.push(o.days < 0 ? 'permanent' : `for ${o.days} days`);
  if (o.applyStatus) {
    const a = o.applyStatus;
    parts.push(`${statusDef(a.kind).name}${STATUS_TO[a.to]}, ${a.days} days`);
  }
  if (o.healPct) parts.push(`+${Math.round(o.healPct * 100)}% Heal`);
  return parts.length > 0 ? parts.join(' · ') : 'No effect';
}

const TONE_LABEL: Record<DayTone, string> = {
  blessed: 'fortune',
  cursed: 'ill omen',
  neutral: 'the road',
  omen: 'portent',
  battle: 'your gate'
};

interface DayPanelProps {
  camp: CampaignState;
  busy: boolean;
  onChoose: (optionId: string) => void;
  onNextDay: () => void;
  onFinish: () => void;
}

export function DayPanel({ camp, busy, onChoose, onNextDay, onFinish }: DayPanelProps) {
  const pending = camp.pending;
  const wave = activeParty(camp);
  const gap = daysToCheckpoint(camp);
  const tone: DayTone = camp.dayTone || 'neutral';
  const title = pending ? pending.title : camp.dayTitle;
  const body = pending ? pending.body : camp.dayBody;
  const done = camp.status === 'complete';

  const ahead = done
    ? 'the road ends'
    : isCheckpointDay(camp)
      ? 'they reach your gate'
      : gap === 1
        ? 'your gate tomorrow'
        : `your gate in ${gap} days`;

  return (
    <div className={'story tone-' + tone}>
      <div className="story-head">
        <span className="story-day">
          Day {camp.day}
          <span className="story-of">/{camp.setup.totalDays}</span>
        </span>
        <span className="story-track">
          {Math.min(camp.checkpoint + 1, CHECKPOINTS)} of {CHECKPOINTS} · {ahead}
        </span>
      </div>

      <div className="story-scroll">
        <div className="story-inner">
          <span className="story-tag">{TONE_LABEL[tone]}</span>
          <h2 className="story-title">{title}</h2>
          <p className="story-body">{body}</p>
          {camp.aura && <div className="story-aura">{camp.aura.label}</div>}
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
              <span className="story-option-effect">{optionEffect(pending, o.id)}</span>
            </button>
          ))
        ) : (
          <button className="next btn" onClick={onNextDay} disabled={busy}>
            {isCheckpointDay(camp) ? 'They reach your gate' : 'Next Day'}
          </button>
        )}
      </div>
    </div>
  );
}
