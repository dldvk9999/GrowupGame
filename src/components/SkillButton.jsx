import { useEffect, useRef, useState } from 'react';

/**
 * props
 * - skill: { id, icon, name, description, type, cooldown } - 원본 스킬 그대로(변형 금지, onUse로 그대로 전달됨)
 * - displayCooldown: 링 애니메이션 계산에 쓸 실제 소요시간(헤이스트/유물 보너스 반영된 값). 생략 시 skill.cooldown 사용
 * - disabled: 쿨타임 중이면 true (부모가 setTimeout으로 관리하는 기존 상태)
 * - startedAt: 이 스킬을 마지막으로 사용한 시각(Date.now()) - 링 애니메이션 기준점
 * - onUse(skill)
 * - hotkey: 1~5 단축키 숫자 (있으면 버튼 모서리에 표시)
 */
export default function SkillButton({ skill, displayCooldown, disabled, startedAt, onUse, hotkey }) {
  const [angle, setAngle] = useState(360);
  const rafRef = useRef(null);
  const cooldownMs = displayCooldown ?? skill.cooldown;

  useEffect(() => {
    if (!disabled || !startedAt) {
      setAngle(360);
      return;
    }
    function tick() {
      const elapsed = Date.now() - startedAt;
      const fraction = Math.min(1, elapsed / cooldownMs);
      setAngle(fraction * 360);
      if (fraction < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [disabled, startedAt, cooldownMs]);

  return (
    <button
      className={`skill-btn ${disabled ? 'on-cooldown' : ''} ${skill.type === 'heal' ? 'skill-heal' : ''} ${skill.id.includes('job') ? 'skill-job' : ''}`}
      onClick={() => onUse(skill)}
      disabled={disabled}
      title={skill.description}
    >
      {disabled && <span className="skill-cooldown-ring" style={{ '--cooldown-angle': `${angle}deg` }} />}
      {hotkey && <span className="skill-hotkey">{hotkey}</span>}
      <span className="skill-icon">{skill.icon}</span>
      <span className="skill-name">{skill.name}</span>
    </button>
  );
}
