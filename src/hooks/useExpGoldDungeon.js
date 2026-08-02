import { useState } from 'react';
import { useDungeonAttempt, claimDungeonReward } from '../lib/dungeon';
import { persistMonsterGrowth } from '../lib/monsters';
import { bumpMission } from '../lib/missions';
import { playNewRecordSound, playGoldenMonsterSound } from '../lib/audio';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 경험치/골드 던전(순차 스테이지형)
 * 관련 상태/핸들러를 통째로 뽑아냄. setActiveMonster/setProfile은 다른 기능들과
 * 공유하는 App 최상위 상태라 외부에서 전달받음.
 */
export function useExpGoldDungeon(setActiveMonster, setProfile) {
  const [dungeonAttempts, setDungeonAttempts] = useState({ exp: 3, gold: 3 });
  const [dungeonProgress, setDungeonProgress] = useState({ exp: 0, gold: 0 });
  const [dungeonBattle, setDungeonBattle] = useState(null); // { type, stage, sessionId } | null
  const [dungeonEntering, setDungeonEntering] = useState(false);
  const [dungeonError, setDungeonError] = useState('');

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
      const [, reward] = await Promise.all([
        persistMonsterGrowth(grownBase.ownedMonsterId, grownBase),
        claimDungeonReward(dungeonBattle.sessionId),
      ]);
      setProfile((p) => ({ ...p, gold: p.gold + reward.gold + (reward.comboBonus ?? 0) }));
      setDungeonProgress((prev) => ({
        ...prev,
        [dungeonBattle.type]: Math.max(prev[dungeonBattle.type] ?? 0, dungeonBattle.stage),
      }));
      bumpMission('kill_monsters', 1);
      if (reward.comboBonus > 0) {
        playNewRecordSound();
        showToast(`🔥 오늘 이 던전 입장권을 전부 클리어했어요! 콤보 보너스 +${reward.comboBonus.toLocaleString()}`, 'success');
      } else if (reward.isElite) {
        playGoldenMonsterSound();
        showToast(`👑 정예 몬스터였어요! 골드 2배 획득 (+${reward.gold.toLocaleString()})`, 'success');
      } else if (reward.isLuckyWeek) {
        showToast(`🍀 이번 주 행운의 던전! 골드 1.5배 획득 (+${reward.gold.toLocaleString()})`, 'success');
      } else if (reward.isGoldenHour) {
        showToast(`🕗 골든타임! 골드 1.4배 획득 (+${reward.gold.toLocaleString()})`, 'success');
      } else if (reward.isDailyBonus) {
        showToast(`📅 오늘의 요일 보너스! 골드 1.3배 획득 (+${reward.gold.toLocaleString()})`, 'success');
      }
    } catch (err) {
      console.error('던전 보상 저장 실패', err);
      showToast('저장에 실패했어요. 네트워크 상태를 확인해주세요.', 'error');
    }
  }

  return {
    dungeonAttempts, setDungeonAttempts,
    dungeonProgress, setDungeonProgress,
    dungeonBattle, setDungeonBattle,
    dungeonEntering, dungeonError,
    handleEnterDungeon, handleDungeonClear,
  };
}
