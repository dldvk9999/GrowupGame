import { useEffect, useRef, useState } from 'react';

/**
 * props
 * - skill: { id, icon, name, description, type, cooldown }
 * - disabled: 쿨타임 중이면 true (부모가 setTimeout으로 관리하는 기존 상태)
 * - startedAt: 이 스킬을 마지막으로 사용한 시각(Date.now()) - 링 애니메이션 기준점
 * - onUse(skill)
 */
export default function SkillButton({ skill, disabled, startedAt, onUse }) {
  const [angle, setAngle] = useState(360);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!disabled || !startedAt) {
      setAngle(360);
      return;
    }
    function tick() {
      const elapsed = Date.now() - startedAt;
      const fraction = Math.min(1, elapsed / skill.cooldown);
      setAngle(fraction * 360);
      if (fraction < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [disabled, startedAt, skill.cooldown]);

  return (
    <button
      className={`skill-btn ${disabled ? 'on-cooldown' : ''} ${skill.type === 'heal' ? 'skill-heal' : ''} ${skill.id.includes('job') ? 'skill-job' : ''}`}
      onClick={() => onUse(skill)}
      disabled={disabled}
      title={skill.description}
    >
      {disabled && <span className="skill-cooldown-ring" style={{ '--cooldown-angle': `${angle}deg` }} />}
      <span className="skill-icon">{skill.icon}</span>
      <span className="skill-name">{skill.name}</span>
    </button>
  );
}
