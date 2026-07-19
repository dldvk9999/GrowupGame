import { useState } from 'react';
import Mailbox from './Mailbox';
import CouponRedeem from './CouponRedeem';
import Achievements from './Achievements';
import PatchNotes from './PatchNotes';
import GameGuide from './GameGuide';
import { hasSeenLatestPatchNote, markLatestPatchNoteSeen } from '../lib/patchNotes';

export default function Settings({ userId, gold, pvpWins, hasUnreadMail, onGoldChange, onUnreadMailChange, achievementStats, equippedTitle, onTitleChange, onPatchNoteSeen }) {
  const [tab, setTab] = useState('mailbox');
  const [hasNewPatchNote, setHasNewPatchNote] = useState(() => !hasSeenLatestPatchNote());

  function openPatchNotes() {
    setTab('patchnotes');
    markLatestPatchNoteSeen();
    setHasNewPatchNote(false);
    onPatchNoteSeen?.();
  }

  return (
    <div className="settings-screen">
      <h2>설정</h2>
      <div className="shop-tabs">
        <button className={`shop-tab mail-tab-btn ${tab === 'mailbox' ? 'active' : ''}`} onClick={() => setTab('mailbox')}>
          📮 우편함{hasUnreadMail && <span className="mail-unread-dot" aria-label="읽지 않은 우편 있음" />}
        </button>
        <button className={`shop-tab ${tab === 'achievements' ? 'active' : ''}`} onClick={() => setTab('achievements')}>🏆 업적</button>
        <button className={`shop-tab ${tab === 'guide' ? 'active' : ''}`} onClick={() => setTab('guide')}>📘 게임가이드</button>
        <button className={`shop-tab ${tab === 'coupon' ? 'active' : ''}`} onClick={() => setTab('coupon')}>🎟️ 쿠폰 입력</button>
        <button className={`shop-tab patch-note-tab-btn ${tab === 'patchnotes' ? 'active' : ''}`} onClick={openPatchNotes}>
          📰 패치노트{hasNewPatchNote && <span className="mail-unread-dot" aria-label="새 패치노트 있음" />}
        </button>
      </div>

      {tab === 'mailbox' && <Mailbox userId={userId} gold={gold} onGoldChange={onGoldChange} onUnreadChange={onUnreadMailChange} />}
      {tab === 'achievements' && (
        <Achievements
          userId={userId}
          gold={gold}
          onGoldChange={onGoldChange}
          stats={achievementStats}
          equippedTitle={equippedTitle}
          onTitleChange={onTitleChange}
        />
      )}
      {tab === 'guide' && <GameGuide isFounder={achievementStats?.isFounder === 1} pvpWins={pvpWins} />}
      {tab === 'coupon' && <CouponRedeem />}
      {tab === 'patchnotes' && <PatchNotes />}
    </div>
  );
}
