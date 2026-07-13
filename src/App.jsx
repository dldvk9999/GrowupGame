import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { getMyProfile, signOut } from './lib/auth';
import { getActiveMonster, createStarter, persistMonsterGrowth } from './lib/monsters';
import { addGold } from './lib/economy';
import { fetchClearedStageIds, markStageCleared } from './lib/stageProgress';
import { fetchInventory, sumEquippedBonus } from './lib/inventory';
import { toStageIndex, fromStageIndex, TOTAL_STAGES, STAGES_PER_CHAPTER } from './lib/stages';
import { getChapterStory } from './lib/stageStory';

import AuthScreen from './components/AuthScreen';
import StoryIntro from './components/StoryIntro';
import ChapterStory from './components/ChapterStory';
import StarterSelect from './components/StarterSelect';
import BattleScreen from './components/BattleScreen';
import StageSelect from './components/StageSelect';
import Shop from './components/Shop';

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
  const [currentStageIndex, setCurrentStageIndex] = useState(1);
  const [pendingStage, setPendingStage] = useState(null);
  const [activeTab, setActiveTab] = useState('battle'); // battle | stage | shop
  const [starterLoading, setStarterLoading] = useState(false);
  const [error, setError] = useState('');

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
      const [p, monster, cleared, inv] = await Promise.all([
        getMyProfile(),
        getActiveMonster(userId),
        fetchClearedStageIds(userId),
        fetchInventory(userId),
      ]);
      setProfile(p);
      setClearedStageIds(cleared);
      setInventory(inv);

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

  async function handleClear(grownBase, goldReward) {
    setActiveMonster(grownBase);
    const userId = session.user.id;
    try {
      await Promise.all([
        persistMonsterGrowth(grownBase.ownedMonsterId, grownBase),
        addGold(userId, goldReward),
        markStageCleared(userId, currentStageIndex),
      ]);
      setProfile((p) => ({ ...p, gold: p.gold + goldReward }));
      setClearedStageIds((prev) => new Set(prev).add(currentStageIndex));
    } catch (err) {
      console.error('클리어 저장 실패', err);
    }
  }

  async function handleIdleGain(grownBase, goldReward) {
    setActiveMonster(grownBase);
    const userId = session.user.id;
    try {
      await Promise.all([
        persistMonsterGrowth(grownBase.ownedMonsterId, grownBase),
        addGold(userId, goldReward),
      ]);
      setProfile((p) => ({ ...p, gold: p.gold + goldReward }));
    } catch (err) {
      console.error('자동 사냥 저장 실패', err);
    }
  }

  function handleAdvance() {
    const nextIndex = Math.min(currentStageIndex + 1, TOTAL_STAGES);
    const { chapter: nextChapter, stage: nextStage } = fromStageIndex(nextIndex);
    handleSelectStage(nextChapter, nextStage);
  }

  async function handleLogout() {
    await signOut();
  }

  const { chapter, stage: stageNum } = fromStageIndex(currentStageIndex);
  const equipmentBonus = sumEquippedBonus(inventory);

  return (
    <div className="app-shell">
      {stage === STAGE.GAME && (
        <header className="app-header">
          <span className="app-title">GrowupGame</span>
          <div className="app-header-right">
            {profile && <span className="gold-display">💰 {profile.gold?.toLocaleString() ?? 0}</span>}
            {profile && <span className="app-nickname">{profile.nickname}</span>}
            <button className="btn btn-ghost" onClick={handleLogout}>로그아웃</button>
          </div>
        </header>
      )}

      {error && <p className="app-error">{error}</p>}

      <main className="app-main">
        {stage === STAGE.LOADING && <p className="app-loading">불러오는 중...</p>}

        {stage === STAGE.AUTH && <AuthScreen onAuthed={() => {}} />}

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
            <nav className="tab-nav">
              <button className={`tab-btn ${activeTab === 'battle' ? 'active' : ''}`} onClick={() => setActiveTab('battle')}>⚔️ 전투</button>
              <button className={`tab-btn ${activeTab === 'stage' ? 'active' : ''}`} onClick={() => setActiveTab('stage')}>🗺️ 스테이지</button>
              <button className={`tab-btn ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => setActiveTab('shop')}>🛒 상점</button>
            </nav>

            {activeTab === 'battle' && (
              <BattleScreen
                key={currentStageIndex}
                initialMonster={activeMonster}
                chapter={chapter}
                stage={stageNum}
                equipmentBonus={equipmentBonus}
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
          </div>
        )}
      </main>
    </div>
  );
}
