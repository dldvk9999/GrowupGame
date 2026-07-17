import { useState, useEffect } from 'react';
import { fetchLeaderboard, fetchMyRank } from '../lib/leaderboard';

const ELEMENT_ICON = { fire: '🔥', water: '💧', grass: '🌿' };
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard() {
  const [rows, setRows] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchLeaderboard(), fetchMyRank()])
      .then(([lb, rank]) => { setRows(lb); setMyRank(rank); })
      .catch((err) => setError(err.message ?? '랭킹을 불러오지 못했어요.'));
  }, []);

  if (error) return <p className="shop-error">{error}</p>;
  if (rows === null) return <p className="stage-select-hint">랭킹을 불러오는 중...</p>;

  return (
    <div className="leaderboard-screen">
      <p className="stage-select-hint">
        전체 유저 전투력 상위 50명이에요. 30초마다 자동 갱신되진 않으니, 새로고침하려면 화면을 다시 들어와주세요.
        {myRank != null && <> 내 순위는 <strong style={{ color: 'var(--accent-gold)' }}>{myRank}위</strong>예요.</>}
      </p>
      <div className="leaderboard-list">
        {rows.map((row) => (
          <div key={row.rank} className={`leaderboard-row ${row.is_me ? 'leaderboard-row--me' : ''}`}>
            <span className="leaderboard-rank">{MEDAL[row.rank] ?? row.rank}</span>
            <span className="leaderboard-element">{ELEMENT_ICON[row.element] ?? ''}</span>
            <span className="leaderboard-nickname">{row.nickname}{row.is_me && ' (나)'}</span>
            <span className="leaderboard-tier">{row.unlocked_job_tier > 0 ? `${row.unlocked_job_tier}차` : '-'}</span>
            <span className="leaderboard-level">Lv.{row.level}</span>
            <span className="leaderboard-power">⚔️{row.combat_power.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
