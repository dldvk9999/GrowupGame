// 스토리 비트에 곁들이는 삽화 (신규 콘텐츠, 사용자 요청) - 몬스터 스프라이트처럼
// "적은 수의 상징적 그림을 상황에 맞게 재사용"하는 방식으로 설계(9종 무드아트).
// 실사/디테일한 인물화 대신 추상적인 실루엣+색감 구도로 분위기만 전달 - 손으로 그린
// SVG라 외부 이미지 에셋/호스팅이 전혀 필요 없음.

const SCENES = {
  dawn: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <defs>
        <linearGradient id="sa-dawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2a55" />
          <stop offset="60%" stopColor="#8a4a3a" />
          <stop offset="100%" stopColor="#f2b705" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#sa-dawn)" />
      <circle cx="160" cy="130" r="46" fill="#ffe680" opacity="0.9" />
      <path d="M0,150 L60,120 L100,150 L160,110 L220,150 L260,125 L320,150 L320,180 L0,180 Z" fill="#161225" opacity="0.85" />
      <circle cx="150" cy="118" r="7" fill="#161225" />
      <circle cx="150" cy="98" r="10" fill="#161225" />
    </svg>
  ),
  crack: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <defs>
        <linearGradient id="sa-crack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f1220" />
          <stop offset="100%" stopColor="#232847" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#sa-crack)" />
      <path d="M160,10 L172,55 L150,80 L178,110 L156,140 L168,175" stroke="#ff5a7a" strokeWidth="3" fill="none" opacity="0.9" />
      <path d="M160,10 L172,55 L150,80 L178,110 L156,140 L168,175" stroke="#ffb0c0" strokeWidth="1" fill="none" opacity="0.7" />
      <circle cx="160" cy="10" r="5" fill="#ff5a7a" />
      <rect width="320" height="180" fill="#ff4d6d" opacity="0.05" />
    </svg>
  ),
  shadow: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <defs>
        <radialGradient id="sa-shadow" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#3a3f66" />
          <stop offset="100%" stopColor="#0f1220" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#sa-shadow)" />
      <ellipse cx="160" cy="170" rx="120" ry="14" fill="#000" opacity="0.4" />
      <path d="M160,55 C130,55 118,90 122,130 L110,175 L210,175 L198,130 C202,90 190,55 160,55 Z" fill="#12141f" />
      <circle cx="160" cy="70" r="18" fill="#12141f" />
      <circle cx="153" cy="68" r="2.5" fill="#ff4d6d" />
      <circle cx="167" cy="68" r="2.5" fill="#ff4d6d" />
    </svg>
  ),
  ruins: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <defs>
        <linearGradient id="sa-ruins" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#232847" />
          <stop offset="100%" stopColor="#4a3d2f" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#sa-ruins)" />
      <rect x="40" y="40" width="26" height="120" fill="#6d7396" opacity="0.85" />
      <rect x="90" y="70" width="26" height="90" fill="#4a5078" opacity="0.85" />
      <rect x="200" y="20" width="26" height="140" fill="#6d7396" opacity="0.7" />
      <polygon points="200,20 226,20 213,4" fill="#8a90b0" opacity="0.7" />
      <rect x="255" y="90" width="26" height="70" fill="#4a5078" opacity="0.8" />
      <rect x="0" y="160" width="320" height="20" fill="#12141f" />
    </svg>
  ),
  storm: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <rect width="320" height="180" fill="#12141f" />
      <circle cx="120" cy="90" r="55" fill="#ff5a1f" opacity="0.35" />
      <circle cx="190" cy="70" r="50" fill="#3aa8e0" opacity="0.35" />
      <circle cx="165" cy="120" r="50" fill="#5cb83c" opacity="0.35" />
      <circle cx="160" cy="90" r="14" fill="#f2f3f9" opacity="0.9" />
    </svg>
  ),
  clash: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <rect width="320" height="180" fill="#181c33" />
      <ellipse cx="160" cy="170" rx="130" ry="12" fill="#000" opacity="0.35" />
      <path d="M100,60 C85,60 76,90 80,125 L70,170 L130,170 L120,125 C124,90 115,60 100,60 Z" fill="#f2b705" opacity="0.9" />
      <path d="M220,60 C205,60 196,90 200,125 L190,170 L250,170 L240,125 C244,90 235,60 220,60 Z" fill="#12141f" />
      <circle cx="160" cy="100" r="20" fill="#ff4d6d" opacity="0.7" />
    </svg>
  ),
  seal: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <rect width="320" height="180" fill="#0f1220" />
      <circle cx="160" cy="90" r="60" fill="none" stroke="#f2b705" strokeWidth="3" opacity="0.85" />
      <circle cx="160" cy="90" r="42" fill="none" stroke="#f2b705" strokeWidth="1.5" opacity="0.6" />
      <path d="M160,30 L172,90 L160,150 L148,90 Z" fill="#f2b705" opacity="0.5" />
      <path d="M100,90 L160,78 L220,90 L160,102 Z" fill="#f2b705" opacity="0.5" />
      <path d="M120,50 L200,130" stroke="#ff4d6d" strokeWidth="3" opacity="0.8" />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <defs>
        <linearGradient id="sa-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4fd67a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0f1220" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#sa-light)" />
      <ellipse cx="160" cy="170" rx="130" ry="12" fill="#000" opacity="0.35" />
      <path d="M120,60 C108,60 100,88 103,120 L95,170 L145,170 L137,120 C140,88 132,60 120,60 Z" fill="#12141f" />
      <path d="M200,60 C188,60 180,88 183,120 L175,170 L225,170 L217,120 C220,88 212,60 200,60 Z" fill="#12141f" />
      <circle cx="160" cy="40" r="22" fill="#ffe680" opacity="0.85" />
    </svg>
  ),
  throne: (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <defs>
        <radialGradient id="sa-throne" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#4a2f55" />
          <stop offset="100%" stopColor="#0f1220" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#sa-throne)" />
      <path d="M110,175 L130,60 L190,60 L210,175 Z" fill="#181c33" opacity="0.9" />
      <path d="M160,60 C140,60 126,95 130,140 L120,175 L200,175 L190,140 C194,95 180,60 160,60 Z" fill="#0c0e18" />
      <circle cx="150" cy="80" r="3" fill="#ff5a1f" />
      <circle cx="170" cy="80" r="3" fill="#3aa8e0" />
      <circle cx="160" cy="95" r="3" fill="#5cb83c" />
    </svg>
  ),
};

export default function StoryArtwork({ imageKey }) {
  const scene = SCENES[imageKey];
  if (!scene) return null;
  return <div className="story-artwork">{scene}</div>;
}
