import { useState } from 'react';
import { enterTower, claimTowerFloor } from '../lib/tower';
import { persistMonsterGrowth } from '../lib/monsters';
import { bumpMission } from '../lib/missions';
import { playNewRecordSound } from '../lib/audio';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 무한의 탑 관련 상태/핸들러를
 * 통째로 뽑아냄. setActiveMonster/setProfile/setHasUnreadMail은 다른 기능들과
 * 공유하는 App 최상위 상태라 외부에서 전달받음.
 */
export function useTower(setActiveMonster, setProfile, setHasUnreadMail) {
  const [towerBattle, setTowerBattle] = useState(null); // { floor, sessionId } | null
  const [towerHighestFloor, setTowerHighestFloor] = useState(0);
  const [towerEntering, setTowerEntering] = useState(false);
  const [towerError, setTowerError] = useState('');

  async function handleEnterTower() {
    setTowerError('');
    setTowerEntering(true);
    try {
      const { sessionId, floor } = await enterTower();
      setTowerBattle({ floor, sessionId });
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setTowerError(message);
      showToast(message, 'error');
    } finally {
      setTowerEntering(false);
    }
  }

  async function handleTowerClear(grownBase, _clientGoldEstimate) {
    setActiveMonster(grownBase);
    try {
      const [, reward] = await Promise.all([
        persistMonsterGrowth(grownBase.ownedMonsterId, grownBase),
        claimTowerFloor(towerBattle.sessionId),
      ]);
      setProfile((p) => ({ ...p, gold: p.gold + reward.gold }));
      setTowerHighestFloor(reward.newHighestFloor);
      bumpMission('kill_monsters', 1);
      if (reward.isNewRecord && reward.newHighestFloor % 10 === 0) {
        playNewRecordSound();
        setHasUnreadMail(true);
        showToast(`🗼 ${reward.newHighestFloor}층 돌파! 축하 보너스가 우편함에 도착했어요.`, 'success');
      } else if (reward.isNewRecord) {
        playNewRecordSound();
        showToast(`🗼 신기록! ${reward.newHighestFloor}층 달성!`, 'success');
      }
    } catch (err) {
      console.error('무한의 탑 보상 저장 실패', err);
      showToast('저장에 실패했어요. 네트워크 상태를 확인해주세요.', 'error');
    }
  }

  return {
    towerBattle, setTowerBattle,
    towerHighestFloor, setTowerHighestFloor,
    towerEntering, towerError,
    handleEnterTower, handleTowerClear,
  };
}
