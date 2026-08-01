// 길드 로비(신규 콘텐츠, 사용자 요청) - StoryArtwork.jsx와 동일한 방식으로 손으로 그린
// SVG 한 장으로 "로비 같은 분위기"만 연출함(외부 이미지 에셋 불필요). 실제 길드 컨텐츠
// (채팅, 창고 등)는 이번엔 범위 밖 - harness/todo.md에 후속 과제로만 기록해둠.

function GuildLobbyArtwork() {
  return (
    <svg viewBox="0 0 320 180" className="story-artwork-svg">
      <defs>
        <linearGradient id="lobby-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#241a3a" />
          <stop offset="55%" stopColor="#3a2a4a" />
          <stop offset="100%" stopColor="#1a1428" />
        </linearGradient>
        <radialGradient id="lobby-glow" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#lobby-bg)" />
      <ellipse cx="160" cy="60" rx="150" ry="70" fill="url(#lobby-glow)" />
      {/* 바닥 */}
      <path d="M0,150 L320,150 L320,180 L0,180 Z" fill="#120e1e" />
      <path d="M0,150 L320,150 L280,180 L40,180 Z" fill="#1c1530" opacity="0.6" />
      {/* 좌우 기둥 */}
      <rect x="18" y="40" width="14" height="115" fill="#2e2244" />
      <rect x="288" y="40" width="14" height="115" fill="#2e2244" />
      {/* 좌우 깃발(배너) */}
      <path d="M25,42 L25,95 L38,88 L38,49 Z" fill="#8a4fff" opacity="0.85" />
      <path d="M295,42 L295,95 L282,88 L282,49 Z" fill="#8a4fff" opacity="0.85" />
      {/* 중앙 상징(문장) */}
      <circle cx="160" cy="70" r="26" fill="#3a2a55" stroke="#ffd98a" strokeWidth="2" />
      <path d="M160,54 L170,66 L166,86 L154,86 L150,66 Z" fill="#ffd98a" opacity="0.9" />
      {/* 횃불 */}
      <rect x="60" y="95" width="5" height="30" fill="#4a3a2a" />
      <circle cx="62" cy="90" r="9" fill="#ff9a3c" opacity="0.9" />
      <circle cx="62" cy="88" r="5" fill="#ffe680" />
      <rect x="255" y="95" width="5" height="30" fill="#4a3a2a" />
      <circle cx="257" cy="90" r="9" fill="#ff9a3c" opacity="0.9" />
      <circle cx="257" cy="88" r="5" fill="#ffe680" />
      {/* 카펫 */}
      <path d="M130,150 L190,150 L200,180 L120,180 Z" fill="#5a2a3a" opacity="0.85" />
      <path d="M136,150 L184,150 L191,180 L129,180 Z" fill="#7a3a4a" opacity="0.6" />
    </svg>
  );
}

export default function GuildLobby({ guild, onBack }) {
  return (
    <div className="story-popup-card">
      <h3 className="mypage-subtitle" style={{ marginTop: 0 }}>🏰 [{guild.tag}] {guild.name} 로비 <span className="app-title-badge">Lv.{guild.level}</span></h3>
      <div className="story-artwork">
        <GuildLobbyArtwork />
      </div>
      <p className="story-paragraph">
        길드원 {guild.memberCount} / 30명이 모인 곳이에요. 길드 레이드 보스에게 데미지를 입힐 때마다 길드 경험치가 쌓여요(레벨당 레이드 골드 보상 +1%, 최대 +20%). 길드 채팅, 창고 같은 다른 로비 전용 콘텐츠는 준비 중이에요!
      </p>
      <button type="button" className="btn btn-neutral" onClick={onBack}>← 길드 정보로 돌아가기</button>
    </div>
  );
}
