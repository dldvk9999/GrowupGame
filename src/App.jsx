import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { getMyProfile, signOut } from './lib/auth';
import { getActiveMonster, createStarter, persistMonsterGrowth } from './lib/monsters';
import { grantIdleReward } from './lib/economy';
import { fetchClearedStageIds, markStageCleared } from './lib/stageProgress';
import { fetchInventory, getTotalEquipmentBonus, isFullSetEquipped } from './lib/inventory';
import { getItem } from './lib/itemCatalog';
import { fetchEquipmentDrawProgress } from './lib/equipmentDrawProgress';
import { fetchUserSkills } from './lib/skillGacha';
import { resolveLoadout, getSkillSlotCount, sumSkillPossessionBonus } from './lib/skillCatalog';
import { SKILLS as FALLBACK_SKILLS } from './lib/skills';
import { fetchDungeonAttemptsToday, fetchDungeonProgress, useDungeonAttempt, claimDungeonReward } from './lib/dungeon';
import { getDungeonStage } from './lib/dungeonStages';
import { startJobDungeon, claimJobDungeon } from './lib/jobDungeonApi';
import { getJobDungeonBoss } from './lib/jobDungeon';
import { hasPendingJobAdvancement } from './lib/jobAdvancement';
import { usePwaInstall } from './lib/usePwaInstall';
import { showToast } from './lib/toast';
import { fetchOrInitMissionState, claimMissionReward, bumpMission, subscribeMissionUpdate, isMissionComplete } from './lib/missions';
import { fetchMails } from './lib/mail';
import { fetchAttendanceState, hasClaimedToday } from './lib/attendance';
import { fetchDailyFreeDrawState, hasUsedFreeDrawToday } from './lib/dailyFreeDraw';
import { hasSeenLatestPatchNote } from './lib/patchNotes';
import MissionFloatingButton from './components/MissionFloatingButton';
import AttendanceModal from './components/AttendanceModal';
import DailyChecklist from './components/DailyChecklist';
import { toStageIndex, fromStageIndex, TOTAL_STAGES, STAGES_PER_CHAPTER } from './lib/stages';
import { getChapterStory } from './lib/stageStory';

