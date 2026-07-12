import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { getMyProfile, signOut } from './lib/auth';
import { getActiveMonster, createStarter, persistMonsterGrowth } from './lib/monsters';
import AuthScreen from './components/AuthScreen';
import StoryIntro from './components/StoryIntro';
import StarterSelect from './components/StarterSelect';
import BattleScreen from './components/BattleScreen';

const STAGE = {
  LOADING: 'loading',
  AUTH: 'auth',
  STORY: 'story',
  STARTER: 'starter',
  BATTLE: 'battle',
};

export default function App() {
  const [stage, setStage] = useState(STAGE.LOADING);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeMonster, setActiveMonster] = useState(null);
  const [starterLoading, setStarterLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session);
    });
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
      const [p, monster] = await Promise.all([
        getMyProfile(),
        getActiveMonster(newSession.user.id),
      ]);
      setProfile(p);
      if (monster) {
        setActiveMonster(monster);
        setStage(STAGE.BATTLE);
      } else {
        setStage(STAGE.STORY);
      }
    } catch (err) {
      setError(err.message ?? '데이터를 불러오지 못했어요.');
    }
  }

  async function handlePickStarter(speciesId) {
    setStarterLoading(true);
    try {
      const monster = await createStarter(session.user.id, speciesId);
      setActiveMonster(monster);
      setStage(STAGE.BATTLE);
    } catch (err) {
      setError(err.message ?? '몬스터 생성에 실패했어요.');
    } finally {
      setStarterLoading(false);
    }
  }

  function handleWin(grownMonster) {
    setActiveMonster(grownMonster);
    persistMonsterGrowth(grownMonster.ownedMonsterId, grownMonster).catch((err) => {
      console.error('성장 저장 실패', err);
    });
  }

  async function handleLogout() {
    await signOut();
  }

  return (
    <div className="app-shell">
      {stage !== STAGE.AUTH && (
        <header className="app-header">
          <span className="app-title">GrowupGame</span>
          {profile && (
            <div className="app-header-right">
              <span className="app-nickname">{profile.nickname}</span>
              <button className="btn btn-ghost" onClick={handleLogout}>로그아웃</button>
            </div>
          )}
        </header>
      )}

      {error && <p className="app-error">{error}</p>}

      <main className="app-main">
        {stage === STAGE.LOADING && <p className="app-loading">불러오는 중...</p>}

        {stage === STAGE.AUTH && <AuthScreen onAuthed={() => {}} />}

        {stage === STAGE.STORY && (
          <StoryIntro onContinue={() => setStage(STAGE.STARTER)} />
        )}

        {stage === STAGE.STARTER && (
          <StarterSelect onSelect={handlePickStarter} loading={starterLoading} />
        )}

        {stage === STAGE.BATTLE && activeMonster && (
          <BattleScreen initialMonster={activeMonster} onWin={handleWin} />
        )}
      </main>
    </div>
  );
}
