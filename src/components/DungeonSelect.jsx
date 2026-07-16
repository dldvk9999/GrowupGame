import { getDungeonStage, DUNGEON_STAGE_COUNT } from '../lib/dungeonStages';
import { JOB_DUNGEON_BOSS } from '../lib/jobDungeon';
import { showToast } from '../lib/toast';

export default function DungeonSelect({
  attemptsRemaining, dungeonProgress, onEnterDungeon, entering, error,
  activeMonster, onEnterJobDungeon, jobEntering, jobError,
  activeType, onActiveTypeChange,
}) {
  return (
    <div className="dungeon-select">
      <h2>던전</h2>

      <div className="shop-tabs">
        <button className={`shop-tab ${activeType === 'exp' ? 'active' : ''}`} onClick={() => onActiveTypeChange('exp')}>
          📘 경험치 던전
        </button>
        <button className={`shop-tab ${activeType === 'gold' ? 'active' : ''}`} onClick={() => onActiveTypeChange('gold')}>
          💰 골드 던전
        </button>
        <button className={`shop-tab ${activeType === 'job' ? 'active' : ''}`} onClick={() => onActiveTypeChange('job')}>
          ⚔️ 전직 던전
        </button>
      </div>

      {activeType !== 'job' ? (
        <ProgressiveDungeon
          type={activeType}
          remaining={attemptsRemaining?.[activeType] ?? 3}
          clearedStage={dungeonProgress?.[activeType] ?? 0}
          onEnter={onEnterDungeon}
          entering={entering}
          error={error}
        />
      ) : (
        <JobDungeonPanel
          activeMonster={activeMonster}
          onEnter={onEnterJobDungeon}
          entering={jobEntering}
          error={jobError}
        />
      )}
    </div>
  );
}

function ProgressiveDungeon({ type, remaining, clearedStage, onEnter, entering, error }) {
  const currentStage = Math.min(clearedStage + 1, DUNGEON_STAGE_COUNT);
  const d = getDungeonStage(type, currentStage);
  const allCleared = clearedStage >= DUNGEON_STAGE_COUNT;

  return (
    <div>
      <p className="stage-select-hint">
        1층부터 순서대로 깨야 다음 층으로 갈 수 있어요. 하루 3번까지 입장 가능(오늘 {remaining}/3회 남음, 매일 오전 8시 초기화).
        {allCleared && ' 최고층까지 전부 클리어했어요! 10층을 반복 도전할 수 있어요.'}
      </p>
      {error && <p className="shop-error">{error}</p>}

      <div className="dungeon-current-card">
        <div className="dungeon-stage-num">{currentStage}층 {allCleared ? '(최고층 반복)' : ''}</div>
        <div className="dungeon-stage-boss">{d.name}</div>
        <div className="dungeon-stage-reward">
          EXP +{d.expReward.toLocaleString()} · 💰 +{d.goldReward.toLocaleString()}
        </div>
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

      <div className="dungeon-progress-track">
        {Array.from({ length: DUNGEON_STAGE_COUNT }, (_, i) => i + 1).map((s) => (
          <span key={s} className={`dungeon-progress-dot ${s <= clearedStage ? 'done' : s === currentStage ? 'current' : ''}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function JobDungeonPanel({ activeMonster, onEnter, entering, error }) {
  if (!activeMonster) return null;
  const unlocked = activeMonster.unlockedJobTier ?? 0;

  return (
    <div>
      <p className="stage-select-hint">
        레벨 조건을 채우면 도전할 수 있어요. 일반 던전보다 훨씬 강해서 스킬을 잘 돌려써야 이길 수 있어요.
      </p>
      {error && <p className="shop-error">{error}</p>}

      <div className="job-dungeon-list">
        {[1, 2, 3, 4].map((tier) => {
          const boss = JOB_DUNGEON_BOSS[tier];
          const isDone = unlocked >= tier;
          const isEligible = activeMonster.level >= boss.requiredLevel && unlocked === tier - 1;
          const isLocked = !isDone && !isEligible;
          return (
            <div key={tier} className={`job-dungeon-card ${isDone ? 'done' : ''}`}>
              <div className="job-dungeon-tier">{tier}차 전직</div>
              <div className="job-dungeon-boss">{boss.name}</div>
              <div className="job-dungeon-req">필요 레벨 Lv.{boss.requiredLevel} · 체력 {boss.hp.toLocaleString()}</div>
              {isDone ? (
                <span className="job-dungeon-done-badge">✅ 완료</span>
              ) : (
                <button
                  className={`btn btn-challenge ${isLocked ? 'btn-unaffordable' : ''}`}
                  disabled={entering}
                  onClick={() => {
                    if (isLocked) {
                      showToast(
                        unlocked < tier - 1
                          ? '이전 단계 전직을 먼저 완료해야 합니다.'
                          : `레벨이 부족합니다. (Lv.${boss.requiredLevel} 필요)`,
                        'error'
                      );
                      return;
                    }
                    onEnter(tier);
                  }}
                >
                  {isLocked
                    ? (unlocked < tier - 1 ? '이전 단계 필요' : `Lv.${boss.requiredLevel} 필요`)
                    : (entering ? '입장 중...' : '도전하기')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
