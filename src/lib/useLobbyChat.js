import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

/**
 * 로비 채팅 훅. 로그인한 시점(sinceIso) 이후의 메시지만 로드 + 실시간 신규 메시지 구독.
 * 로그아웃하면(=이 컴포넌트가 언마운트되면) 로컬에서 보던 채팅 내역은 사라짐 —
 * 서버(다른 유저들이 보는 공용 채팅)에서 실제로 삭제하는 건 아니고, "내가 로그인한 동안만
 * 보이는 화면"으로 범위를 좁힌 것뿐임.
 * 사용: const { messages, sendMessage } = useLobbyChat(myProfile, sinceIso);
 */
export function useLobbyChat(profile, sinceIso) {
  const [messages, setMessages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);

  useEffect(() => {
    let ignore = false;
    const since = sinceIso ?? new Date(0).toISOString();

    // 로그인한 시점 이후의 메시지만 로드
    supabase
      .from('chat_messages')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (!ignore && data) setMessages(data);
      });

    // 신규 메시지 실시간 구독 (다른 사람이 보낸 메시지가 내 화면에도 뜨게 함) + 접속자수 Presence
    const channel = supabase
      .channel('lobby-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .on('presence', { event: 'sync' }, () => {
        // presenceState()의 key 개수 = 현재 이 채널에 접속 중인 고유 클라이언트 수
        const state = channel.presenceState();
        setOnlineCount(Math.max(1, Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && profile?.id) {
          await channel.track({ user_id: profile.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, [sinceIso, profile?.id]);

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

  return { messages, sendMessage, onlineCount };
}
