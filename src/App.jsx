import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { getMyProfile, signOut } from './lib/auth';
import { getActiveMonster, createStarter, persistMonsterGrowth } from './lib/monsters';
import { grantIdleReward } from './lib/economy';
import { fetchClearedStageIds, markStageCleared } from './lib/stageProgress';
import { fetchInventory, sumEquippedBonus } from './lib/inventory';
import { fetchUserSkills } from './lib/skillGacha';
import { resolveLoadout } from './lib/skillCatalog';
import { SKILLS as FALLBACK_SKILLS } from './lib/skills';
import { fetchDungeonAttemptsToday, fetchDungeonProgress, useDungeonAttempt, claimDungeonReward } from './lib/dungeon';
import { getDungeonStage } from './lib/dungeonStages';
import { startJobDungeon, claimJobDungeon } from './lib/jobDungeonApi';
import { getJobDungeonBoss } from './lib/jobDungeon';
import { hasPendingJobAdvancement } from './lib/jobAdvancement';
import { toStageIndex, fromStageIndex, TOTAL_STAGES, STAGES_PER_CHAPTER } from './lib/stages';
import { getChapterStory } from './lib/stageStory';

import AuthScreen from './components/AuthScreen';
import StoryIntro from './components/StoryIntro';
import ChapterStory from './components/ChapterStory';
import StarterSelect from './components/StarterSelect';
import BattleScreen from './components/BattleScreen';
import StageSelect from './components/StageSelect';
import Shop from './components/Shop';
import SkillGacha from './components/SkillGacha';
import MyPage from './components/MyPage';
import DungeonSelect from './components/DungeonSelect';
import DungeonBattle from './components/DungeonBattle';
import JobDungeonBattle from './components/JobDungeonBattle';
import Settings from './components/Settings';

const STAGE = {
  LOADING: 'loading',
  AUTH: 'auth',
  STORY: 'story',
  STARTER: 'starter',
  CHAPTER_STORY: 'chapterStory',
  GAME: 'game',
};

export default function App() {
  const [stage, setStage] = useState(STAGE.LOADING);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeMonster, setActiveMonster] = useState(null);
  const [clearedStageIds, setClearedStageIds] = useState(new Set());
  const [inventory, setInventory] = useState([]);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => handleSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
      const [p, monster, cleared, inv, skills, dungeon, progress] = await Promise.all([
        getMyProfile(),
        getActiveMonster(userId),
        fetchClearedStageIds(userId),
        fetchInventory(userId),
        fetchUserSkills(userId),
        fetchDungeonAttemptsToday(userId),
        fetchDungeonProgress(userId),
      ]);
      setProfile(p);
      setClearedStageIds(cleared);
      setInventory(inv);
      setUserSkills(skills);
      setDungeonAttempts(dungeon);
      setDungeonProgress(progress);

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
    const inv = await fetchInventory(session.user.id);
    setInventory(inv);
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
      setDungeonError(err.message ?? '입장에 실패했어요.');
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
      setJobError(err.message ?? '입장에 실패했어요.');
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
    } catch (err) {
      console.error('전직 적용 실패', err);
    }
  }

  async function handleLogout() {
    await signOut();
  }

  const { chapter, stage: stageNum } = fromStageIndex(currentStageIndex);
  const equipmentBonus = sumEquippedBonus(inventory);
  const resolvedSkills = resolveLoadout(profile?.equipped_skills, userSkills);
  // 스킬 뽑기 도입 이전 계정 등 장착 스킬이 하나도 없으면 전투 불가 상태가 되지 않도록 기본기 하나는 보장
  const equippedSkills = resolvedSkills.length > 0 ? resolvedSkills : [FALLBACK_SKILLS[0]];
  const jobAdvancementPending = activeMonster
    ? hasPendingJobAdvancement(activeMonster.element, activeMonster.level, activeMonster.unlockedJobTier ?? 0)
    : false;

  return (
    <div className="app-shell">
      {stage === STAGE.GAME && (
        <header className="app-header">
          <span className="app-title">GrowupGame</span>
          <div className="app-header-right">
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
          <StoryIntro
            onContinue={() => setStage(STAGE.STARTER)}
          />
        )}

        {stage === STAGE.STARTER && (
          <StarterSelect onSelect={handlePickStarter} loading={starterLoading} />
        )}

        {stage === STAGE.CHAPTER_STORY && pendingStage && (
          <ChapterStory
            {...getChapterStory(pendingStage.chapter)}
            onContinue={handleContinueFromChapterStory}
          />
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
              <button className={`tab-btn ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>🎯 스킬</button>
              <button className={`tab-btn ${activeTab === 'dungeon' ? 'active' : ''}`} onClick={() => setActiveTab('dungeon')}>🏰 던전</button>
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
                inventory={inventory}
                onInventoryChange={refreshInventory}
                onGoldChange={handleGoldChange}
              />
            )}
            {activeTab === 'skills' && (
              <SkillGacha
                userId={session.user.id}
                gold={profile?.gold ?? 0}
                totalDraws={profile?.total_skill_draws ?? 0}
                monsterLevel={activeMonster.level}
                userSkills={userSkills}
                equippedSkills={profile?.equipped_skills ?? []}
                onGoldChange={handleGoldChange}
                onSkillsRefresh={refreshSkills}
                onLoadoutChange={handleLoadoutChange}
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
                />
              )
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
