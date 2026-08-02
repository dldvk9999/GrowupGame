import { useState } from 'react';
import { fetchGuildRaidState, fetchMyGuildRaidProgress, enterGuildRaid } from '../lib/guildRaid';
import { showToast } from '../lib/toast';

/**
 * 리팩토링(사용자 요청 - App.jsx 1494줄 분해): 길드 레이드 관련 상태/핸들러를
 * 통째로 뽑아냄. 완전히 자기완결적(길드 정보 자체는 GuildPanel이 별도로 관리하고,
 * 여긴 "레이드 보스 상태 + 도전 세션"만 다룸).
 */
export function useGuildRaid() {
  const [guildRaid, setGuildRaid] = useState(); // undefined=로딩중, null=길드미가입, object=정상
  const [guildRaidProgress, setGuildRaidProgress] = useState(null);
  const [guildRaidSession, setGuildRaidSession] = useState(null); // enterGuildRaid() 결과 | null
  const [guildRaidEntering, setGuildRaidEntering] = useState(false);
  const [guildRaidError, setGuildRaidError] = useState('');

  async function refreshGuildRaid() {
    try {
      const [raid, progress] = await Promise.all([fetchGuildRaidState(), fetchMyGuildRaidProgress()]);
      setGuildRaid(raid);
      setGuildRaidProgress(progress);
    } catch (err) {
      console.error('길드 레이드 정보 로드 실패', err);
    }
  }

  async function handleEnterGuildRaid() {
    setGuildRaidError('');
    setGuildRaidEntering(true);
    try {
      const sessionData = await enterGuildRaid();
      setGuildRaidSession(sessionData);
    } catch (err) {
      const message = err.message ?? '입장에 실패했어요.';
      setGuildRaidError(message);
      showToast(message, 'error');
    } finally {
      setGuildRaidEntering(false);
    }
  }

  function handleGuildRaidSettled(res) {
    setGuildRaid((prev) => (prev ? { ...prev, currentHp: res.newCurrentHp, cleared: res.clearedNow } : prev));
    if (res.clearedNow) {
      showToast('🛡️ 길드원들과 함께 레이드 보스를 처치했어요! 우편함을 확인해보세요.', 'success');
    }
    refreshGuildRaid();
  }

  return {
    guildRaid, setGuildRaid,
    guildRaidProgress, setGuildRaidProgress,
    guildRaidSession, setGuildRaidSession,
    guildRaidEntering, guildRaidError,
    refreshGuildRaid, handleEnterGuildRaid, handleGuildRaidSettled,
  };
}
