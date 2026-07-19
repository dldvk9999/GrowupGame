import { supabase, setRememberMe } from './supabaseClient';

/** 닉네임 중복 확인 (회원가입/닉네임 변경 시 실시간 호출) */
export async function checkNicknameAvailable(nickname) {
  const { data, error } = await supabase.rpc('is_nickname_taken', {
    check_nickname: nickname,
  });
  if (error) throw error;
  return !data; // true면 사용 가능
}

/** 이메일 회원가입 - 닉네임은 트리거가 메타데이터로 직접 반영 (마이페이지의 "1회 수정"과 별개) */
export async function signUp({ email, password, nickname }) {
  const available = await checkNicknameAvailable(nickname);
  if (!available) {
    throw new Error('이미 사용 중인 닉네임입니다.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) throw error;
  return data;
}

/** 로그인 - rememberMe가 true면 브라우저를 껐다 켜도 세션이 유지됨(localStorage), 아니면 탭 닫으면 로그아웃됨(sessionStorage) */
export async function signIn({ email, password, rememberMe }) {
  setRememberMe(rememberMe); // signInWithPassword가 세션을 저장하기 전에 먼저 저장 위치를 정해둬야 함
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** 로그아웃 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** 마이페이지 닉네임 변경 - 평생 1회만 허용 (서버 RPC에서 재검증) */
export async function updateNickname(newNickname) {
  const available = await checkNicknameAvailable(newNickname);
  if (!available) {
    throw new Error('이미 사용 중인 닉네임입니다.');
  }
  const { error } = await supabase.rpc('update_nickname', { p_nickname: newNickname });
  if (error) throw error;
}

/** 현재 로그인 유저의 프로필 조회 */
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

/** 친구 추천인 등록 (가입 후 24시간 이내 1회만 가능, 이후엔 서버가 거부함) */
export async function setReferrer(referrerNickname) {
  const { error } = await supabase.rpc('set_referrer', { p_referrer_nickname: referrerNickname });
  if (error) throw new Error(error.message);
}

/** 내가 추천한 사람 수(profiles.referred_by = 나) - RLS가 "누구나 조회 가능"이라 직접 count 쿼리 가능 */
export async function fetchMyReferralCount(userId) {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', userId);
  if (error) throw error;
  return count ?? 0;
}

/** 친구 추천 랭킹 TOP20 */
export async function fetchReferralLeaderboard() {
  const { data, error } = await supabase.rpc('fetch_referral_leaderboard');
  if (error) throw error;
  return data ?? [];
}

/** 내 추천 순위 (20위 밖일 때 표시용) */
export async function fetchMyReferralRank() {
  const { data, error } = await supabase.rpc('fetch_my_referral_rank');
  if (error) throw error;
  return data;
}

/** 전체 가입자 수 (로그인 화면에 커뮤니티 규모 표시용) - profiles가 공개 RLS라 직접 count 가능 */
export async function fetchTotalUserCount() {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

/** 전체 유저가 지금까지 달성한 업적 총 횟수 (로그인 화면 커뮤니티 현황용) */
export async function fetchTotalAchievementClaims() {
  const { data, error } = await supabase.rpc('fetch_total_achievement_claims');
  if (error) throw error;
  return data ?? 0;
}
