import { useState } from 'react';
import { startJobDungeon, claimJobDungeon } from '../lib/jobDungeonApi';
import { persistMonsterGrowth, getActiveMonster } from '../lib/monsters';
import { bumpMission } from '../lib/missions';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 전직 던전 관련 상태/핸들러를
 * 통째로 뽑아냄. session(로그인 세션)/setActiveMonster는 다른 기능들과 공유하는
 * App 최상위 값이라 외부에서 전달받음.
 */
export function useJobDungeon(session, setActiveMonster) {
  const [jobDungeonBattle, setJobDungeonBattle] = useState(null); // { tier, sessionId } | null
  const [jobEntering, setJobEntering] = useState(false);
  const [jobError, setJobError] = useState('');

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
      // ⚠️ 예전엔 여기서 console.error만 하고 끝나서, claim_job_dungeon이 실패해도(예: 너무 빠른
      // 승리로 안티치트 게이트에 걸림) 사용자는 "전투는 이겼는데 전직이 그냥 안 됐다"는 걸로만
      // 보였음(사용자 제보). 실패 원인을 토스트로 반드시 알려주도록 수정.
      console.error('전직 적용 실패', err);
      showToast(err.message ?? '전직 적용에 실패했어요. 다시 시도해주세요.', 'error');
    }
  }

  return { jobDungeonBattle, setJobDungeonBattle, jobEntering, jobError, handleEnterJobDungeon, handleJobDungeonWin };
}
