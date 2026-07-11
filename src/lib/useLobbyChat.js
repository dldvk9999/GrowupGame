import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

/**
 * 로비 채팅 훅. 최근 메시지 로드 + 실시간 신규 메시지 구독.
 * 사용: const { messages, sendMessage } = useLobbyChat(myProfile);
 */
export function useLobbyChat(profile) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let ignore = false;

    // 최근 메시지 50개 초기 로드
    supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!ignore && data) setMessages(data.reverse());
      });

    // 신규 메시지 실시간 구독
    const channel = supabase
      .channel('lobby-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const sendMessage = useCallback(
    async (content) => {
      if (!profile || !content.trim()) return;
      const { error } = await supabase.from('chat_messages').insert({
        user_id: profile.id,
        nickname: profile.nickname,
        content: content.trim(),
      });
      if (error) throw error;
    },
    [profile]
  );

  return { messages, sendMessage };
}
