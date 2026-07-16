import { createClient } from '@supabase/supabase-js';

// anon/publishable 키만 프론트에 노출됨. RLS로 보호되니까 안전함.
// .env 파일에 아래 두 값 채우고, .env는 절대 git에 커밋하지 말 것.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다.');
}

// "자동 로그인" 체크박스 - 켜져 있으면 세션을 localStorage(브라우저를 껐다 켜도 유지)에,
// 꺼져 있으면 sessionStorage(탭/브라우저를 닫으면 사라짐)에 저장함.
const REMEMBER_KEY = 'growupgame-remember-me';

function getActiveStorage() {
  return localStorage.getItem(REMEMBER_KEY) === '1' ? localStorage : sessionStorage;
}

/** 로그인 시도 직전에 호출 - 이후 세션 저장 위치를 결정함 */
export function setRememberMe(remember) {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, '1');
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }
}

export function getRememberMe() {
  return localStorage.getItem(REMEMBER_KEY) === '1';
}

const customStorage = {
  getItem: (key) => getActiveStorage().getItem(key),
  setItem: (key, value) => getActiveStorage().setItem(key, value),
  removeItem: (key) => getActiveStorage().removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
