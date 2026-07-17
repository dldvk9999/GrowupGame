import { useState } from 'react';
import Mailbox from './Mailbox';
import CouponRedeem from './CouponRedeem';
import Achievements from './Achievements';

export default function Settings({ userId, gold, onGoldChange, onUnreadMailChange, achievementStats }) {
  const [tab, setTab] = useState('mailbox');

  return (
    <div className="settings-screen">
      <h2>설정</h2>
      <div className="shop-tabs">
        <button className={`shop-tab ${tab === 'mailbox' ? 'active' : ''}`} onClick={() => setTab('mailbox')}>📮 우편함</button>
        <button className={`shop-tab ${tab === 'achievements' ? 'active' : ''}`} onClick={() => setTab('achievements')}>🏆 업적</button>
        <button className={`shop-tab ${tab === 'coupon' ? 'active' : ''}`} onClick={() => setTab('coupon')}>🎟️ 쿠폰 입력</button>
      </div>

      {tab === 'mailbox' && <Mailbox userId={userId} gold={gold} onGoldChange={onGoldChange} onUnreadChange={onUnreadMailChange} />}
      {tab === 'achievements' && <Achievements userId={userId} gold={gold} onGoldChange={onGoldChange} stats={achievementStats} />}
      {tab === 'coupon' && <CouponRedeem />}
    </div>
  );
}
