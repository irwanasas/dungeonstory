'use client';

import type { CampaignState } from '../../../game/state/campaign';
import { monsterDef } from '../../../game/content/monsters';
import { trapDef } from '../../../game/content/traps';
import { ICON, contentArt } from '../art';
import { Sheet } from './Sheet';

interface MerchantShopProps {
  open: boolean;
  camp: CampaignState;
  onBuy: (id: string) => void;
  onClose: () => void;
}

export function MerchantShopPanel({ open, camp, onBuy, onClose }: MerchantShopProps) {
  const items = camp.pending && camp.pending.kind === 'merchantShop' ? camp.pending.merchant || [] : [];

  return (
    <Sheet open={open} title="Traveling Merchant" onClose={onClose}>
      <div className="sheet-rule">A fresh stock for this visit only. Anything you don&apos;t buy is gone when you leave.</div>
      {items.map((item) => {
        const def = item.kind === 'trap' ? trapDef(item.id) : monsterDef(item.id);
        const bought = camp.runUnlocked.includes(item.id);
        const affordable = camp.wallet.gold >= item.cost;
        return (
          <div key={item.id} className="row inset">
            <img src={contentArt(item.kind, item.id)} alt="" />
            <span className="row-body">
              <span className="row-name">{def.name}</span>
              <span className="row-desc">{def.desc}</span>
            </span>
            {bought ? (
              <span className="row-count">Bought</span>
            ) : (
              <>
                <span className={'row-cost' + (affordable ? '' : ' cant')}>
                  <img src={ICON.gold} alt="" />
                  {item.cost}
                </span>
                <button className="row-btn btn" disabled={!affordable} onClick={() => onBuy(item.id)}>
                  +
                </button>
              </>
            )}
          </div>
        );
      })}
    </Sheet>
  );
}
