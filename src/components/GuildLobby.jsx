import { useEffect, useRef, useState } from 'react';
import { useGuildChat } from '../lib/useGuildChat';

// 길드 로비(신규 콘텐츠, 사용자 요청) - StoryArtwork.jsx와 동일한 방식으로 손으로 그린
// SVG 한 장으로 "로비 같은 분위기"를 연출함(외부 이미지 에셋 불필요). 170부터 길드 전용
// 채팅이 실제로 붙었음(LobbyChat.jsx와 동일 패턴) - 나머지 컨텐츠(창고 등)는 여전히
// harness/todo.md의 후속 과제로 남아있음.

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

export default function GuildLobby({ guild, profile, loginAt, onBack }) {
  const { messages, sendMessage } = useGuildChat(profile, guild.guildId, loginAt);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setError('');
    try {
      await sendMessage(text);
      setText('');
    } catch (err) {
      setError(err.message ?? '전송에 실패했어요.');
    }
  }

  return (
    <div className="story-popup-card" style={{ maxWidth: 480 }}>
      <h3 className="mypage-subtitle" style={{ marginTop: 0 }}>🏰 [{guild.tag}] {guild.name} 로비 <span className="app-title-badge">Lv.{guild.level}</span></h3>
      <div className="story-artwork">
        <GuildLobbyArtwork />
      </div>
      <p className="story-paragraph">
        길드원 {guild.memberCount} / 30명이 모인 곳이에요. 길드 레이드 보스에게 데미지를 입힐 때마다 길드 경험치가 쌓여요(레벨당 레이드 골드 보상 +1%, 최대 +20%).
      </p>

      <h4 className="mypage-subtitle">💬 길드 채팅 (길드원만 볼 수 있어요)</h4>
      <div className="lobby-chat-list" ref={listRef}>
        {messages.length === 0 && <p className="inventory-empty">아직 이번 접속에서 온 대화가 없어요. 첫 메시지를 남겨보세요!</p>}
        {messages.map((m) => (
          <div key={m.id} className={`lobby-chat-row ${m.user_id === profile?.id ? 'mine' : ''}`}>
            <span className="lobby-chat-nickname">{m.nickname}</span>
            <span className="lobby-chat-content">{m.content}</span>
          </div>
        ))}
      </div>
      {error && <p className="shop-error">{error}</p>}
      <form className="lobby-chat-form" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="길드원에게 메시지 보내기 (최대 200자)"
          maxLength={200}
        />
        <button type="submit" className="btn btn-challenge" disabled={!text.trim()}>전송</button>
      </form>

      <button type="button" className="btn btn-neutral" onClick={onBack} style={{ marginTop: 14 }}>← 길드 정보로 돌아가기</button>
    </div>
  );
}
