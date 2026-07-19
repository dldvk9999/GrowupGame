import { useState, useEffect } from 'react';
import { fetchLeaderboard, fetchMyRank } from '../lib/leaderboard';
import { fetchMyCombatPower } from '../lib/pvp';
import { fetchAchievementLeaderboard, fetchMyAchievementRank } from '../lib/achievements';
import { fetchTowerLeaderboard, fetchMyTowerRank } from '../lib/tower';
import { fetchReferralLeaderboard, fetchMyReferralRank } from '../lib/auth';
import { showToast } from '../lib/toast';

const ELEMENT_ICON = { fire: '🔥', water: '💧', grass: '🌿' };
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ profile, activeMonster }) {
  const [kind, setKind] = useState('power'); // 'power' | 'achievement' | 'tower' | 'referral'

  return (
    <div className="leaderboard-screen">
      <div className="shop-tabs leaderboard-kind-tabs">
        <button className={`shop-tab ${kind === 'power' ? 'active' : ''}`} onClick={() => setKind('power')}>⚔️ 전투력</button>
        <button className={`shop-tab ${kind === 'achievement' ? 'active' : ''}`} onClick={() => setKind('achievement')}>🏆 업적</button>
        <button className={`shop-tab ${kind === 'tower' ? 'active' : ''}`} onClick={() => setKind('tower')}>🗼 무한의 탑</button>
        <button className={`shop-tab ${kind === 'referral' ? 'active' : ''}`} onClick={() => setKind('referral')}>🤝 친구추천</button>
      </div>
      {kind === 'power' && <PowerLeaderboard profile={profile} activeMonster={activeMonster} />}
      {kind === 'achievement' && <SimpleLeaderboard fetchList={fetchAchievementLeaderboard} fetchMyRank={fetchMyAchievementRank} valueKey="achievement_count" valueIcon="🏆" valueSuffix="개" emptyText="아직 업적을 달성한 유저가 없어요." />}
      {kind === 'tower' && <SimpleLeaderboard fetchList={fetchTowerLeaderboard} fetchMyRank={fetchMyTowerRank} valueKey="highest_floor" valueIcon="🗼" valueSuffix="층" emptyText="아직 무한의 탑에 도전한 유저가 없어요." />}
      {kind === 'referral' && <SimpleLeaderboard fetchList={fetchReferralLeaderboard} fetchMyRank={fetchMyReferralRank} valueKey="referral_count" valueIcon="🤝" valueSuffix="명" emptyText="아직 친구를 추천한 유저가 없어요." />}
    </div>
  );
}

/** 업적/무한의 탑처럼 "순위·닉네임·값 하나"로 구성된 단순한 랭킹 공용 렌더러 */
function SimpleLeaderboard({ fetchList, fetchMyRank, valueKey, valueIcon, valueSuffix, emptyText }) {
  const [rows, setRows] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchList(), fetchMyRank()])
      .then(([list, rank]) => { setRows(list); setMyRank(rank); })
      .catch((err) => setError(err.message ?? '랭킹을 불러오지 못했어요.'));
  }, [fetchList, fetchMyRank]);

  if (error) return <p className="shop-error">{error}</p>;
  if (rows === null) return <p className="stage-select-hint">랭킹을 불러오는 중...</p>;
  if (rows.length === 0) return <p className="inventory-empty">{emptyText}</p>;

  const iAmInList = rows.some((r) => r.is_me);

  return (
    <div className="leaderboard-list">
      {rows.map((row) => (
        <div key={row.rank} className={`worldboss-contributor-row ${row.is_me ? 'inventory-row--equipped' : ''}`}>
          <span className="worldboss-contributor-rank">{MEDAL[row.rank] ?? row.rank}</span>
          <span className="worldboss-contributor-nickname">
            {row.equipped_title && <span className="app-title-badge">[{row.equipped_title}]</span>}
            {row.nickname}{row.is_me && ' (나)'}
          </span>
          <span className="worldboss-contributor-damage">{valueIcon}{row[valueKey]}{valueSuffix}</span>
        </div>
      ))}
      {myRank != null && !iAmInList && (
        <p className="stage-select-hint" style={{ marginTop: 8 }}>내 순위: <strong style={{ color: 'var(--accent-gold)' }}>{myRank}위</strong></p>
      )}
    </div>
  );
}

function PowerLeaderboard({ profile, activeMonster }) {
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
    <>
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
    </>
  );
}
