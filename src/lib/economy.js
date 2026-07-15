// add_gold/spend_gold는 이제 client에서 직접 호출 불가(009 보안패치).
// 골드 지급은 각 액션에 맞는 전용 RPC(clear_stage, grant_idle_reward,
// claim_dungeon_reward, buy_item, enhance_item)가 서버에서 금액을 직접 계산해서 처리함.
import { supabase } from './supabaseClient';

/** 자동사냥 골드 지급 - 서버가 chapter/레벨로 직접 금액을 계산해서 지급 (반환값 = 지급액) */
export async function grantIdleReward(chapter, playerLevel) {
  const { data, error } = await supabase.rpc('grant_idle_reward', {
    p_chapter: chapter,
    p_player_level: playerLevel,
  });
  if (error) throw error;
  return data; // 지급된 골드
}
