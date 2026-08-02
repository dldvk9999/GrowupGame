import { expToNextLevel } from '../../lib/growth';

// 리팩토링(사용자 요청, atom): 6개 전투화면에 중복되던 경험치바(봉인된 던전은
// 경험치를 안 줘서 애초에 없었음 - 그 화면엔 이 컴포넌트를 안 씀).
export default function ExpBar({ level, exp }) {
  const need = expToNextLevel(level);
  const pct = Math.min((exp / need) * 100, 100);
  return (
    <div className="exp-bar-wrap">
      <div className="exp-label">Lv.{level} 경험치 ({exp}/{need})</div>
      <div className="bar-track exp-track"><div className="bar-fill exp-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
