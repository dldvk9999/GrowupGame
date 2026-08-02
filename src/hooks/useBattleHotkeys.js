import { useEffect, useRef } from 'react';
import { getJobSkillTier } from '../lib/jobAdvancement';

/**
 * 리팩토링(사용자 요청): DungeonBattle/JobDungeonBattle/RubyDungeonBattle/
 * EliteTrialBattle/SealedDungeonBattle/WorldBossBattle/GuildRaidBattle 7개
 * 전투화면에 바이트 단위로 동일하게 중복되던 "숫자키/전직스킬 단축키/Space로
 * 결과화면 나가기" 핸들러를 훅으로 추출함.
 *
 * BattleScreen.jsx(자동사냥/도전 듀얼모드 + R키 재도전 등 고유 로직 있음)와
 * StreakDungeonBattle.jsx(승리 시 나가기 대신 수령/이어가기 선택이라 Space
 * 나가기 자체가 없음)는 동작이 달라서 이 훅을 쓰지 않고 그대로 둠.
 */
export function useBattleHotkeys({ result, availableSkills, useSkill, onExit, jobKeybinds }) {
  const keyStateRef = useRef();
  keyStateRef.current = { result, availableSkills, useSkill, onExit };

  useEffect(() => {
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const { result, availableSkills, useSkill, onExit } = keyStateRef.current;

      if (/^[1-9]$/.test(e.key)) {
        if (!result) {
          const skill = availableSkills[Number(e.key) - 1];
          if (skill) { e.preventDefault(); useSkill(skill); }
        }
        return;
      }
      const pressedKey = e.key.toLowerCase();
      if (!result && jobKeybinds.includes(pressedKey)) {
        const jobTier = jobKeybinds.indexOf(pressedKey) + 1;
        const skill = availableSkills.find((s) => getJobSkillTier(s.id) === jobTier);
        if (skill) { e.preventDefault(); useSkill(skill); return; }
      }
      if (e.code === 'Space' && result) {
        e.preventDefault();
        onExit?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