import AuthScreen from './components/AuthScreen';
import ToastContainer from './components/ToastContainer';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import StoryIntro from './components/StoryIntro';
import ChapterStory from './components/ChapterStory';
import StarterSelect from './components/StarterSelect';
import BattleScreen from './components/BattleScreen';
import StageSelect from './components/StageSelect';
import Shop from './components/Shop';
import SkillLoadout from './components/SkillLoadout';
import Inventory from './components/Inventory';
import MyPage from './components/MyPage';
import DungeonSelect from './components/DungeonSelect';
import WorldBossBattle from './components/WorldBossBattle';
import { fetchWorldBoss, fetchMyWorldBossProgress, enterWorldBoss, hasEverParticipatedInWorldBoss } from './lib/worldBoss';
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
  const [worldBoss, setWorldBoss] = useState(null);
  const [worldBossProgress, setWorldBossProgress] = useState(null);
  const [everParticipatedWorldBoss, setEverParticipatedWorldBoss] = useState(false);
  const [worldBossSession, setWorldBossSession] = useState(null); // enterWorldBoss() 결과 | null
  const [worldBossEntering, setWorldBossEntering] = useState(false);
  const [worldBossError, setWorldBossError] = useState('');
  const [dungeonActiveType, setDungeonActiveType] = useState('exp'); // 'exp' | 'gold' | 'job' - 던전 탭 안에서 왔다갔다 해도 유지
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginAt, setLoginAt] = useState(null); // 로비 채팅을 "이 시점 이후"로만 보여주기 위한 기준시각
  const [mission, setMission] = useState(null);
  const [claimingMission, setClaimingMission] = useState(false);
  const [hasUnreadMail, setHasUnreadMail] = useState(false);
  const [hasNewPatchNote, setHasNewPatchNote] = useState(() => !hasSeenLatestPatchNote());
  const [attendanceState, setAttendanceState] = useState(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [freeDrawUsedToday, setFreeDrawUsedToday] = useState(null); // null=로딩중

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
      // 공유 기기에서 A 로그아웃 -> B 로그인 시, 새 세션 로드가 끝나기 전까지 A의 잔여 데이터가
      // 화면에 잠깐 보이는 걸 막기 위해 게임 데이터 state를 전부 초기값으로 리셋함
      // (todo.md에 있던 "로그아웃 시 상태 초기화 일부만 됨" 유지보수 항목 정리)
      setProfile(null);
      setActiveMonster(null);
      setClearedStageIds(new Set());
      setInventory([]);
      setEquipmentDrawProgress({ weapon: 0, armor: 0, gloves: 0, shoes: 0 });
      setUserSkills([]);
      setCurrentStageIndex(1);
      setPendingStage(null);
      setActiveTab('battle');
      setDungeonAttempts({ exp: 3, gold: 3 });
      setDungeonProgress({ exp: 0, gold: 0 });
      setDungeonBattle(null);
      setJobDungeonBattle(null);
      setWorldBoss(null);
      setWorldBossProgress(null);
      setEverParticipatedWorldBoss(false);
      setWorldBossSession(null);
      setMission(null);
      setHasUnreadMail(false);
      setAttendanceState(null);
      setFreeDrawUsedToday(null);
      setLoginAt(null);
      return;
    }
    try {
      const userId = newSession.user.id;
      const [p, monster, cleared, inv, skills, dungeon, progress, equipDraws, missionState, worldBossState, worldBossProg, mails, attendance, everParticipated, freeDrawState] = await Promise.all([
        getMyProfile(),
        getActiveMonster(userId),
        fetchClearedStageIds(userId),
        fetchInventory(userId),
        fetchUserSkills(userId),
        fetchDungeonAttemptsToday(userId),
        fetchDungeonProgress(userId),
        fetchEquipmentDrawProgress(userId),
        fetchOrInitMissionState(),
        fetchWorldBoss(),
        fetchMyWorldBossProgress(),
        fetchMails(userId).catch(() => []),
        fetchAttendanceState(userId).catch(() => null),
        hasEverParticipatedInWorldBoss(userId).catch(() => false),
        fetchDailyFreeDrawState(userId).catch(() => null),
      ]);
      setProfile(p);
      setClearedStageIds(cleared);
      setInventory(inv);
      setUserSkills(skills);
      setDungeonAttempts(dungeon);
      setDungeonProgress(progress);
      setEquipmentDrawProgress(equipDraws);
      setMission(missionState);
      setWorldBoss(worldBossState);
      setWorldBossProgress(worldBossProg);
      setHasUnreadMail(mails.some((m) => !m.claimed));
      setAttendanceState(attendance);
      setEverParticipatedWorldBoss(everParticipated);
      setFreeDrawUsedToday(hasUsedFreeDrawToday(freeDrawState));
      setLoginAt(new Date().toISOString());

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
    const [skills, p] = await Promise.all([fetchUserSkills(session.user.id), getMyProfile()]);
    setUserSkills(skills);
    setProfile(p);
  }, [session]);

  function handleLoadoutChange(newEquippedKeys) {
    setProfile((p) => ({ ...p, equipped_skills: newEquippedKeys }));
  }

  function handleCostumeLoadoutChange(newEquippedKeys) {
    setProfile((p) => ({ ...p, equipped_costumes: newEquippedKeys }));
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

  async function refreshWorldBoss() {
    try {
      const [boss, progress] = await Promise.all([fetchWorldBoss(), fetchMyWorldBossProgress()]);
      setWorldBoss(boss);
      setWorldBossProgress(progress);
    } catch (err) {
      console.error('월드보스 정보 로드 실패', err);
    }
  }

  async function handleEnterWorldBoss() {
    setWorldBossError('');
    setWorldBossEntering(true);
    try {
      const sessionData = await enterWorldBoss();
      setWorldBossSession(sessionData);
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setWorldBossError(message);
      showToast(message, 'error');
    } finally {
      setWorldBossEntering(false);
    }
  }

  function handleWorldBossSettled(res) {
    setWorldBoss((prev) => (prev ? { ...prev, currentHp: res.newCurrentHp, cleared: res.clearedNow } : prev));
    if (res.clearedNow) {
      setProfile((p) => ({ ...p, dragon_buff_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }));
      showToast('🐉 월드보스 처치! 7일간 용의 버프(공격력·방어력 20배)가 적용됐어요. 골드 보상은 우편함에서 받아가세요!', 'success');
    }
    refreshWorldBoss();
  }

  async function handleLogout() {
    await signOut();
  }

  async function handleClaimMission() {
    if (!missionCompleted) return;
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
  const equipmentOnlyBonus = getTotalEquipmentBonus(inventory);
  const skillPossessionAtk = sumSkillPossessionBonus(userSkills);
  const dragonBuffActive = !!(profile?.dragon_buff_until && new Date(profile.dragon_buff_until) > new Date());
  const baseAtkWithBonus = (activeMonster?.atk ?? 0) + equipmentOnlyBonus.atk + skillPossessionAtk;
  const baseDefWithBonus = (activeMonster?.def ?? 0) + equipmentOnlyBonus.def;
  const equipmentBonus = {
    // 용의 버프(월드보스 클리어 보상)가 켜져 있으면 "지금의" 공격력/방어력이 그대로 20배가 되도록,
    // 기존 보너스에 19배만큼을 추가로 얹어줌 (base + bonus*20 = base*20 + equipBonus*20)
    atk: equipmentOnlyBonus.atk + skillPossessionAtk + (dragonBuffActive ? baseAtkWithBonus * 19 : 0),
    def: equipmentOnlyBonus.def + (dragonBuffActive ? baseDefWithBonus * 19 : 0),
    hp: equipmentOnlyBonus.hp,
  };
  const resolvedSkills = resolveLoadout(profile?.equipped_skills, userSkills);
  // 스킬 뽑기 도입 이전 계정 등 장착 스킬이 하나도 없으면 전투 불가 상태가 되지 않도록 기본기 하나는 보장
  const equippedSkills = resolvedSkills.length > 0 ? resolvedSkills : [FALLBACK_SKILLS[0]];
  const jobAdvancementPending = activeMonster
    ? hasPendingJobAdvancement(activeMonster.element, activeMonster.level, activeMonster.unlockedJobTier ?? 0)
    : false;
  // 전직/스킬슬롯 온보딩 미션은 progress 카운터가 아니라 실제 게임 상태로 완료 여부를 판정해야 함
  const missionCompleted = isMissionComplete(mission, {
    unlockedJobTier: activeMonster?.unlockedJobTier ?? 0,
    equippedSkillCount: (profile?.equipped_skills ?? []).length,
    skillSlotLimit: getSkillSlotCount(activeMonster?.level ?? 1),
  });

  return (
    <div className="app-shell">
      <ToastContainer />
      <PwaUpdatePrompt />
      {showAttendanceModal && (
        <AttendanceModal
          attendanceState={attendanceState ? { ...attendanceState, _claimedToday: hasClaimedToday(attendanceState) } : null}
          onClose={() => setShowAttendanceModal(false)}
          onClaimed={(result) => {
            setAttendanceState((prev) => ({
              ...(prev ?? {}),
              cycle_day: result.cycle_day,
              last_claim_date: new Date().toISOString().slice(0, 10),
              total_claim_count: result.total_claim_count,
            }));
            setProfile((p) => (p ? { ...p, gold: (p.gold ?? 0) + result.reward_gold } : p));
          }}
        />
      )}
      {stage === STAGE.GAME && (
        <MissionFloatingButton mission={mission} completed={missionCompleted} onClaim={handleClaimMission} claiming={claimingMission} />
      )}
      {stage === STAGE.GAME && (
        <header className="app-header">
          <span className="app-title">GrowupGame</span>
          <div className="app-header-right">
            <HeaderActions
              canInstall={canInstall}
              promptInstall={promptInstall}
              profile={profile}
              dragonBuffActive={dragonBuffActive}
              hasUnreadMail={hasUnreadMail}
              hasNewPatchNote={hasNewPatchNote}
              attendanceClaimedToday={hasClaimedToday(attendanceState)}
              onOpenAttendance={() => setShowAttendanceModal(true)}
              onNavigate={setActiveTab}
              onLogout={handleLogout}
            />
          </div>
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="메뉴 열기"
          >
            ☰
          </button>
        </header>
      )}

      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}
      {stage === STAGE.GAME && (
        <div className={`mobile-menu-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          <button type="button" className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)} aria-label="메뉴 닫기">✕</button>
          <div className="mobile-menu-content">
            <HeaderActions
              canInstall={canInstall}
              promptInstall={promptInstall}
              profile={profile}
              dragonBuffActive={dragonBuffActive}
              hasUnreadMail={hasUnreadMail}
              hasNewPatchNote={hasNewPatchNote}
              attendanceClaimedToday={hasClaimedToday(attendanceState)}
              onOpenAttendance={() => setShowAttendanceModal(true)}
              onNavigate={(tab) => { setActiveTab(tab); setMobileMenuOpen(false); }}
              onLogout={() => { setMobileMenuOpen(false); handleLogout(); }}
            />
          </div>
        </div>
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

            <DailyChecklist
              attendanceClaimedToday={hasClaimedToday(attendanceState)}
              freeDrawUsed={freeDrawUsedToday}
              missionCompleted={missionCompleted}
              worldBossAttempted={(worldBossProgress?.attemptsUsed ?? 0) > 0}
              onOpenAttendance={() => setShowAttendanceModal(true)}
              onOpenShop={() => setActiveTab('shop')}
              onOpenWorldBoss={() => { setActiveTab('dungeon'); setDungeonActiveType('worldboss'); }}
            />

            <nav className="tab-nav">
              <button className={`tab-btn ${activeTab === 'battle' ? 'active' : ''}`} onClick={() => setActiveTab('battle')}>⚔️ 전투</button>
              <button className={`tab-btn ${activeTab === 'stage' ? 'active' : ''}`} onClick={() => setActiveTab('stage')}>🗺️ 스테이지</button>
              <button className={`tab-btn ${activeTab === 'loadout' ? 'active' : ''}`} onClick={() => setActiveTab('loadout')}>🧩 스킬편성</button>
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
                equippedCostumes={profile?.equipped_costumes}
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
            {activeTab === 'loadout' && (
              <SkillLoadout
                monsterLevel={activeMonster.level}
                userSkills={userSkills}
                equippedSkills={profile?.equipped_skills ?? []}
                onLoadoutChange={handleLoadoutChange}
              />
            )}
            {activeTab === 'shop' && (
              <Shop
                userId={session.user.id}
                gold={profile?.gold ?? 0}
                equipmentDrawProgress={equipmentDrawProgress}
                totalSkillDraws={profile?.total_skill_draws ?? 0}
                inventory={inventory}
                freeDrawUsed={freeDrawUsedToday}
                onFreeDrawUsedChange={setFreeDrawUsedToday}
                onInventoryChange={refreshInventory}
                onGoldChange={handleGoldChange}
                onSkillsRefresh={refreshSkills}
              />
            )}
            {activeTab === 'inventory' && (
              <Inventory
                userId={session.user.id}
                inventory={inventory}
                equippedCostumes={profile?.equipped_costumes}
                onInventoryChange={refreshInventory}
                onCostumeLoadoutChange={handleCostumeLoadoutChange}
              />
            )}
            {activeTab === 'dungeon' && (
              jobDungeonBattle ? (
                <JobDungeonBattle
                  key={`job-${jobDungeonBattle.tier}-${jobDungeonBattle.sessionId}`}
                  initialMonster={activeMonster}
                  equipmentBonus={equipmentBonus}
                  equippedSkills={equippedSkills}
                  equippedCostumes={profile?.equipped_costumes}
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
                  equippedCostumes={profile?.equipped_costumes}
                  dungeonEnemy={getDungeonStage(dungeonBattle.type, dungeonBattle.stage)}
                  onClear={handleDungeonClear}
                  onExit={() => setDungeonBattle(null)}
                />
              ) : worldBossSession ? (
                <WorldBossBattle
                  key={worldBossSession.sessionId}
                  initialMonster={activeMonster}
                  equipmentBonus={equipmentBonus}
                  equippedSkills={equippedSkills}
                  equippedCostumes={profile?.equipped_costumes}
                  session={worldBossSession}
                  onSettled={handleWorldBossSettled}
                  onExit={() => setWorldBossSession(null)}
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
                  onActiveTypeChange={(type) => {
                    setDungeonActiveType(type);
                    if (type === 'worldboss') refreshWorldBoss();
                  }}
                  worldBoss={worldBoss}
                  worldBossProgress={worldBossProgress}
                  onEnterWorldBoss={handleEnterWorldBoss}
                  worldBossEntering={worldBossEntering}
                  worldBossError={worldBossError}
                />
              )
            )}
            {activeTab === 'pvp' && (
              <PvP
                userId={session.user.id}
                profile={profile}
                activeMonster={activeMonster}
                onCurrencyChange={(newCurrency) => setProfile((p) => ({ ...p, pvp_currency: newCurrency }))}
                onBattleResolved={(res) => setProfile((p) => ({
                  ...p,
                  pvp_currency: res.currency_balance,
                  pvp_wins: (p.pvp_wins ?? 0) + (res.result === 'win' ? 1 : 0),
                  pvp_losses: (p.pvp_losses ?? 0) + (res.result === 'lose' ? 1 : 0),
                }))}
              />
            )}
            {activeTab === 'chat' && (
              <LobbyChat profile={profile} sinceIso={loginAt} activeMonster={activeMonster} />
            )}
            {activeTab === 'mypage' && (
              <MyPage
                session={session}
                profile={profile}
                activeMonster={activeMonster}
                clearedCount={clearedStageIds.size}
                totalStages={TOTAL_STAGES}
                onProfileUpdate={setProfile}
                equipmentBonus={equipmentOnlyBonus}
                skillPossessionAtk={skillPossessionAtk}
                dragonBuffActive={dragonBuffActive}
                onMonsterNicknameChange={(nick) => setActiveMonster((m) => (m ? { ...m, nickname: nick, name: nick || m.speciesName } : m))}
              />
            )}
            {activeTab === 'settings' && (
              <Settings
                userId={session.user.id}
                gold={profile?.gold ?? 0}
                onGoldChange={handleGoldChange}
                onUnreadMailChange={setHasUnreadMail}
                onPatchNoteSeen={() => setHasNewPatchNote(false)}
                achievementStats={{
                  level: activeMonster?.level ?? 0,
                  jobTier: activeMonster?.unlockedJobTier ?? 0,
                  stageCleared: clearedStageIds.size,
                  gachaTotal: (profile?.total_skill_draws ?? 0)
                    + Object.values(equipmentDrawProgress ?? {}).reduce((sum, n) => sum + (n ?? 0), 0),
                  pvpWins: profile?.pvp_wins ?? 0,
                  worldBossDamage: (everParticipatedWorldBoss || (worldBossProgress?.myWeekDamage ?? 0) > 0) ? 1 : 0,
                  fullSetEquipped: (() => {
                    const equippedRarities = {};
                    for (const row of inventory) {
                      if (!row.equipped) continue;
                      const item = getItem(row.item_key);
                      if (item) equippedRarities[item.slot] = item.rarity;
                    }
                    return isFullSetEquipped(equippedRarities) ? 1 : 0;
                  })(),
                  attendanceTotal: attendanceState?.total_claim_count ?? 0,
                }}
                equippedTitle={profile?.equipped_title}
                onTitleChange={(title) => setProfile((p) => (p ? { ...p, equipped_title: title } : p))}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function HeaderActions({ canInstall, promptInstall, profile, dragonBuffActive, hasUnreadMail, hasNewPatchNote, attendanceClaimedToday, onOpenAttendance, onNavigate, onLogout }) {
  return (
    <>
      {canInstall && (
        <button className="btn btn-neutral" onClick={promptInstall}>⬇️ 앱 다운로드</button>
      )}
      {profile && <span className="gold-display">💰 {profile.gold?.toLocaleString() ?? 0}</span>}
      {profile && (
        <span className={`app-nickname ${dragonBuffActive ? 'app-nickname--dragon' : ''}`}>
          {dragonBuffActive && <span title={profile.dragon_buff_until ? `${new Date(profile.dragon_buff_until).toLocaleString('ko-KR')}까지` : undefined}>🐉 </span>}{profile.equipped_title && <span className="app-title-badge">[{profile.equipped_title}]</span>}{profile.nickname}
        </span>
      )}
      <button className="btn btn-ghost attendance-badge-btn" onClick={onOpenAttendance}>
        📅 출석체크{!attendanceClaimedToday && <span className="mail-unread-dot" aria-label="오늘 출석 안 함" />}
      </button>
      <button className="btn btn-ghost" onClick={() => onNavigate('mypage')}>👤 마이페이지</button>
      <button className="btn btn-ghost mail-badge-btn" onClick={() => onNavigate('settings')}>
        ⚙️ 설정{(hasUnreadMail || hasNewPatchNote) && <span className="mail-unread-dot" aria-label="미수령 우편 또는 새 패치노트 있음" />}
      </button>
      <button className="btn btn-ghost" onClick={onLogout}>로그아웃</button>
    </>
  );
}
