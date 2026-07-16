import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { getMyProfile, signOut } from './lib/auth';
import { getActiveMonster, createStarter, persistMonsterGrowth } from './lib/monsters';
import { grantIdleReward } from './lib/economy';
import { fetchClearedStageIds, markStageCleared } from './lib/stageProgress';
import { fetchInventory, getTotalEquipmentBonus } from './lib/inventory';
import { fetchEquipmentDrawProgress } from './lib/equipmentDrawProgress';
import { fetchUserSkills } from './lib/skillGacha';
import { resolveLoadout } from './lib/skillCatalog';
import { SKILLS as FALLBACK_SKILLS } from './lib/skills';
import { fetchDungeonAttemptsToday, fetchDungeonProgress, useDungeonAttempt, claimDungeonReward } from './lib/dungeon';
import { getDungeonStage } from './lib/dungeonStages';
import { startJobDungeon, claimJobDungeon } from './lib/jobDungeonApi';
import { getJobDungeonBoss } from './lib/jobDungeon';
import { hasPendingJobAdvancement } from './lib/jobAdvancement';
import { usePwaInstall } from './lib/usePwaInstall';
import { showToast } from './lib/toast';
import { fetchOrInitMissionState, claimMissionReward, bumpMission, subscribeMissionUpdate } from './lib/missions';
import MissionFloatingButton from './components/MissionFloatingButton';
import { toStageIndex, fromStageIndex, TOTAL_STAGES, STAGES_PER_CHAPTER } from './lib/stages';
import { getChapterStory } from './lib/stageStory';

import AuthScreen from './components/AuthScreen';
import ToastContainer from './components/ToastContainer';
import StoryIntro from './components/StoryIntro';
import ChapterStory from './components/ChapterStory';
import StarterSelect from './components/StarterSelect';
import BattleScreen from './components/BattleScreen';
import StageSelect from './components/StageSelect';
import Shop from './components/Shop';
import Inventory from './components/Inventory';
import MyPage from './components/MyPage';
import DungeonSelect from './components/DungeonSelect';
import DungeonBattle from './components/DungeonBattle';
import JobDungeonBattle from './components/JobDungeonBattle';
import Settings from './components/Settings';
import PvP from './components/PvP';
import LobbyChat from './components/LobbyChat';

const STAGE = {
  LOADING: 'loading',
  AUTH: 'auth',
  STORY: 'story',
  STARTER: 'starter',
  CHAPTER_STORY: 'chapterStory',
  GAME: 'game',
};

