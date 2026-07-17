import { useEffect } from 'react';
import { getDungeonStage, DUNGEON_STAGE_COUNT } from '../lib/dungeonStages';
import { JOB_DUNGEON_BOSS } from '../lib/jobDungeon';
import { showToast } from '../lib/toast';

const DUNGEON_TABS = ['exp', 'gold', 'job', 'worldboss'];

export default function DungeonSelect({
  attemptsRemaining, dungeonProgress, onEnterDungeon, entering, error,
  activeMonster, onEnterJobDungeon, jobEntering, jobError,
  activeType, onActiveTypeChange,
  worldBoss, worldBossProgress, onEnterWorldBoss, worldBossEntering, worldBossError,
}) {
  // Tab / Shift+Tab으로 던전 탭 순환
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      const idx = DUNGEON_TABS.indexOf(activeType);
      const next = e.shiftKey
        ? DUNGEON_TABS[(idx - 1 + DUNGEON_TABS.length) % DUNGEON_TABS.length]
        : DUNGEON_TABS[(idx + 1) % DUNGEON_TABS.length];
      onActiveTypeChange(next);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeType, onActiveTypeChange]);

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
        <button className={`shop-tab ${activeType === 'worldboss' ? 'active' : ''}`} onClick={() => onActiveTypeChange('worldboss')}>
          🐉 월드보스
        </button>
      </div>
      <p className="keyboard-hint">Tab / Shift+Tab으로 탭 이동</p>

      {activeType === 'job' ? (
        <JobDungeonPanel
          activeMonster={activeMonster}
          onEnter={onEnterJobDungeon}
          entering={jobEntering}
          error={jobError}
        />
      ) : activeType === 'worldboss' ? (
        <WorldBossPanel
          boss={worldBoss}
          progress={worldBossProgress}
          onEnter={onEnterWorldBoss}
          entering={worldBossEntering}
          error={worldBossError}
        />
      ) : (
        <ProgressiveDungeon
          type={activeType}
          remaining={attemptsRemaining?.[activeType] ?? 3}
          clearedStage={dungeonProgress?.[activeType] ?? 0}
          onEnter={onEnterDungeon}
          entering={entering}
          error={error}
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
        {[1, 2, 3, 4, 5].map((tier) => {
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

function WorldBossPanel({ boss, progress, onEnter, entering, error }) {
  if (!boss) return <p className="app-loading">월드보스를 불러오는 중...</p>;

  const pct = Math.max(0, Math.min(100, (boss.currentHp / boss.maxHp) * 100));
  const remaining = 3 - (progress?.attemptsUsed ?? 0);

  return (
    <div className="worldboss-panel">
      <p className="stage-select-hint">
        전체 유저가 함께 체력을 깎는 공용 보스예요. 매주 일요일 자정(서울시간)에 체력이 초기화돼요.
        하루 3번까지 도전 가능(오늘 {Math.max(0, remaining)}/3회 남음, 매일 오전 8시 초기화).
        한 판당 제한시간은 1분이고, 시간 안에 못 잡아도 그동안 입힌 피해는 그대로 남아요.
        4차 전직 정도는 해야 유효타가 들어갈 만큼 강력해요.
      </p>
      {error && <p className="shop-error">{error}</p>}

      <div className="worldboss-hp-card">
        <div className="worldboss-hp-title">🐉 태초의 용 {boss.cleared && <span className="worldboss-cleared-badge">처치 완료!</span>}</div>
        <div className="bar-track worldboss-hp-track">
          <div className="bar-fill worldboss-hp-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="worldboss-hp-numbers">{boss.currentHp.toLocaleString()} / {boss.maxHp.toLocaleString()}</div>
        <div className="worldboss-my-damage">이번 주 내가 입힌 피해: {(progress?.myWeekDamage ?? 0).toLocaleString()}</div>
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
        클리어하면 이번 주 참여자 전원에게 <strong>7일간 공격력·방어력 20배</strong>의 "용의 버프"가 붙고, 닉네임이 화려하게 반짝여요.
        피해량에 비례한 골드 보상도 우편함으로 도착해요. 못 잡고 주가 끝나도, 그동안 입힌 피해량만큼 골드를 우편으로 보내드려요.
      </p>
    </div>
  );
}
