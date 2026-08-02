import { useState } from 'react';
import { fetchWorldBoss, fetchMyWorldBossProgress, enterWorldBoss } from '../lib/worldBoss';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 월드보스 관련 상태/핸들러를 통째로
 * 뽑아냄. setProfile은 다른 기능들과 공유하는 App 최상위 상태라 외부에서 전달받음.
 * fetchWorldBoss/fetchMyWorldBossProgress는 App.jsx의 초기 로드 Promise.all에서도
 * 별도로 쓰여서 그쪽 import는 그대로 둠(여긴 새로고침/입장/정산 로직만 담당).
 */
export function useWorldBoss(setProfile) {
  const [worldBoss, setWorldBoss] = useState(null);
  const [worldBossProgress, setWorldBossProgress] = useState(null);
  const [everParticipatedWorldBoss, setEverParticipatedWorldBoss] = useState(false);
  const [worldBossSession, setWorldBossSession] = useState(null); // enterWorldBoss() 결과 | null
  const [worldBossEntering, setWorldBossEntering] = useState(false);
  const [worldBossError, setWorldBossError] = useState('');

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
      showToast('🐉 월드보스 처치! 7일간 용의 버프(공격력·방어력 2배)가 적용됐어요. 골드 보상은 우편함에서 받아가세요!', 'success');
    }
    refreshWorldBoss();
  }

  return {
    worldBoss, setWorldBoss,
    worldBossProgress, setWorldBossProgress,
    everParticipatedWorldBoss, setEverParticipatedWorldBoss,
    worldBossSession, setWorldBossSession,
    worldBossEntering, worldBossError,
    refreshWorldBoss, handleEnterWorldBoss, handleWorldBossSettled,
  };
}
