import { createClient } from '@supabase/supabase-js';

// anon/publishable 키만 프론트에 노출됨. RLS로 보호되니까 안전함.
// .env 파일에 아래 두 값 채우고, .env는 절대 git에 커밋하지 말 것.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
