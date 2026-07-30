/**
 * 던전 종류별로 캐릭터 뒤에 깔리는 테마 배경/오라 일러스트(신규, 사용자 요청 —
 * "캐릭터를 그 던전과 어울리는 일러스트로"). 캐릭터 자체(species/element별 스프라이트)를
 * 매 던전마다 전부 다시 그리는 대신(9종 몬스터 × 5던전 = 45벌 원화가 필요해 비현실적),
 * 던전 성격에 맞는 정교한 배경 연출을 캐릭터 뒤에 깔아서 "이 던전에 어울리는 모습"으로
 * 보이게 함 — 초상화 프레임/배경이 맥락에 따라 바뀌는 방식과 같은 원리.
 *
 * theme: 'stage' | 'exp' | 'gold' | 'job' | 'tower'
 */
export default function DungeonAura({ theme, size = 90 }) {
  const s = size * 1.7; // 캐릭터보다 넉넉하게 큰 배경 캔버스
  const common = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0, pointerEvents: 'none' };

  if (theme === 'stage') {
    return (
      <svg width={s} height={s} viewBox="0 0 200 200" style={common}>
        <defs>
          <radialGradient id="auraStage" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffdca0" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffdca0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#auraStage)" />
        {/* 모험을 상징하는 나뭇잎/광선 */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path
            key={deg}
            d="M100 30 Q107 10 100 -5 Q93 10 100 30 Z"
            fill="#ffb45c"
            opacity="0.5"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
        <ellipse cx="100" cy="178" rx="70" ry="10" fill="#5c3d1a" opacity="0.25" />
      </svg>
    );
  }

  if (theme === 'exp') {
    return (
      <svg width={s} height={s} viewBox="0 0 200 200" style={common}>
        <defs>
          <radialGradient id="auraExp" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#8ec9ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8ec9ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#auraExp)" />
        {/* 지혜/마법을 상징하는 룬 마법진 */}
        <circle cx="100" cy="100" r="80" fill="none" stroke="#bfe0ff" strokeWidth="1.5" opacity="0.6" strokeDasharray="4 6" />
        <circle cx="100" cy="100" r="65" fill="none" stroke="#7fb8ff" strokeWidth="1" opacity="0.5" />
        {[0, 90, 180, 270].map((deg) => (
          <circle key={deg} cx={100 + 80 * Math.cos((deg * Math.PI) / 180)} cy={100 + 80 * Math.sin((deg * Math.PI) / 180)} r="3.5" fill="#cfe8ff" opacity="0.8" />
        ))}
        <path d="M60 165 Q100 175 140 165" stroke="#5a86b8" strokeWidth="2" fill="none" opacity="0.4" />
      </svg>
    );
  }

  if (theme === 'gold') {
    return (
      <svg width={s} height={s} viewBox="0 0 200 200" style={common}>
        <defs>
          <radialGradient id="auraGold" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffe07a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffe07a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#auraGold)" />
        {/* 쏟아지는 금화 */}
        {[
          [40, 40, 8], [155, 55, 6], [35, 130, 7], [165, 140, 9], [100, 25, 6], [60, 160, 5], [145, 175, 6],
        ].map(([cx, cy, r], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="#ffd23f" stroke="#c98a12" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r={r * 0.55} fill="#ffe98a" />
          </g>
        ))}
        <ellipse cx="100" cy="178" rx="72" ry="9" fill="#8a5a08" opacity="0.25" />
      </svg>
    );
  }

  if (theme === 'job') {
    return (
      <svg width={s} height={s} viewBox="0 0 200 200" style={common}>
        <defs>
          <radialGradient id="auraJob" cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="#c88bff" stopOpacity="0.65" />
            <stop offset="60%" stopColor="#ff5aa8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ff5aa8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#auraJob)" />
        {/* 각성을 상징하는 번개/에너지 폭발 */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <path
            key={deg}
            d="M100 100 L106 45 L112 70 L100 25"
            fill="none"
            stroke="#e6b8ff"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="50" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.35" />
      </svg>
    );
  }

  if (theme === 'tower') {
    return (
      <svg width={s} height={s} viewBox="0 0 200 200" style={common}>
        <defs>
          <linearGradient id="auraTower" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a3a6b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2a3a6b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#auraTower)" />
        {/* 하늘 위로 올라가는 별/구름 */}
        {[[35, 40], [160, 30], [50, 150], [155, 155], [100, 15], [25, 100], [175, 95]].map(([cx, cy], i) => (
          <path
            key={i}
            d={`M${cx} ${cy} l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z`}
            fill="#dce8ff"
            opacity="0.8"
          />
        ))}
        <ellipse cx="65" cy="170" rx="30" ry="8" fill="#e8eeff" opacity="0.35" />
        <ellipse cx="140" cy="178" rx="26" ry="7" fill="#e8eeff" opacity="0.3" />
      </svg>
    );
  }

  return null;
}
