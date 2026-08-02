import { useEffect, useState } from 'react';
import { getDungeonStage, DUNGEON_STAGE_COUNT } from '../../lib/dungeonStages';
import { fetchLuckyDungeonType, fetchDailyDungeonBonusType, fetchGoldenHourActive } from '../../lib/dungeon';
import { useCountdownToDaily8AM } from '../../lib/countdown';
import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 ProgressiveDungeon를 그대로 옮김(로직 변경 없음)
export default function ProgressiveDungeon({ type, remaining, clearedStage, onEnter, entering, error }) {
  const currentStage = Math.min(clearedStage + 1, DUNGEON_STAGE_COUNT);
  const d = getDungeonStage(type, currentStage);
  const allCleared = clearedStage >= DUNGEON_STAGE_COUNT;
  const resetIn = useCountdownToDaily8AM();
  const [luckyType, setLuckyType] = useState(null);
  const [dailyBonusType, setDailyBonusType] = useState(null);
  const [goldenHourActive, setGoldenHourActive] = useState(false);

  useEffect(() => {
    fetchLuckyDungeonType().then(setLuckyType).catch(() => setLuckyType(null));
    fetchDailyDungeonBonusType().then(setDailyBonusType).catch(() => setDailyBonusType(null));
    function refreshGoldenHour() {
      fetchGoldenHourActive().then(setGoldenHourActive).catch(() => {});
    }
    refreshGoldenHour();
    // 시간대 경계(정각)에 걸쳐 화면에 계속 머물 수도 있으므로 1분마다 재확인
    const timer = setInterval(refreshGoldenHour, 60000);
    return () => clearInterval(timer);
  }, []);

  const isLuckyDungeon = luckyType === type;
  const isDailyBonusDungeon = dailyBonusType === type;

  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="1층부터 순서대로 깨야 다음 층으로 갈 수 있어요. 최고층까지 전부 클리어하면 그 층을 반복 도전할 수 있어요." />
        {' '}오늘 {remaining}/3회 남음, {resetIn} 후 초기화.
        {allCleared && ` 최고층까지 전부 클리어했어요! ${DUNGEON_STAGE_COUNT}층을 반복 도전할 수 있어요.`}
      </p>
      {isLuckyDungeon && (
        <p className="stage-select-hint lucky-dungeon-banner">🍀 이번 주는 {type === 'gold' ? '골드' : '경험치'} 던전이 행운의 던전이에요! 골드 보상 1.5배</p>
      )}
      {isDailyBonusDungeon && (
        <p className="stage-select-hint lucky-dungeon-banner">📅 오늘은 {type === 'gold' ? '골드' : '경험치'} 던전에 요일 보너스가 붙어요! 골드 보상 1.3배</p>
      )}
      {goldenHourActive && (
        <p className="stage-select-hint lucky-dungeon-banner">🕗 지금은 골든타임! (경험치/골드 던전 공통) 골드 보상 1.4배 - 21시에 종료돼요</p>
      )}
      {error && <p className="shop-error">{error}</p>}

      <div className="dungeon-current-card">
        <div className="dungeon-stage-num">{currentStage}층 {allCleared ? '(최고층 반복)' : ''}</div>
        <div className="dungeon-stage-boss">{d.name}</div>
        <div className="tower-opponent-stats" style={{ justifyContent: 'center' }}>
          <span>❤️ HP {d.maxHp.toLocaleString()}</span>
          <span>⚔️ ATK {d.atk.toLocaleString()}</span>
          <span>🛡️ DEF {d.def.toLocaleString()}</span>
        </div>
        <div className="dungeon-stage-reward">
          EXP +{d.expReward.toLocaleString()} · 💰 +{d.goldReward.toLocaleString()}
        </div>
        {(() => {
          const depthMilestones = [100, 300, 500];
          const nextDepthMilestone = depthMilestones.find((m) => m > clearedStage);
          return nextDepthMilestone ? (
            <p className="mypage-locked-hint" style={{ textAlign: 'center', margin: '4px 0 0' }}>🏅 다음 업적까지 {nextDepthMilestone - clearedStage}층 남음</p>
          ) : null;
        })()}
        <button
          className={`btn btn-challenge ${remaining <= 0 ? 'btn-unaffordable' : ''}`}
          disabled={entering}
          onClick={() => {
            if (remaining <= 0) {
              showToast('오늘 하루 입장권을 모두 소진하셨습니다.', 'error');
              return;
            }
            onEnter(type);
          }}
        >
          {entering ? '입장 중...' : `${currentStage}층 도전하기`}
        </button>
      </div>

      <div className="dungeon-progress-summary">
        <span className="dungeon-progress-label">진행도 {clearedStage} / {DUNGEON_STAGE_COUNT}층</span>
        <span className="bar-track dungeon-progress-bar-track">
          <span className="bar-fill" style={{ width: `${(clearedStage / DUNGEON_STAGE_COUNT) * 100}%`, background: 'linear-gradient(90deg, var(--accent-fire), var(--accent-gold))' }} />
        </span>
      </div>
    </div>
  );
}
