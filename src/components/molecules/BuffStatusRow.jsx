// 리팩토링(사용자 요청, molecule - 여러 상태 배지를 조합해서 보여줌): 9개 전투화면에
// 완전히 동일하게 중복되던 버프/기절 상태 표시줄.
export default function BuffStatusRow({ buffs, enemyStunnedUntil }) {
  const now = Date.now();
  const tags = [];
  if (buffs.atkUntil > now) tags.push({ key: 'atk', label: '⚔️ 공격력 상승', cls: 'buff-atk' });
  if (buffs.defUntil > now) tags.push({ key: 'def', label: '🛡️ 방어력 상승', cls: 'buff-def' });
  if (enemyStunnedUntil > now) tags.push({ key: 'stun', label: '💫 적 기절중', cls: 'buff-stun' });
  if (tags.length === 0) return null;
  return (
    <div className="buff-status-row">
      {tags.map((t) => (
        <span key={t.key} className={`buff-tag ${t.cls}`}>{t.label}</span>
      ))}
    </div>
  );
}
