import { useEffect, useState } from 'react';
import { fetchStreakDungeonLeaderboard, fetchMyStreakDungeonRank, previewStreakDungeonGold } from '../../lib/streakDungeon';
import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 StreakDungeonPanel를 그대로 옮김(로직 변경 없음)
export default function StreakDungeonPanel({ activeMonster, onEnter, entering, error, attemptsRemaining, streakBest, onSelectUser }) {
  const [leaderboard, setLeaderboard] = useState(null);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    Promise.all([fetchStreakDungeonLeaderboard(), fetchMyStreakDungeonRank()])
      .then(([lb, rank]) => { setLeaderboard(lb); setMyRank(rank); })
      .catch(() => setLeaderboard([]));
  }, [streakBest]);

  if (!activeMonster) return null;
  const noAttemptsLeft = attemptsRemaining === 0;
  const iAmInTop20 = leaderboard?.some((r) => r.is_me);
  const firstRoundGold = previewStreakDungeonGold(activeMonster.level, 1);

  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="이길 때마다 '지금 수령'과 '이어서 도전' 중 골라야 해요. 이어갈수록 상대는 훨씬 강해지지만 보상은 연승마다 약 1.3배씩 불어나요. 단, 지면 이번 판 보상을 전부 잃어요 — 언제 멈출지가 실력이에요! 하루 3회까지 새로 시작할 수 있어요." />
        {' '}연승 던전 안내
      </p>
      {error && <p className="shop-error">{error}</p>}
      <p className="stage-select-hint" style={{ color: 'var(--accent-gold)' }}>
        🏆 나의 최고 연승: {streakBest ?? 0}연승 · 오늘 남은 입장 횟수: {attemptsRemaining ?? '...'} / 3
      </p>
      <button
        className={`btn btn-challenge ${noAttemptsLeft ? 'btn-unaffordable' : ''}`}
        disabled={entering || noAttemptsLeft}
        onClick={() => {
          if (noAttemptsLeft) {
            showToast('오늘의 연승 던전 입장 횟수를 모두 사용했어요.', 'error');
            return;
          }
          onEnter();
        }}
      >
        {noAttemptsLeft ? '오늘 입장 횟수 소진' : entering ? '입장 중...' : `🔥 연승 던전 도전하기 (1연승 보상 +${firstRoundGold.toLocaleString()})`}
      </button>

      {leaderboard && leaderboard.length > 0 && (
        <div className="worldboss-top-contributors">
          <h4 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🏅 최고 연승 TOP {leaderboard.length}</h4>
          <div className="worldboss-contributor-list">
            {leaderboard.map((row) => (
              <div
                key={row.rank}
                className={`worldboss-contributor-row ${row.is_me ? 'inventory-row--equipped' : ''}`}
                onClick={() => row.user_id && onSelectUser?.(row.user_id)}
                style={{ cursor: row.user_id ? 'pointer' : 'default' }}
              >
                <span className="worldboss-contributor-rank">{['🥇', '🥈', '🥉'][row.rank - 1] ?? row.rank}</span>
                <span className="worldboss-contributor-nickname">
                  {row.equipped_title && <span className="app-title-badge">[{row.equipped_title}]</span>}
                  {row.nickname}{row.is_me && ' (나)'}
                </span>
                <span className="worldboss-contributor-damage">🔥{row.best_streak}연승</span>
              </div>
            ))}
          </div>
          {myRank != null && !iAmInTop20 && (
            <p className="stage-select-hint" style={{ marginTop: 8, marginBottom: 0 }}>내 순위: <strong style={{ color: 'var(--accent-gold)' }}>{myRank}위</strong></p>
          )}
        </div>
      )}
    </div>
  );
}
