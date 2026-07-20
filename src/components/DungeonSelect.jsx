import { useEffect, useState } from 'react';
import { getDungeonStage, DUNGEON_STAGE_COUNT } from '../lib/dungeonStages';
import { fetchLuckyDungeonType, fetchDailyDungeonBonusType } from '../lib/dungeon';
import { JOB_DUNGEON_BOSS, JOB_DUNGEON_EXTRA_REQ } from '../lib/jobDungeon';
import { fetchWorldBossTopContributors, fetchMyWorldBossRank } from '../lib/worldBoss';
import { fetchTowerLeaderboard, fetchMyTowerRank, getTowerFloorMonster } from '../lib/tower';
import { useCountdownToDaily8AM, useCountdownToWeeklyReset } from '../lib/countdown';
import { showToast } from '../lib/toast';
import { EXPEDITION_TIERS, startExpedition, claimExpedition, fetchMyExpedition } from '../lib/expedition';

const DUNGEON_TABS = ['exp', 'gold', 'job', 'worldboss', 'tower', 'expedition'];

export default function DungeonSelect({
  attemptsRemaining, dungeonProgress, onEnterDungeon, entering, error,
  activeMonster, onEnterJobDungeon, jobEntering, jobError,
  activeType, onActiveTypeChange,
  worldBoss, worldBossProgress, onEnterWorldBoss, worldBossEntering, worldBossError,
  towerHighestFloor, onEnterTower, towerEntering, towerError,
  userId, onExpeditionGoldChange, missionNumber,
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
        <button className={`shop-tab ${activeType === 'tower' ? 'active' : ''}`} onClick={() => onActiveTypeChange('tower')}>
          🗼 무한의 탑
        </button>
        <button className={`shop-tab ${activeType === 'expedition' ? 'active' : ''}`} onClick={() => onActiveTypeChange('expedition')}>
          🧭 파견
        </button>
      </div>
      <p className="keyboard-hint">Tab / Shift+Tab으로 탭 이동</p>

      {activeType === 'job' ? (
        <JobDungeonPanel
          activeMonster={activeMonster}
          onEnter={onEnterJobDungeon}
          entering={jobEntering}
          error={jobError}
          towerHighestFloor={towerHighestFloor}
          missionNumber={missionNumber}
        />
      ) : activeType === 'worldboss' ? (
        <WorldBossPanel
          boss={worldBoss}
          progress={worldBossProgress}
          onEnter={onEnterWorldBoss}
          entering={worldBossEntering}
          error={worldBossError}
        />
      ) : activeType === 'tower' ? (
        <TowerPanel
          highestFloor={towerHighestFloor}
          onEnter={onEnterTower}
          entering={towerEntering}
          error={towerError}
        />
      ) : activeType === 'expedition' ? (
        <ExpeditionPanel userId={userId} onGoldChange={onExpeditionGoldChange} />
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
  const resetIn = useCountdownToDaily8AM();
  const [luckyType, setLuckyType] = useState(null);
  const [dailyBonusType, setDailyBonusType] = useState(null);

  useEffect(() => {
    fetchLuckyDungeonType().then(setLuckyType).catch(() => setLuckyType(null));
    fetchDailyDungeonBonusType().then(setDailyBonusType).catch(() => setDailyBonusType(null));
  }, []);

  const isLuckyDungeon = luckyType === type;
  const isDailyBonusDungeon = dailyBonusType === type;

  return (
    <div>
      <p className="stage-select-hint">
        1층부터 순서대로 깨야 다음 층으로 갈 수 있어요. 하루 3번까지 입장 가능(오늘 {remaining}/3회 남음, {resetIn} 후 초기화).
        {allCleared && ` 최고층까지 전부 클리어했어요! ${DUNGEON_STAGE_COUNT}층을 반복 도전할 수 있어요.`}
      </p>
      {isLuckyDungeon && (
        <p className="stage-select-hint lucky-dungeon-banner">🍀 이번 주는 {type === 'gold' ? '골드' : '경험치'} 던전이 행운의 던전이에요! 골드 보상 1.5배</p>
      )}
      {isDailyBonusDungeon && (
        <p className="stage-select-hint lucky-dungeon-banner">📅 오늘은 {type === 'gold' ? '골드' : '경험치'} 던전에 요일 보너스가 붙어요! 골드 보상 1.3배</p>
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

function JobDungeonPanel({ activeMonster, onEnter, entering, error, towerHighestFloor, missionNumber }) {
  if (!activeMonster) return null;
  const unlocked = activeMonster.unlockedJobTier ?? 0;

  return (
    <div>
      <p className="stage-select-hint">
        레벨 조건을 채우면 도전할 수 있어요. 일반 던전보다 훨씬 강해서 스킬을 잘 돌려써야 이길 수 있어요.
        6차 전직부터는 레벨 외에 무한의 탑 최소층·가이드미션 진행도·특정 업적 조건도 추가로 필요해요.
      </p>
      {error && <p className="shop-error">{error}</p>}

      <div className="job-dungeon-list">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((tier) => {
          const boss = JOB_DUNGEON_BOSS[tier];
          const extraReq = JOB_DUNGEON_EXTRA_REQ[tier];
          const isDone = unlocked >= tier;
          const levelOk = activeMonster.level >= boss.requiredLevel;
          const prevDone = unlocked === tier - 1;
          const towerOk = !extraReq?.towerFloor || (towerHighestFloor ?? 0) >= extraReq.towerFloor;
          const missionOk = !extraReq?.missionNumber || (missionNumber ?? 1) >= extraReq.missionNumber;
          // 업적 보유 여부는 클라이언트에서 미리 확인하지 않음(서버 start_job_dungeon이 최종 검증,
          // 부족하면 에러 메시지로 정확히 안내함) - 여기선 조건 텍스트만 미리 보여줌
          const isEligible = levelOk && prevDone && towerOk && missionOk;
          const isLocked = !isDone && !isEligible;
          return (
            <div key={tier} className={`job-dungeon-card ${isDone ? 'done' : ''}`}>
              <div className="job-dungeon-tier">{tier}차 전직</div>
              <div className="job-dungeon-boss">{boss.name}</div>
              <div className="job-dungeon-req">필요 레벨 Lv.{boss.requiredLevel} · 체력 {boss.hp.toLocaleString()} · ⚔️{boss.atk.toLocaleString()} · 🛡️{boss.def.toLocaleString()}</div>
              {extraReq && (
                <div className="job-dungeon-extra-req">
                  추가 조건: {extraReq.towerFloor && `무한의 탑 ${extraReq.towerFloor}층 이상`}
                  {extraReq.missionNumber && ` · 가이드미션 ${extraReq.missionNumber}개 이상 진행`}
                  {extraReq.achievementTitle && ` · 업적 "${extraReq.achievementTitle}" 보유`}
                </div>
              )}
              {isDone ? (
                <span className="job-dungeon-done-badge">✅ 완료</span>
              ) : (
                <button
                  className={`btn btn-challenge ${isLocked ? 'btn-unaffordable' : ''}`}
                  disabled={entering}
                  onClick={() => {
                    if (isLocked) {
                      let reason = `레벨이 부족합니다. (Lv.${boss.requiredLevel} 필요)`;
                      if (unlocked < tier - 1) reason = '이전 단계 전직을 먼저 완료해야 합니다.';
                      else if (!towerOk) reason = `무한의 탑 ${extraReq.towerFloor}층 이상 도달해야 합니다.`;
                      else if (!missionOk) reason = `가이드미션을 ${extraReq.missionNumber}개 이상 진행해야 합니다.`;
                      showToast(reason, 'error');
                      return;
                    }
                    onEnter(tier);
                  }}
                >
                  {isLocked
                    ? (unlocked < tier - 1 ? '이전 단계 필요' : !levelOk ? `Lv.${boss.requiredLevel} 필요` : '조건 미달성')
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
        전체 유저가 함께 체력을 깎는 공용 보스예요. {weeklyResetIn} 후(매주 일요일 자정, 서울시간)에 체력이 초기화돼요.
        하루 3번까지 도전 가능(오늘 {Math.max(0, remaining)}/3회 남음, {resetIn} 후 초기화).
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
        클리어하면 이번 주 참여자 전원에게 <strong>7일간 공격력·방어력 20배</strong>의 "용의 버프"가 붙고, 닉네임이 화려하게 반짝여요.
        피해량에 비례한 골드 보상도 우편함으로 도착해요. 못 잡고 주가 끝나도, 그동안 입힌 피해량만큼 골드를 우편으로 보내드려요.
      </p>

      {topContributors && topContributors.length > 0 && (
        <div className="worldboss-top-contributors">
          <h4 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🏅 이번 주 기여자 TOP {topContributors.length}</h4>
          <div className="worldboss-contributor-list">
            {topContributors.map((c, i) => (
              <div key={i} className="worldboss-contributor-row">
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

function TowerPanel({ highestFloor, onEnter, entering, error }) {
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
        상한도, 입장 횟수 제한도 없이 계속 올라가는 도전 모드예요. 한 층씩 순서대로 도전하고, 이기면 다음 층으로 최고기록이 갱신돼요.
        올라갈수록 훨씬 강한 수호자가 나오니 장비/스킬을 충분히 갖추고 도전하세요. 몇 번이고 재도전할 수 있어요!
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
              <div key={row.rank} className={`worldboss-contributor-row ${row.is_me ? 'inventory-row--equipped' : ''}`}>
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

function ExpeditionPanel({ userId, onGoldChange }) {
  const [expedition, setExpedition] = useState(undefined); // undefined=로딩중, null=없음, {}=진행중
  const [starting, setStarting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    fetchMyExpedition(userId).then(setExpedition).catch(() => setExpedition(null));
  }, [userId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleStart(tier) {
    setError('');
    setStarting(true);
    try {
      const res = await startExpedition(tier);
      setExpedition({ tier, started_at: res.startedAt, duration_seconds: res.durationSeconds, claimed: false });
    } catch (err) {
      setError(err.message ?? '파견 시작에 실패했어요.');
      showToast(err.message ?? '파견 시작에 실패했어요.', 'error');
    } finally {
      setStarting(false);
    }
  }

  async function handleClaim() {
    setClaiming(true);
    try {
      const res = await claimExpedition();
      showToast(`🧭 파견 완료! 골드 +${res.gold.toLocaleString()}`, 'success');
      onGoldChange?.(res.gold);
      setExpedition(null);
    } catch (err) {
      showToast(err.message ?? '수령에 실패했어요.', 'error');
    } finally {
      setClaiming(false);
    }
  }

  if (expedition === undefined) {
    return <p className="stage-select-hint">불러오는 중...</p>;
  }

  const remainingMs = expedition
    ? new Date(expedition.started_at).getTime() + expedition.duration_seconds * 1000 - now
    : 0;
  const isDone = expedition && remainingMs <= 0;

  return (
    <div>
      <p className="stage-select-hint">
        몬스터를 잠깐 파견 보내면 시간이 지난 뒤 골드를 받을 수 있어요. 전투/자동사냥과 전혀 겹치지 않고
        병행되는 별개의 타이머예요 — 앱을 꺼두고 있어도 시간은 그대로 흘러요. 오프라인 방치 보상보다
        훨씬 긴 시간(최대 12시간)을 커버해요.
      </p>

      {error && <p className="shop-error">{error}</p>}

      {!expedition ? (
        <div className="gacha-draw-buttons">
          {Object.entries(EXPEDITION_TIERS).map(([tier, meta]) => (
            <button key={tier} className="btn btn-neutral" disabled={starting} onClick={() => handleStart(tier)}>
              {meta.icon} {meta.label} ({meta.hours < 1 ? `${meta.hours * 60}분` : `${meta.hours}시간`})
            </button>
          ))}
        </div>
      ) : (
        <div className="worldboss-hp-card">
          <div className="worldboss-hp-title">
            {EXPEDITION_TIERS[expedition.tier].icon} {EXPEDITION_TIERS[expedition.tier].label} 진행 중
          </div>
          {isDone ? (
            <button className="btn btn-challenge" disabled={claiming} onClick={handleClaim} style={{ marginTop: 10 }}>
              {claiming ? '수령 중...' : '🎁 파견 완료! 보상 받기'}
            </button>
          ) : (
            <p className="mypage-locked-hint" style={{ margin: '4px 0 0' }}>
              남은 시간: {formatRemaining(remainingMs)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatRemaining(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}