export default function App() {
  const { canInstall, promptInstall } = usePwaInstall();
  const [stage, setStage] = useState(STAGE.LOADING);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeMonster, setActiveMonster] = useState(null);
  const [clearedStageIds, setClearedStageIds] = useState(new Set());
  const [inventory, setInventory] = useState([]);
  const [equipmentDrawProgress, setEquipmentDrawProgress] = useState({ weapon: 0, armor: 0, gloves: 0, shoes: 0 });
  const [userSkills, setUserSkills] = useState([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(1);
  const [pendingStage, setPendingStage] = useState(null);
  const [activeTab, setActiveTab] = useState('battle'); // battle | stage | shop | skills | mypage
  const [starterLoading, setStarterLoading] = useState(false);
  const [error, setError] = useState('');
  const [dungeonAttempts, setDungeonAttempts] = useState({ exp: 3, gold: 3 });
  const [dungeonProgress, setDungeonProgress] = useState({ exp: 0, gold: 0 });
  const [dungeonBattle, setDungeonBattle] = useState(null); // { type, stage, sessionId } | null
  const [dungeonEntering, setDungeonEntering] = useState(false);
  const [dungeonError, setDungeonError] = useState('');
  const [jobDungeonBattle, setJobDungeonBattle] = useState(null); // { tier, sessionId } | null
  const [jobEntering, setJobEntering] = useState(false);
  const [jobError, setJobError] = useState('');
  const [dungeonActiveType, setDungeonActiveType] = useState('exp'); // 'exp' | 'gold' | 'job' - 던전 탭 안에서 왔다갔다 해도 유지
  const [mission, setMission] = useState(null);
  const [claimingMission, setClaimingMission] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => handleSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 다른 화면(전투/던전/뽑기)에서 미션 진행도를 올리면 여기서도 즉시 반영
  useEffect(() => subscribeMissionUpdate(setMission), []);

  // "N분 접속 유지하기" 미션 진행 - 1분마다 체크
  useEffect(() => {
    if (stage !== STAGE.GAME) return;
    const timer = setInterval(() => {
      if (mission?.mission_key === 'login_minutes') {
        bumpMission('login_minutes', 1);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [stage, mission?.mission_key]);

  // Esc로 마이페이지/설정 화면 닫고 전투탭으로 복귀 (다른 화면에선 아무 동작 안 함)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (stage === STAGE.GAME && (activeTab === 'mypage' || activeTab === 'settings')) {
        setActiveTab('battle');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, activeTab]);

  async function handleSession(newSession) {
    setSession(newSession);
    if (!newSession) {
      setStage(STAGE.AUTH);
      setProfile(null);
      setActiveMonster(null);
      return;
    }
    try {
      const userId = newSession.user.id;
      const [p, monster, cleared, inv, skills, dungeon, progress, equipDraws, missionState] = await Promise.all([
        getMyProfile(),
        getActiveMonster(userId),
        fetchClearedStageIds(userId),
        fetchInventory(userId),
        fetchUserSkills(userId),
        fetchDungeonAttemptsToday(userId),
        fetchDungeonProgress(userId),
        fetchEquipmentDrawProgress(userId),
        fetchOrInitMissionState(),
      ]);
      setProfile(p);
      setClearedStageIds(cleared);
      setInventory(inv);
      setUserSkills(skills);
      setDungeonAttempts(dungeon);
      setDungeonProgress(progress);
      setEquipmentDrawProgress(equipDraws);
      setMission(missionState);

      if (!monster) {
        setStage(STAGE.STORY);
        return;
      }
      setActiveMonster(monster);

      const resumeIndex = cleared.size ? Math.min(Math.max(...cleared) + 1, TOTAL_STAGES) : 1;
      setCurrentStageIndex(resumeIndex);
      setActiveTab('battle');
      setStage(STAGE.GAME);
    } catch (err) {
      setError(err.message ?? '데이터를 불러오지 못했어요.');
    }
  }

  async function handlePickStarter(speciesId) {
    setStarterLoading(true);
    try {
      const monster = await createStarter(session.user.id, speciesId);
      const [p, skills] = await Promise.all([
        getMyProfile(),
        fetchUserSkills(session.user.id),
      ]);
      setProfile(p);
      setUserSkills(skills);
      setActiveMonster(monster);
      setCurrentStageIndex(1);
      setActiveTab('battle');
      setStage(STAGE.GAME);
    } catch (err) {
      setError(err.message ?? '몬스터 생성에 실패했어요.');
    } finally {
      setStarterLoading(false);
    }
  }

  const refreshSkills = useCallback(async () => {
    if (!session) return;
    const skills = await fetchUserSkills(session.user.id);
    setUserSkills(skills);
  }, [session]);

  function handleLoadoutChange(newEquippedKeys) {
    setProfile((p) => ({ ...p, equipped_skills: newEquippedKeys }));
  }

  const refreshInventory = useCallback(async () => {
    if (!session) return;
    const [inv, drawProgress] = await Promise.all([
      fetchInventory(session.user.id),
      fetchEquipmentDrawProgress(session.user.id),
    ]);
    setInventory(inv);
    setEquipmentDrawProgress(drawProgress);
  }, [session]);

  function handleGoldChange(newGold) {
    setProfile((p) => ({ ...p, gold: newGold }));
  }

  function handleSelectStage(chapter, stageNum) {
    const chapterHasProgress = Array.from({ length: STAGES_PER_CHAPTER }, (_, i) => i + 1).some((s) =>
      clearedStageIds.has(toStageIndex(chapter, s))
    );
    if (!chapterHasProgress && chapter > 1) {
      setPendingStage({ chapter, stage: stageNum });
      setStage(STAGE.CHAPTER_STORY);
      return;
    }
    setCurrentStageIndex(toStageIndex(chapter, stageNum));
    setActiveTab('battle');
  }

  function handleContinueFromChapterStory() {
    if (pendingStage) {
      setCurrentStageIndex(toStageIndex(pendingStage.chapter, pendingStage.stage));
      setPendingStage(null);
    }
    setActiveTab('battle');
    setStage(STAGE.GAME);
  }

  async function handleClear(grownBase, _clientGoldEstimate) {
    setActiveMonster(grownBase);
    const userId = session.user.id;
    try {
      const [, grantedGold] = await Promise.all([
        persistMonsterGrowth(grownBase.ownedMonsterId, grownBase),
        markStageCleared(userId, currentStageIndex),
      ]);
      setProfile((p) => ({ ...p, gold: p.gold + grantedGold }));
      setClearedStageIds((prev) => new Set(prev).add(currentStageIndex));
      bumpMission('kill_monsters', 1);
    } catch (err) {
      console.error('클리어 저장 실패', err);
    }
  }

  async function handleIdleGain(grownBase, _clientGoldEstimate) {
    setActiveMonster(grownBase);
    try {
      const [, grantedGold] = await Promise.all([
        persistMonsterGrowth(grownBase.ownedMonsterId, grownBase),
        grantIdleReward(chapter, grownBase.level),
      ]);
      setProfile((p) => ({ ...p, gold: p.gold + grantedGold }));
      bumpMission('kill_monsters', 1);
    } catch (err) {
      console.error('자동 사냥 저장 실패', err);
    }
  }

  function handleAdvance() {
    const nextIndex = Math.min(currentStageIndex + 1, TOTAL_STAGES);
    const { chapter: nextChapter, stage: nextStage } = fromStageIndex(nextIndex);
    handleSelectStage(nextChapter, nextStage);
  }

  async function handleEnterDungeon(type) {
    setDungeonError('');
    setDungeonEntering(true);
    try {
      const { sessionId, remaining, stage } = await useDungeonAttempt(type);
      setDungeonAttempts((prev) => ({ ...prev, [type]: remaining }));
      setDungeonBattle({ type, stage, sessionId });
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setDungeonError(message);
      showToast(message, 'error');
    } finally {
      setDungeonEntering(false);
    }
  }

  async function handleDungeonClear(grownBase, _clientGoldEstimate) {
    setActiveMonster(grownBase);
    try {
      const [, grantedGold] = await Promise.all([
        persistMonsterGrowth(grownBase.ownedMonsterId, grownBase),
        claimDungeonReward(dungeonBattle.sessionId),
      ]);
      setProfile((p) => ({ ...p, gold: p.gold + grantedGold }));
      setDungeonProgress((prev) => ({
        ...prev,
        [dungeonBattle.type]: Math.max(prev[dungeonBattle.type] ?? 0, dungeonBattle.stage),
      }));
      bumpMission('kill_monsters', 1);
    } catch (err) {
      console.error('던전 보상 저장 실패', err);
    }
  }

  async function handleEnterJobDungeon(tier) {
    setJobError('');
    setJobEntering(true);
    try {
      const sessionId = await startJobDungeon(tier);
      setJobDungeonBattle({ tier, sessionId });
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setJobError(message);
      showToast(message, 'error');
    } finally {
      setJobEntering(false);
    }
  }

  async function handleJobDungeonWin(grownBase) {
    setActiveMonster(grownBase);
    try {
      await persistMonsterGrowth(grownBase.ownedMonsterId, grownBase);
      await claimJobDungeon(jobDungeonBattle.sessionId);
      const refreshed = await getActiveMonster(session.user.id);
      if (refreshed) setActiveMonster(refreshed);
      bumpMission('kill_monsters', 1);
    } catch (err) {
      console.error('전직 적용 실패', err);
    }
  }

  async function handleLogout() {
    await signOut();
  }

  async function handleClaimMission() {
    if (!mission || mission.progress < mission.target) return;
    setClaimingMission(true);
    try {
      const reward = mission.reward_gold;
      const nextMission = await claimMissionReward();
      setMission(nextMission);
      setProfile((p) => ({ ...p, gold: p.gold + reward }));
      showToast(`미션 완료! 💰 ${reward.toLocaleString()} 획득`, 'success');
    } catch (err) {
      showToast(err.message ?? '보상 수령에 실패했어요.', 'error');
    } finally {
      setClaimingMission(false);
    }
  }

  const { chapter, stage: stageNum } = fromStageIndex(currentStageIndex);
  const equipmentBonus = getTotalEquipmentBonus(inventory);
  const resolvedSkills = resolveLoadout(profile?.equipped_skills, userSkills);
  // 스킬 뽑기 도입 이전 계정 등 장착 스킬이 하나도 없으면 전투 불가 상태가 되지 않도록 기본기 하나는 보장
  const equippedSkills = resolvedSkills.length > 0 ? resolvedSkills : [FALLBACK_SKILLS[0]];
  const jobAdvancementPending = activeMonster
    ? hasPendingJobAdvancement(activeMonster.element, activeMonster.level, activeMonster.unlockedJobTier ?? 0)
    : false;

  return (
    <div className="app-shell">
      <ToastContainer />
      {stage === STAGE.GAME && (
        <MissionFloatingButton mission={mission} onClaim={handleClaimMission} claiming={claimingMission} />
      )}
      {stage === STAGE.GAME && (
        <header className="app-header">
          <span className="app-title">GrowupGame</span>
          <div className="app-header-right">
            {canInstall && (
              <button className="btn btn-neutral" onClick={promptInstall}>⬇️ 앱 다운로드</button>
            )}
            {profile && <span className="gold-display">💰 {profile.gold?.toLocaleString() ?? 0}</span>}
            {profile && <span className="app-nickname">{profile.nickname}</span>}
            <button className="btn btn-ghost" onClick={() => setActiveTab('mypage')}>👤 마이페이지</button>
            <button className="btn btn-ghost" onClick={() => setActiveTab('settings')}>⚙️ 설정</button>
            <button className="btn btn-ghost" onClick={handleLogout}>로그아웃</button>
          </div>
        </header>
      )}

      {error && <p className="app-error">{error}</p>}

      <main className="app-main">
        {stage === STAGE.LOADING && <p className="app-loading">불러오는 중...</p>}

        {stage === STAGE.AUTH && (
          <div className="center-viewport">
            <AuthScreen onAuthed={() => {}} />
          </div>
        )}

        {stage === STAGE.STORY && (
          <div className="center-viewport">
            <StoryIntro onContinue={() => setStage(STAGE.STARTER)} />
          </div>
        )}

        {stage === STAGE.STARTER && (
          <StarterSelect onSelect={handlePickStarter} loading={starterLoading} />
        )}

        {stage === STAGE.CHAPTER_STORY && pendingStage && (
          <div className="center-viewport">
            <ChapterStory
              {...getChapterStory(pendingStage.chapter)}
              onContinue={handleContinueFromChapterStory}
            />
          </div>
        )}

        {stage === STAGE.GAME && activeMonster && (
          <div className="game-shell">
            {jobAdvancementPending && (
              <button className="job-advancement-banner" onClick={() => setActiveTab('dungeon')}>
                ✨ 전직 가능! 전직 던전에 도전해서 더 강해지고 외형도 바꿔보세요.
              </button>
            )}

            <nav className="tab-nav">
              <button className={`tab-btn ${activeTab === 'battle' ? 'active' : ''}`} onClick={() => setActiveTab('battle')}>⚔️ 전투</button>
              <button className={`tab-btn ${activeTab === 'stage' ? 'active' : ''}`} onClick={() => setActiveTab('stage')}>🗺️ 스테이지</button>
              <button className={`tab-btn ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => setActiveTab('shop')}>🛒 상점</button>
              <button className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>🎒 인벤토리</button>
              <button className={`tab-btn ${activeTab === 'dungeon' ? 'active' : ''}`} onClick={() => setActiveTab('dungeon')}>🏰 던전</button>
              <button className={`tab-btn ${activeTab === 'pvp' ? 'active' : ''}`} onClick={() => setActiveTab('pvp')}>⚔️ PvP</button>
              <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>💬 로비</button>
            </nav>

            {activeTab === 'battle' && (
              <BattleScreen
                key={currentStageIndex}
                initialMonster={activeMonster}
                chapter={chapter}
                stage={stageNum}
                equipmentBonus={equipmentBonus}
                equippedSkills={equippedSkills}
                onClear={handleClear}
                onIdleGain={handleIdleGain}
                onAdvance={handleAdvance}
                onGoStageList={() => setActiveTab('stage')}
              />
            )}
            {activeTab === 'stage' && (
              <StageSelect
                clearedStageIds={clearedStageIds}
                currentStageIndex={currentStageIndex}
                onSelectStage={handleSelectStage}
              />
            )}
            {activeTab === 'shop' && (
              <Shop
                userId={session.user.id}
                gold={profile?.gold ?? 0}
                equipmentDrawProgress={equipmentDrawProgress}
                totalSkillDraws={profile?.total_skill_draws ?? 0}
                monsterLevel={activeMonster.level}
                userSkills={userSkills}
                equippedSkills={profile?.equipped_skills ?? []}
                onInventoryChange={refreshInventory}
                onGoldChange={handleGoldChange}
                onSkillsRefresh={refreshSkills}
                onLoadoutChange={handleLoadoutChange}
              />
            )}
            {activeTab === 'inventory' && (
              <Inventory
                userId={session.user.id}
                inventory={inventory}
                onInventoryChange={refreshInventory}
              />
            )}
            {activeTab === 'dungeon' && (
              jobDungeonBattle ? (
                <JobDungeonBattle
                  key={`job-${jobDungeonBattle.tier}-${jobDungeonBattle.sessionId}`}
                  initialMonster={activeMonster}
                  equipmentBonus={equipmentBonus}
                  equippedSkills={equippedSkills}
                  jobBoss={getJobDungeonBoss(jobDungeonBattle.tier, activeMonster.element)}
                  onWin={handleJobDungeonWin}
                  onExit={() => setJobDungeonBattle(null)}
                />
              ) : dungeonBattle ? (
                <DungeonBattle
                  key={`${dungeonBattle.type}-${dungeonBattle.stage}-${dungeonBattle.sessionId}`}
                  initialMonster={activeMonster}
                  equipmentBonus={equipmentBonus}
                  equippedSkills={equippedSkills}
                  dungeonEnemy={getDungeonStage(dungeonBattle.type, dungeonBattle.stage)}
                  onClear={handleDungeonClear}
                  onExit={() => setDungeonBattle(null)}
                />
              ) : (
                <DungeonSelect
                  attemptsRemaining={dungeonAttempts}
                  dungeonProgress={dungeonProgress}
                  onEnterDungeon={handleEnterDungeon}
                  entering={dungeonEntering}
                  error={dungeonError}
                  activeMonster={activeMonster}
                  onEnterJobDungeon={handleEnterJobDungeon}
                  jobEntering={jobEntering}
                  jobError={jobError}
                  activeType={dungeonActiveType}
                  onActiveTypeChange={setDungeonActiveType}
                />
              )
            )}
            {activeTab === 'pvp' && (
              <PvP
                userId={session.user.id}
                profile={profile}
                onCurrencyChange={(newCurrency) => setProfile((p) => ({ ...p, pvp_currency: newCurrency }))}
              />
            )}
            {activeTab === 'chat' && (
              <LobbyChat profile={profile} />
            )}
            {activeTab === 'mypage' && (
              <MyPage
                session={session}
                profile={profile}
                activeMonster={activeMonster}
                clearedCount={clearedStageIds.size}
                totalStages={TOTAL_STAGES}
                onProfileUpdate={setProfile}
              />
            )}
            {activeTab === 'settings' && (
              <Settings
                userId={session.user.id}
                gold={profile?.gold ?? 0}
                onGoldChange={handleGoldChange}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
