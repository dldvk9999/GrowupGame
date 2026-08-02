import { useState } from 'react';
import { enterEliteTrial } from '../lib/eliteTrial';
import { persistMonsterGrowth } from '../lib/monsters';
import { bumpMission } from '../lib/missions';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 정예의 시련 던전 관련 상태/핸들러를
 * 통째로 뽑아냄. activeMonster/setActiveMonster는 다른 기능들과 공유하는 App 최상위
 * 상태라 훅 바깥(App.jsx)에서 그대로 전달받음 - 이 훅이 새로 소유하지 않음.
 */
export function useEliteTrial(activeMonster, setActiveMonster) {
  const [eliteTrialBattle, setEliteTrialBattle] = useState(false);
  const [eliteEntering, setEliteEntering] = useState(false);
  const [eliteError, setEliteError] = useState('');
  const [eliteAttemptsRemaining, setEliteAttemptsRemaining] = useState(null);

  async function handleEnterEliteTrial() {
    setEliteError('');
    setEliteEntering(true);
    try {
      await enterEliteTrial();
      setEliteTrialBattle(true);
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setEliteError(message);
      showToast(message, 'error');
    } finally {
      setEliteEntering(false);
      setEliteAttemptsRemaining((r) => (r != null ? Math.max(0, r - 1) : r));
    }
  }

  // 정예의 시련은 골드/새 재화 없이 정예 경험치만 지급 - 별도 클레임 RPC 없이 승리 즉시
  // 경험치를 저장하기만 하면 됨(입장 시점에 이미 하루 3회 제한을 서버가 강제했음)
  async function handleEliteTrialWin(grownBase) {
    setActiveMonster(grownBase);
    try {
      await persistMonsterGrowth(grownBase.ownedMonsterId, grownBase);
      bumpMission('kill_monsters', 1);
      if (grownBase.eliteLevel > (activeMonster?.eliteLevel ?? 0)) {
        showToast(`✨ 정예 레벨 ${grownBase.eliteLevel} 달성!`, 'success');
      }
    } catch (err) {
      console.error('정예의 시련 경험치 저장 실패', err);
      showToast('저장에 실패했어요. 네트워크 상태를 확인해주세요.', 'error');
    }
  }

  return {
    eliteTrialBattle, setEliteTrialBattle,
    eliteEntering, eliteError,
    eliteAttemptsRemaining, setEliteAttemptsRemaining,
    handleEnterEliteTrial, handleEliteTrialWin,
  };
}
