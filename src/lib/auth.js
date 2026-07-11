import { supabase } from './supabaseClient';

/** 닉네임 중복 확인 (회원가입/닉네임 변경 시 실시간 호출) */
export async function checkNicknameAvailable(nickname) {
  const { data, error } = await supabase.rpc('is_nickname_taken', {
    check_nickname: nickname,
  });
  if (error) throw error;
  return !data; // true면 사용 가능
}

/** 이메일 회원가입 + 닉네임 등록까지 한번에 */
export async function signUp({ email, password, nickname }) {
  const available = await checkNicknameAvailable(nickname);
  if (!available) {
    throw new Error('이미 사용 중인 닉네임입니다.');
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // 트리거로 자동 생성된 profiles row에 실제 닉네임 반영
  if (data.user) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ nickname })
      .eq('id', data.user.id);
    if (updateError) throw updateError;
  }

  return data;
}

/** 로그인 */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** 로그아웃 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** 닉네임 변경 (마이페이지 프로필 수정) */
export async function updateNickname(userId, newNickname) {
  const available = await checkNicknameAvailable(newNickname);
  if (!available) {
    throw new Error('이미 사용 중인 닉네임입니다.');
  }
  const { error } = await supabase
    .from('profiles')
    .update({ nickname: newNickname })
    .eq('id', userId);
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
