import { useEffect, useState } from 'react';
import { fetchGuildRaidContributors } from '../../lib/guildRaid';
import { useCountdownToDaily8AM, useCountdownToWeeklyReset } from '../../lib/countdown';
import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 GuildRaidPanel를 그대로 옮김(로직 변경 없음)
export default function GuildRaidPanel({ guildRaid, progress, onEnter, entering, error, onGoToGuild, onSelectUser }) {
  const [contributors, setContributors] = useState(null);
  const weeklyResetIn = useCountdownToWeeklyReset();
  const resetIn = useCountdownToDaily8AM();

  useEffect(() => {
    if (!guildRaid?.guildId) { setContributors(null); return; }
    fetchGuildRaidContributors().then(setContributors).catch(() => setContributors([]));
  }, [guildRaid?.guildId, guildRaid?.currentHp]);

  if (guildRaid === undefined) return <p className="app-loading">길드 레이드를 불러오는 중...</p>;

  if (!guildRaid) {
    return (
      <div>
        <p className="stage-select-hint">
          <InfoTooltip text="길드원들이 함께 체력을 깎는 우리 길드 전용 공유 보스예요. 길드에 가입하면 도전할 수 있어요." />
          {' '}길드 레이드 안내
        </p>
        <p className="stage-select-hint" style={{ textAlign: 'center', padding: '20px 0' }}>
          🛡️ 길드에 가입하면 길드원들과 함께 레이드 보스에게 도전할 수 있어요.
        </p>
        <button className="btn btn-challenge" onClick={onGoToGuild}>👥 길드 찾으러 가기</button>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, (guildRaid.currentHp / guildRaid.maxHp) * 100));
  const remaining = 3 - (progress?.attemptsUsed ?? 0);

  return (
    <div className="worldboss-panel">
      <p className="stage-select-hint">
        <InfoTooltip text="우리 길드(최대 30명)만 함께 체력을 깎는 전용 보스예요. 한 판당 제한시간 1분, 시간 안에 못 잡아도 그동안 입힌 피해는 그대로 남아요." />
        {' '}{weeklyResetIn} 후(매주 일요일 자정) 체력 초기화. 오늘 {Math.max(0, remaining)}/3회 남음, {resetIn} 후 초기화.
      </p>
      {error && <p className="shop-error">{error}</p>}

      <div className="worldboss-hp-card">
        <div className="worldboss-hp-title">🛡️ {guildRaid.guildName}의 레이드 보스 {guildRaid.cleared && <span className="worldboss-cleared-badge">처치 완료!</span>}</div>
        <div className="bar-track worldboss-hp-track">
          <div className="bar-fill worldboss-hp-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="worldboss-hp-numbers">{guildRaid.currentHp.toLocaleString()} / {guildRaid.maxHp.toLocaleString()}</div>
        <div className="worldboss-my-damage">이번 주 내가 입힌 피해: {(progress?.myWeekDamage ?? 0).toLocaleString()}</div>
      </div>

      <button
        className={`btn btn-challenge worldboss-fight-btn ${(remaining <= 0 || guildRaid.cleared) ? 'btn-unaffordable' : ''}`}
        disabled={entering}
        onClick={() => {
          if (guildRaid.cleared) {
            showToast('이번 주 길드 레이드는 이미 처치되었습니다.', 'error');
            return;
          }
          if (remaining <= 0) {
            showToast('오늘 하루 입장권을 모두 소진하셨습니다.', 'error');
            return;
          }
          onEnter();
        }}
      >
        {entering ? '입장 중...' : '🛡️ 길드 레이드 도전'}
      </button>

      <p className="worldboss-reward-hint">
        길드원들과 함께 보스를 처치하면 입힌 피해량에 비례한 골드가 우편함으로 도착해요. 못 잡고 주가 끝나도, 그동안 입힌 피해량만큼 골드를 우편으로 보내드려요.
      </p>

      {contributors && contributors.length > 0 && (
        <div className="worldboss-top-contributors">
          <h4 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🏅 이번 주 길드원 기여도</h4>
          <div className="worldboss-contributor-list">
            {contributors.map((c, i) => (
              <div
                key={i}
                className={`worldboss-contributor-row ${c.is_me ? 'inventory-row--equipped' : ''}`}
                onClick={() => c.user_id && onSelectUser?.(c.user_id)}
                style={{ cursor: c.user_id ? 'pointer' : 'default' }}
              >
                <span className="worldboss-contributor-rank">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                <span className="worldboss-contributor-nickname">
                  {c.equipped_title && <span className="app-title-badge">[{c.equipped_title}]</span>}
                  {c.nickname}{c.is_me && ' (나)'}
                </span>
                <span className="worldboss-contributor-damage">🛡️{c.total_damage.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
