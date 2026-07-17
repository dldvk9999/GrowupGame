import { useEffect, useRef, useState } from 'react';
import { useLobbyChat } from '../lib/useLobbyChat';
import Leaderboard from './Leaderboard';

export default function LobbyChat({ profile, sinceIso, activeMonster }) {
  const { messages, sendMessage, onlineCount } = useLobbyChat(profile, sinceIso);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [subTab, setSubTab] = useState('chat');
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
    <div className="lobby-chat-screen">
      <h2>로비 <span className="lobby-online-badge">🟢 {onlineCount}명 접속 중</span></h2>
      <div className="shop-tabs">
        <button className={`shop-tab ${subTab === 'chat' ? 'active' : ''}`} onClick={() => setSubTab('chat')}>💬 채팅</button>
        <button className={`shop-tab ${subTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setSubTab('leaderboard')}>🏆 랭킹</button>
      </div>

      {subTab === 'leaderboard' ? (
        <Leaderboard profile={profile} activeMonster={activeMonster} />
      ) : (
        <>
      <p className="stage-select-hint">모든 유저가 함께 보는 채팅이에요. 닉네임은 자동으로 붙고, 지금 로그인한 시점부터의 대화만 보여요(로그아웃하면 화면에서 사라져요).</p>

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
          placeholder="메시지를 입력하세요 (최대 200자)"
          maxLength={200}
        />
        <button type="submit" className="btn btn-challenge" disabled={!text.trim()}>전송</button>
      </form>
        </>
      )}
    </div>
  );
}
