import { useState } from 'react';
import { startRubyDungeon, claimRubyDungeonReward } from '../lib/rubyDungeon';
import { persistMonsterGrowth } from '../lib/monsters';
import { bumpMission } from '../lib/missions';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 루비 던전 관련 상태/핸들러를
 * 통째로 뽑아냄. setActiveMonster/setProfile은 다른 기능들과 공유하는 App 최상위
 * 상태라 훅 바깥(App.jsx)에서 그대로 전달받음.
 */
export function useRubyDungeon(setActiveMonster, setProfile) {
  const [rubyDungeonBattle, setRubyDungeonBattle] = useState(null); // { sessionId } | null
  const [rubyEntering, setRubyEntering] = useState(false);
  const [rubyError, setRubyError] = useState('');
  const [rubyAttemptsRemaining, setRubyAttemptsRemaining] = useState(null);

  async function handleEnterRubyDungeon() {
    setRubyError('');
    setRubyEntering(true);
    try {
      const sessionId = await startRubyDungeon();
      setRubyDungeonBattle({ sessionId });
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setRubyError(message);
      showToast(message, 'error');
    } finally {
      setRubyEntering(false);
      setRubyAttemptsRemaining((r) => (r != null ? Math.max(0, r - 1) : r));
    }
  }

  async function handleRubyDungeonWin(grownBase) {
    setActiveMonster(grownBase);
    try {
      await persistMonsterGrowth(grownBase.ownedMonsterId, grownBase);
      const rubies = await claimRubyDungeonReward(rubyDungeonBattle.sessionId);
      setProfile((p) => (p ? { ...p, rubies: (p.rubies ?? 0) + rubies } : p));
      showToast(`💎 루비 던전 클리어! 루비 +${rubies}개`, 'success');
      bumpMission('kill_monsters', 1);
    } catch (err) {
      console.error('루비 지급 실패', err);
      showToast(err.message ?? '루비 지급에 실패했어요. 다시 시도해주세요.', 'error');
    }
  }

  return {
    rubyDungeonBattle, setRubyDungeonBattle,
    rubyEntering, rubyError,
    rubyAttemptsRemaining, setRubyAttemptsRemaining,
    handleEnterRubyDungeon, handleRubyDungeonWin,
  };
}
