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

    // 신규 메시지 실시간 구독 (다른 사람이 보낸 메시지가 내 화면에도 뜨게 함)
    const channel = supabase
      .channel('lobby-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
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
      // insert 결과를 직접 받아서 내 화면엔 realtime을 기다리지 않고 바로 반영함
      // (realtime publication 설정과 무관하게 "보냈는데 안 뜨는" 문제가 없도록)
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
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
    [profile]
  );

  return { messages, sendMessage };
}
