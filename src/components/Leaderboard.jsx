import { useState, useEffect } from 'react';
import { fetchLeaderboard, fetchMyRank } from '../lib/leaderboard';
import { fetchMyCombatPower } from '../lib/pvp';
import { showToast } from '../lib/toast';

const ELEMENT_ICON = { fire: '🔥', water: '💧', grass: '🌿' };
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ profile, activeMonster }) {
  const [rows, setRows] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [myPower, setMyPower] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load({ isRefresh = false } = {}) {
    try {
      const [lb, rank, power] = await Promise.all([fetchLeaderboard(), fetchMyRank(), fetchMyCombatPower()]);
      setRows(lb); setMyRank(rank); setMyPower(power); setError('');
    } catch (err) {
      const message = err.message ?? '랭킹을 불러오지 못했어요.';
      if (isRefresh) {
        // 새로고침 실패 시엔 기존에 보이던 목록을 지우지 않고 토스트로만 알림
        showToast(message, 'error');
      } else {
        setError(message);
      }
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true);
    await load({ isRefresh: true });
    setRefreshing(false);
  }

  if (error) return <p className="shop-error">{error}</p>;
  if (rows === null) return <p className="stage-select-hint">랭킹을 불러오는 중...</p>;

  // 50위 안에 없으면(=목록에 내 row가 없으면) 목록 하단에 내 정보를 별도로 붙여서 보여줌
  const iAmInTop50 = rows.some((row) => row.is_me);
  const showMyOwnRow = !iAmInTop50 && myRank != null;

  return (
    <div className="leaderboard-screen">
      <div className="leaderboard-header-row">
        <p className="stage-select-hint" style={{ margin: 0 }}>
          전체 유저 전투력 상위 50명이에요.
          {myRank != null && <> 내 순위는 <strong style={{ color: 'var(--accent-gold)' }}>{myRank}위</strong>예요.</>}
        </p>
        <button className="btn btn-ghost leaderboard-refresh-btn" disabled={refreshing} onClick={handleRefresh}>
          {refreshing ? '갱신 중...' : '🔄 새로고침'}
        </button>
      </div>
      <div className="leaderboard-list">
        {rows.map((row) => (
          <div key={row.rank} className={`leaderboard-row ${row.is_me ? 'leaderboard-row--me' : ''}`}>
            <span className="leaderboard-rank">{MEDAL[row.rank] ?? row.rank}</span>
            <span className="leaderboard-element">{ELEMENT_ICON[row.element] ?? ''}</span>
            <span className="leaderboard-nickname">
              {row.equipped_title && <span className="app-title-badge">[{row.equipped_title}]</span>}
              {row.nickname}{row.is_me && ' (나)'}
            </span>
            <span className="leaderboard-tier">{row.unlocked_job_tier > 0 ? `${row.unlocked_job_tier}차` : '-'}</span>
            <span className="leaderboard-level">Lv.{row.level}</span>
            <span className="leaderboard-power">⚔️{row.combat_power.toLocaleString()}</span>
          </div>
        ))}

        {showMyOwnRow && (
          <>
            <div className="leaderboard-divider">50위 밖 — 내 순위</div>
            <div className="leaderboard-row leaderboard-row--me">
              <span className="leaderboard-rank">{myRank}</span>
              <span className="leaderboard-element">{ELEMENT_ICON[activeMonster?.element] ?? ''}</span>
              <span className="leaderboard-nickname">
                {profile?.equipped_title && <span className="app-title-badge">[{profile.equipped_title}]</span>}
                {profile?.nickname} (나)
              </span>
              <span className="leaderboard-tier">{(activeMonster?.unlockedJobTier ?? 0) > 0 ? `${activeMonster.unlockedJobTier}차` : '-'}</span>
              <span className="leaderboard-level">Lv.{activeMonster?.level ?? 0}</span>
              <span className="leaderboard-power">⚔️{(myPower ?? 0).toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
