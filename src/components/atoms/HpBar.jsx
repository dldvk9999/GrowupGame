// 리팩토링(사용자 요청, 아토믹디자인 - atom): 9개 전투화면에 중복되던 HP바.
// formatNumbers만 화면별로 달랐음(월드보스/길드레이드는 체력이 수백만 단위라
// toLocaleString 포맷 필요) - 그 외엔 완전히 동일해서 prop 하나로 통합.
export default function HpBar({ label, hp, maxHp, color, formatNumbers = false }) {
  const pct = Math.max((hp / maxHp) * 100, 0);
  const fmt = (n) => (formatNumbers ? Math.ceil(n).toLocaleString() : Math.ceil(n));
  return (
    <div className="hp-bar">
      <div className="hp-label">{label} ({fmt(hp)}/{formatNumbers ? maxHp.toLocaleString() : maxHp})</div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
