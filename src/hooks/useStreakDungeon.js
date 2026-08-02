import { useState } from 'react';
import { startStreakDungeon, fetchStreakDungeonAttemptsToday } from '../lib/streakDungeon';
import { persistMonsterGrowth } from '../lib/monsters';
import { bumpMission } from '../lib/missions';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 연승 던전 관련 상태/핸들러를
 * 통째로 뽑아냄. setActiveMonster/setProfile은 다른 기능들과 공유하는 App 최상위
 * 상태라 훅 바깥(App.jsx)에서 그대로 전달받음. 초기 로드 시 "이어서 진행 중이던
 * 연승" 복원은 App.jsx의 Promise.all이 그대로 담당하고(다른 여러 초기값과 함께
 * 한 번에 로드하는 게 자연스러워서), 이 훅은 setter만 노출해서 연결함.
 */
export function useStreakDungeon(setActiveMonster, setProfile) {
  const [streakDungeonBattle, setStreakDungeonBattle] = useState(null); // { sessionId, streak } | null
  const [streakEntering, setStreakEntering] = useState(false);
  const [streakError, setStreakError] = useState('');
  const [streakAttemptsRemaining, setStreakAttemptsRemaining] = useState(null);
  const [streakBest, setStreakBest] = useState(0);

  async function handleEnterStreakDungeon() {
    setStreakError('');
    setStreakEntering(true);
    try {
      const { sessionId, streak } = await startStreakDungeon();
      setStreakDungeonBattle({ sessionId, streak });
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setStreakError(message);
      showToast(message, 'error');
    } finally {
      setStreakEntering(false);
      setStreakAttemptsRemaining((r) => (r != null ? Math.max(0, r - 1) : r));
    }
  }

  // 연승 던전은 이길 때마다 호출(경험치 저장) - 루비 던전(handleRubyDungeonWin)과 동일 패턴,
  // 골드는 여기서 지급하지 않고 "수령"을 눌러야만 확정 지급됨(handleStreakBankSuccess)
  async function handleStreakDungeonWin(grownBase) {
    setActiveMonster(grownBase);
    try {
      await persistMonsterGrowth(grownBase.ownedMonsterId, grownBase);
      bumpMission('kill_monsters', 1);
    } catch (err) {
      console.error('연승 던전 경험치 저장 실패', err);
    }
  }

  // "이어서 도전" 성공 - streak만 갱신하면 StreakDungeonBattle의 key가 바뀌어 다음 라운드로 리마운트됨
  function handleStreakContinueSuccess(newStreak) {
    setStreakDungeonBattle((prev) => (prev ? { ...prev, streak: newStreak } : prev));
  }

  // "지금 수령" 성공 - 골드는 이미 서버에서 지급 완료된 상태라 잔액만 반영, 던전 종료
  function handleStreakBankSuccess(gold, finalStreak) {
    setProfile((p) => (p ? { ...p, gold: (p.gold ?? 0) + gold } : p));
    showToast(`🔥 ${finalStreak}연승 수령! 골드 +${gold.toLocaleString()}`, 'success');
    setStreakDungeonBattle(null);
    setStreakBest((prev) => Math.max(prev, finalStreak));
    fetchStreakDungeonAttemptsToday().then(setStreakAttemptsRemaining).catch(() => {});
  }

  // 패배로 포기 - 이번 판 보상 없음, 연승 기록(streakBest)은 도달했던 최고치가 이미 반영돼있음
  function handleStreakForfeit() {
    setStreakDungeonBattle((prev) => {
      if (prev) setStreakBest((best) => Math.max(best, prev.streak));
      return null;
    });
    fetchStreakDungeonAttemptsToday().then(setStreakAttemptsRemaining).catch(() => {});
  }

  return {
    streakDungeonBattle, setStreakDungeonBattle,
    streakEntering, streakError,
    streakAttemptsRemaining, setStreakAttemptsRemaining,
    streakBest, setStreakBest,
    handleEnterStreakDungeon, handleStreakDungeonWin,
    handleStreakContinueSuccess, handleStreakBankSuccess, handleStreakForfeit,
  };
}
