import { useState } from 'react';
import PvPArena from './PvPArena';
import PvPShop from './PvPShop';

export default function PvP({ userId, profile, activeMonster, onCurrencyChange, onBattleResolved }) {
  const [tab, setTab] = useState('arena');

  return (
    <div className="pvp-screen">
      <h2>PvP</h2>
      <div className="shop-tabs">
        <button className={`shop-tab ${tab === 'arena' ? 'active' : ''}`} onClick={() => setTab('arena')}>⚔️ 대결</button>
        <button className={`shop-tab ${tab === 'shop' ? 'active' : ''}`} onClick={() => setTab('shop')}>🎖️ 상점</button>
      </div>

      {tab === 'arena' ? (
        <PvPArena profile={profile} activeMonster={activeMonster} onBattleResolved={onBattleResolved} />
      ) : (
        <PvPShop userId={userId} currency={profile?.pvp_currency ?? 0} onCurrencyChange={onCurrencyChange} />
      )}
    </div>
  );
}
