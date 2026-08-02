import { useEffect, useState } from 'react';
import { fetchTowerLeaderboard, fetchMyTowerRank, getTowerFloorMonster } from '../../lib/tower';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 TowerPanel를 그대로 옮김(로직 변경 없음)
export default function TowerPanel({ highestFloor, onEnter, entering, error, onSelectUser }) {
  const [leaderboard, setLeaderboard] = useState(null);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    Promise.all([fetchTowerLeaderboard(), fetchMyTowerRank()])
      .then(([lb, rank]) => { setLeaderboard(lb); setMyRank(rank); })
      .catch(() => setLeaderboard([]));
  }, [highestFloor]);

  const nextFloor = (highestFloor ?? 0) + 1;
  const iAmInTop20 = leaderboard?.some((r) => r.is_me);
  const achMilestones = [10, 30, 100];
  const nextAchMilestone = achMilestones.find((m) => m > (highestFloor ?? 0));

  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="상한도, 입장 횟수 제한도 없이 계속 올라가는 도전 모드예요. 한 층씩 순서대로 도전하고, 이기면 다음 층으로 최고기록이 갱신돼요. 올라갈수록 훨씬 강한 수호자가 나오니 장비/스킬을 충분히 갖추고 도전하세요. 몇 번이고 재도전할 수 있어요!" />
        {' '}무한의 탑 안내
      </p>

      <div className="worldboss-hp-card">
        <div className="worldboss-hp-title">🗼 나의 최고 기록: {highestFloor ?? 0}층</div>
        <p className="mypage-locked-hint" style={{ margin: '4px 0 0' }}>다음 도전: {nextFloor}층</p>
        {nextAchMilestone && (
          <p className="mypage-locked-hint" style={{ margin: '2px 0 0' }}>🏅 다음 업적까지 {nextAchMilestone - (highestFloor ?? 0)}층 남음</p>
        )}
      </div>

      <div className="tower-opponent-preview">
        <span className="tower-opponent-preview-title">👁️ 다음 상대 미리보기</span>
        {(() => {
          const opponent = getTowerFloorMonster(nextFloor);
          return (
            <div className="tower-opponent-stats">
              <span>❤️ HP {opponent.maxHp.toLocaleString()}</span>
              <span>⚔️ ATK {opponent.atk.toLocaleString()}</span>
              <span>🛡️ DEF {opponent.def.toLocaleString()}</span>
            </div>
          );
        })()}
        <p className="stage-select-hint" style={{ margin: '4px 0 0' }}>내 전투력과 비교해서 승산을 가늠해보세요.</p>
      </div>

      {error && <p className="shop-error">{error}</p>}

      <button className="btn btn-challenge" disabled={entering} onClick={onEnter}>
        {entering ? '입장 중...' : `⚔️ ${nextFloor}층 도전`}
      </button>

      {leaderboard && leaderboard.length > 0 && (
        <div className="worldboss-top-contributors">
          <h4 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🏅 최고 도달 층수 TOP {leaderboard.length}</h4>
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
                <span className="worldboss-contributor-damage">🗼{row.highest_floor}층</span>
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
