import { useEffect, useState } from 'react';
import { fetchWorldBossTopContributors, fetchMyWorldBossRank } from '../../lib/worldBoss';
import { useCountdownToDaily8AM, useCountdownToWeeklyReset } from '../../lib/countdown';
import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 WorldBossPanel를 그대로 옮김(로직 변경 없음)
export default function WorldBossPanel({ boss, progress, onEnter, entering, error, onSelectUser }) {
  const [topContributors, setTopContributors] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const resetIn = useCountdownToDaily8AM();
  const weeklyResetIn = useCountdownToWeeklyReset();

  useEffect(() => {
    if (!boss?.weekKey) return;
    fetchWorldBossTopContributors(boss.weekKey).then(setTopContributors).catch(() => setTopContributors([]));
  }, [boss?.weekKey]);

  useEffect(() => {
    if (!boss?.weekKey || !progress?.myWeekDamage) { setMyRank(null); return; }
    fetchMyWorldBossRank(boss.weekKey, progress.myWeekDamage).then(setMyRank).catch(() => setMyRank(null));
  }, [boss?.weekKey, progress?.myWeekDamage]);

  if (!boss) return <p className="app-loading">월드보스를 불러오는 중...</p>;

  const pct = Math.max(0, Math.min(100, (boss.currentHp / boss.maxHp) * 100));
  const remaining = 3 - (progress?.attemptsUsed ?? 0);

  return (
    <div className="worldboss-panel">
      <p className="stage-select-hint">
        <InfoTooltip text="전체 유저가 함께 체력을 깎는 공용 보스예요. 한 판당 제한시간은 1분이고, 시간 안에 못 잡아도 그동안 입힌 피해는 그대로 남아요. 4차 전직 정도는 해야 유효타가 들어갈 만큼 강력해요." />
        {' '}{weeklyResetIn} 후(매주 일요일 자정) 체력 초기화. 오늘 {Math.max(0, remaining)}/3회 남음, {resetIn} 후 초기화.
      </p>
      {error && <p className="shop-error">{error}</p>}

      <div className="worldboss-hp-card">
        <div className="worldboss-hp-title">🐉 태초의 용 {boss.cleared && <span className="worldboss-cleared-badge">처치 완료!</span>}</div>
        <div className="bar-track worldboss-hp-track">
          <div className="bar-fill worldboss-hp-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="worldboss-hp-numbers">{boss.currentHp.toLocaleString()} / {boss.maxHp.toLocaleString()}</div>
        <div className="worldboss-my-damage">
          이번 주 내가 입힌 피해: {(progress?.myWeekDamage ?? 0).toLocaleString()}
          {myRank != null && <span className="worldboss-my-rank"> · 현재 {myRank}위</span>}
        </div>
      </div>

      <button
        className={`btn btn-challenge worldboss-fight-btn ${(remaining <= 0 || boss.cleared) ? 'btn-unaffordable' : ''}`}
        disabled={entering}
        onClick={() => {
          if (boss.cleared) {
            showToast('이번 주 월드보스는 이미 처치되었습니다.', 'error');
            return;
          }
          if (remaining <= 0) {
            showToast('오늘 하루 입장권을 모두 소진하셨습니다.', 'error');
            return;
          }
          onEnter();
        }}
      >
        {entering ? '입장 중...' : '⚔️ 월드보스에게 도전'}
      </button>

      <p className="worldboss-reward-hint">
        클리어하면 이번 주 참여자 전원에게 <strong>7일간 공격력·방어력 2배</strong>의 "용의 버프"가 붙고, 닉네임이 화려하게 반짝여요.
        피해량에 비례한 골드 보상도 우편함으로 도착해요. 못 잡고 주가 끝나도, 그동안 입힌 피해량만큼 골드를 우편으로 보내드려요.
      </p>

      {topContributors && topContributors.length > 0 && (
        <div className="worldboss-top-contributors">
          <h4 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🏅 이번 주 기여자 TOP {topContributors.length}</h4>
          <div className="worldboss-contributor-list">
            {topContributors.map((c, i) => (
              <div
                key={i}
                className="worldboss-contributor-row"
                onClick={() => c.userId && onSelectUser?.(c.userId)}
                style={{ cursor: c.userId ? 'pointer' : 'default' }}
              >
                <span className="worldboss-contributor-rank">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                <span className="worldboss-contributor-nickname">{c.nickname}</span>
                <span className="worldboss-contributor-damage">🐉{c.damage.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
