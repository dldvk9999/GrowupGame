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
