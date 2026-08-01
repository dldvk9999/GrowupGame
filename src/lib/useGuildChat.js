import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

/**
 * 길드 전용 채팅 훅. useLobbyChat.js와 완전히 동일한 설계(로그인 시점 이후 메시지만
 * 로드 + 실시간 신규 메시지 구독) - guild_id로 스코프만 좁힘. RLS(170)가 "같은 길드원만
 * 보고 쓸 수 있음"을 서버에서 강제하므로, 여기서는 클라이언트 조회 조건에도 guild_id를
 * 걸어서 불필요한 다른 길드 메시지 조회 시도 자체를 안 함(성능 측면, 보안은 어차피 RLS가 담당).
 * 사용: const { messages, sendMessage } = useGuildChat(myProfile, guildId, sinceIso);
 */
export function useGuildChat(profile, guildId, sinceIso) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!guildId) { setMessages([]); return; }
    let ignore = false;
    const since = sinceIso ?? new Date(0).toISOString();

    supabase
      .from('guild_chat_messages')
      .select('*')
      .eq('guild_id', guildId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (!ignore && data) setMessages(data);
      });

    const channel = supabase
      .channel(`guild-chat-${guildId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guild_chat_messages', filter: `guild_id=eq.${guildId}` },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, [guildId, sinceIso]);

  const sendMessage = useCallback(
    async (content) => {
      if (!profile || !guildId || !content.trim()) return;
      const { data, error } = await supabase
        .from('guild_chat_messages')
        .insert({
          guild_id: guildId,
          user_id: profile.id,
          nickname: profile.nickname,
          content: content.trim(),
        })
        .select()
        .single();
      if (error) throw error;
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      return data;
    },
    [profile, guildId]
  );

  return { messages, sendMessage };
}
