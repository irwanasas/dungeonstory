'use client';

import { useEffect, useState } from 'react';
import type { RoomSlot } from '../../game/types';
import { EDITABLE_ROOMS } from '../../game/types';
import { trapDef } from '../../game/content/traps';
import { monsterDef } from '../../game/content/monsters';
import { treasureDef } from '../../game/content/treasure';
import { ICON, ROOM_VARIANT, contentArt } from './art';
import { CELL, type DirectorView } from './useRaidDirector';

function slotLabel(slot: RoomSlot): string {
  if (slot.kind === 'trap') return trapDef(slot.id).name;
  if (slot.kind === 'monster') return monsterDef(slot.id).name;
  if (slot.kind === 'treasure') return treasureDef(slot.id).name;
  return 'Empty';
}

interface Props {
  rooms: RoomSlot[];
  levels: Record<string, number>;
  selected: number;
  justPlaced: number;
  view: DirectorView;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (index: number) => void;
  onScrollRoom: (index: number) => void;
  speed: number;
  onSpeed: () => void;
  quiet?: boolean;
}

export default function DungeonView({
  rooms,
  levels,
  selected,
  justPlaced,
  view,
  scrollRef,
  onSelect,
  onScrollRoom,
  speed,
  onSpeed,
  quiet
}: Props) {
  const [pad, setPad] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setPad(Math.max(0, Math.round(el.clientWidth / 2 - CELL / 2)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || view.raiding) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        onScrollRoom(Math.max(-1, Math.min(EDITABLE_ROOMS, Math.round(el.scrollLeft / CELL) - 1)));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [onScrollRoom, scrollRef, view.raiding]);

  const cells = [-1, ...rooms.map((_, i) => i), EDITABLE_ROOMS];

  return (
    <div className={'stage' + (quiet ? ' quiet' : '')}>
      <div className={'scroll' + (view.raiding ? ' locked' : '')} ref={scrollRef}>
        <div className="world" style={{ ['--pad' as string]: `${pad}px` }}>
          <div className="pad" />
          <div className="track" style={{ position: 'relative', display: 'flex', height: '100%' }}>
            {cells.map((index) => {
              const isEntrance = index === -1;
              const isThrone = index === EDITABLE_ROOMS;
              const slot = !isEntrance && !isThrone ? rooms[index] : null;
              const variant = !isEntrance && !isThrone ? ' v-' + ROOM_VARIANT[index % ROOM_VARIANT.length] : '';
              const kindCls = isEntrance ? ' entrance' : isThrone ? ' throne' : variant;
              const lit = view.raiding ? view.litRoom === index : selected === index;
              const dim = view.raiding && view.litRoom >= 0 && view.litRoom !== index;
              return (
                <div
                  key={index}
                  className={
                    'cell' +
                    kindCls +
                    (lit ? ' lit' : '') +
                    (dim ? ' dim' : '') +
                    (!view.raiding && slot ? ' tappable' : '') +
                    (!view.raiding && selected === index ? ' selected' : '')
                  }
                  onClick={!view.raiding && slot ? () => onSelect(index) : undefined}
                >
                  {!isEntrance && (
                    <div className={'door' + (view.doorOpen >= index || (!view.raiding && index <= selected) ? ' open' : '')} />
                  )}
                  <div className="torch l">
                    <div className="torch-flame" />
                  </div>
                  <div className="torch r">
                    <div className="torch-flame" />
                  </div>
                  {view.flash && view.litRoom === index && (
                    <div key={view.flash.key} className={'flash on ' + view.flash.tag} />
                  )}
                  {!view.raiding && slot && (
                    <div className={'slot' + (slot.kind === 'empty' ? ' empty' : '') + (justPlaced === index ? ' placed' : '')}>
                      <img src={slot.kind === 'empty' ? ICON.build : contentArt(slot.kind, slot.id)} alt={slotLabel(slot)} />
                      <span className="slot-label">
                        {slot.kind === 'empty' ? `Room ${index + 1}` : slotLabel(slot)}
                        {slot.kind !== 'empty' && <span className="slot-lvl"> Lv{levels[slot.id] || 1}</span>}
                      </span>
                    </div>
                  )}
                  {!view.raiding && isThrone && (
                    <div className="slot">
                      <img src={ICON.lord} alt="Throne" />
                      <span className="slot-label">Throne</span>
                    </div>
                  )}
                  {!view.raiding && isEntrance && (
                    <div className="slot">
                      <span className="slot-label">Entrance</span>
                    </div>
                  )}
                </div>
              );
            })}

            {view.foes.map((f) => (
              <div key={f.slot} className={'actor foe ' + f.cls} style={{ ['--x' as string]: `${f.x}px` }}>
                <img src={f.art} alt="" />
              </div>
            ))}

            {view.party.map((a) =>
              a.shown ? (
                <div
                  key={a.index}
                  className={'actor hero ' + a.cls}
                  style={{
                    ['--x' as string]: `${a.x}px`,
                    transition: `transform ${a.ms}ms linear`
                  }}
                >
                  <img src={a.art} alt="" />
                  {a.badges.length > 0 && (
                    <div className="badges">
                      {a.badges.map((b) => (
                        <span key={b} className={'badge ' + b}>
                          {b.slice(0, 3).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.reaction && <div className="reaction">{a.reaction}</div>}
                </div>
              ) : null
            )}

            {view.bolt && (
              <div
                className={'bolt' + (view.bolt.arcane ? ' arcane' : '')}
                style={{ ['--x' as string]: `${view.bolt.x}px`, transition: `transform ${view.bolt.ms}ms linear` }}
              />
            )}

            {view.fx.map((f) => (
              <span
                key={f.key}
                className={'fx ' + f.cls}
                style={{ ['--x' as string]: `${f.x}px`, bottom: `calc(var(--floor) + ${52 + f.dy}px)` }}
              >
                {f.text}
              </span>
            ))}
          </div>
          <div className="pad" />
        </div>
      </div>

      <div className={'combat-hud' + (view.barsOn ? ' on' : '')}>
        {(['party', 'foe'] as const).map((side) => {
          const rows = view.bars.filter((b) => (side === 'foe' ? b.foe : !b.foe));
          if (rows.length === 0) return null;
          return (
            <div key={side} className={'bar-group' + (rows.length > 1 ? ' split' : '')}>
              {rows.map((b) => (
                <Bar key={b.id} bar={b} compact={rows.length > 1} />
              ))}
            </div>
          );
        })}
      </div>

      {view.callout && (
        <div className="callout" key={view.callout.key}>
          <span className={'callout-text' + (view.callout.danger ? ' danger' : '')}>{view.callout.text}</span>
        </div>
      )}

      <div className={'intent' + (view.intent ? ' on' : '')}>{view.intent}</div>

      {view.raiding && (
        <button className="speed pix" onClick={onSpeed} aria-label="Playback speed">
          {speed}&times;
        </button>
      )}
    </div>
  );
}

function Bar({ bar, compact }: { bar: import('./useRaidDirector').BarView; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, (bar.hp / Math.max(1, bar.maxHp)) * 100));
  return (
    <div className={'bar-row' + (compact ? ' compact' : '')}>
      <div className="bar-top">
        <span className="bar-name">{bar.name}</span>
        <span className="bar-hp">
          {compact ? Math.max(0, bar.hp) : `${Math.max(0, bar.hp)}/${bar.maxHp}`}
        </span>
      </div>
      <div className="bar">
        <div className={'bar-fill' + (bar.foe ? ' foe' : pct <= 32 ? ' low' : '')} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}
