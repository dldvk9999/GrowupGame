import { useEffect, useState } from 'react';
import MonsterSprite from './MonsterSprite';
import { getDisplaySpriteKey } from '../lib/jobAdvancement';
import { getItem } from '../lib/itemCatalog';
import { expToNextLevel } from '../lib/growth';
import { fetchPublicProfile } from '../lib/publicProfile';

const ELEMENT_ICON = { fire: '🔥', water: '💧', grass: '🌿' };

/**
 * 랭킹에서 유저를 클릭하면 뜨는 상세 프로필 팝업(사용자 요청).
 * props: userId(필수), onClose()
 */
export default function PublicProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(undefined); // undefined=로딩중, null=에러
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    setProfile(undefined);
    fetchPublicProfile(userId)
      .then(setProfile)
      .catch((err) => { setError(err.message ?? '정보를 불러오지 못했어요.'); setProfile(null); });
  }, [userId]);

  if (!userId) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="story-popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        {profile === undefined ? (
          <p className="stage-select-hint">불러오는 중...</p>
        ) : profile === null ? (
          <p className="shop-error">{error}</p>
        ) : (
          <ProfileContent profile={profile} />
        )}
        <button type="button" className="btn btn-neutral" onClick={onClose} style={{ marginTop: 14 }}>닫기</button>
      </div>
    </div>
  );
}

function ProfileContent({ profile: p }) {
  const hasMonster = p.speciesId != null;
  const need = hasMonster ? expToNextLevel(p.level) : 1;

  return (
    <div>
      <h3 className="mypage-subtitle" style={{ marginTop: 0 }}>
        {p.equippedTitle && <span className="app-title-badge">[{p.equippedTitle}]</span>} {p.nickname}
      </h3>
      {p.guildName && (
        <p className="mypage-locked-hint" style={{ margin: '0 0 10px' }}>🛡️ [{p.guildTag}] {p.guildName}</p>
      )}

      {hasMonster ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '10px 0' }}>
            <MonsterSprite
              speciesKey={getDisplaySpriteKey(p.speciesId, p.element, p.unlockedJobTier)}
              size={72}
              alt={p.monsterName ?? '몬스터'}
              costumeKeys={p.equippedCostumes}
            />
            <div>
              <div style={{ fontWeight: 700 }}>{ELEMENT_ICON[p.element]} {p.monsterName ?? '이름없는 몬스터'} Lv.{p.level}</div>
              <div className="mypage-locked-hint">전직 {p.unlockedJobTier}차 · ⚔️ 전투력 {p.combatPower.toLocaleString()}</div>
            </div>
          </div>
          <div className="exp-bar-wrap" style={{ marginBottom: 14 }}>
            <div className="exp-label">경험치 ({p.exp}/{need})</div>
            <div className="bar-track exp-track"><div className="bar-fill exp-fill" style={{ width: `${Math.min(100, (p.exp / need) * 100)}%` }} /></div>
          </div>
        </>
      ) : (
        <p className="stage-select-hint">활성 몬스터가 없어요.</p>
      )}

      {p.equippedItems.length > 0 && (
        <>
          <h4 className="mypage-subtitle">🗡️ 장비</h4>
          <div className="inventory-list">
            {p.equippedItems.map((row) => {
              const item = getItem(row.item_key);
              if (!item) return null;
              return (
                <div key={row.item_key} className="inventory-row">
                  <span className="inventory-icon" style={{ color: item.color }}>{item.icon}</span>
                  <span className="inventory-name">
                    {item.name} {row.enhance_level > 0 && <span className="enhance-badge">+{row.enhance_level}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {p.equippedCostumes.length > 0 && (
        <>
          <h4 className="mypage-subtitle">👗 코스튬</h4>
          <div className="inventory-list">
            {p.equippedCostumes.map((key) => {
              const item = getItem(key);
              if (!item) return null;
              return (
                <div key={key} className="inventory-row">
                  <span className="inventory-icon" style={{ color: item.color }}>{item.icon}</span>
                  <span className="inventory-name">{item.name}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h4 className="mypage-subtitle">📊 던전 진행도</h4>
      <p className="mypage-locked-hint" style={{ lineHeight: 1.8 }}>
        📗 경험치 던전 {p.expDungeonCleared}층 클리어<br />
        💰 골드 던전 {p.goldDungeonCleared}층 클리어<br />
        🗼 무한의 탑 {p.towerHighestFloor}층
      </p>
    </div>
  );
}
