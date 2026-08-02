import { useState } from 'react';
import { enterSealedDungeon } from '../lib/sealedDungeon';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 봉인된 던전 관련 상태/핸들러를
 * 통째로 뽑아냄. 완전히 자기완결적(다른 기능과 공유하는 외부 상태 없음 - 골드/경험치를
 * 안 줘서 activeMonster 갱신도 필요 없는 설계라 더 간단함).
 */
export function useSealedDungeon() {
  const [sealedDungeonBattle, setSealedDungeonBattle] = useState(null); // { sessionId } | null
  const [sealedEntering, setSealedEntering] = useState(false);
  const [sealedError, setSealedError] = useState('');
  const [sealStatus, setSealStatus] = useState(null); // { sealKeys, sealFragments } | null
  const [sealCostumeCount, setSealCostumeCount] = useState(0);

  async function handleEnterSealedDungeon() {
    setSealedError('');
    setSealedEntering(true);
    try {
      const { sessionId, sealKeysRemaining } = await enterSealedDungeon();
      setSealedDungeonBattle({ sessionId });
      setSealStatus((prev) => (prev ? { ...prev, sealKeys: sealKeysRemaining } : prev));
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setSealedError(message);
      showToast(message, 'error');
    } finally {
      setSealedEntering(false);
    }
  }

  // 봉인된 던전은 골드/경험치를 전혀 안 줘서 activeMonster를 갱신할 필요가 없음(성장 무관 설계) -
  // 파편 누적치만 반영
  function handleSealedDungeonClaimed(fragmentsEarned, totalFragments) {
    setSealStatus((prev) => (prev ? { ...prev, sealFragments: totalFragments } : { sealKeys: 0, sealFragments: totalFragments }));
  }

  return {
    sealedDungeonBattle, setSealedDungeonBattle,
    sealedEntering, sealedError,
    sealStatus, setSealStatus,
    sealCostumeCount, setSealCostumeCount,
    handleEnterSealedDungeon, handleSealedDungeonClaimed,
  };
}
