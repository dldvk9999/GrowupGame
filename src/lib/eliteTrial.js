import { supabase } from './supabaseClient';
import { eliteExpToNextLevel } from './growth';

/**
 * 정예의 시련 - 정예레벨 1부터 입장 가능한 신규 던전(사용자 요청).
 * 보상 고민 결과: 새 재화를 만들지 않고 "정예 경험치"를 보상으로 줌 - 레벨 500(만렙)
 * 상태에서는 applyExpGain이 얻는 경험치를 이미 자동으로 정예경험치로 돌려주고 있어서
 * (168), 이 던전은 그 흐름을 재사용하는 "정예레벨 전용 고효율 파밍터" 역할만 하면 됨
 * (새 경제 리스크 없음, 기존 클라이언트 신뢰 모델의 경험치 지급 방식 그대로 재사용).
 *
 * ⚠️ 난이도 대폭 상향(사용자 요청, jobAdvancement.js 전직스킬 3.2배 상향과 함께 적용) -
 * 전직스킬을 강화하지 않고는 클리어하기 어려울 정도로 체력/방어력을 훨씬 가파르게 잡음
 * (특히 방어력을 크게 올려서 mitigateDamage의 100/(100+def) 수렴 공식상 "강화 안 된
 * 스킬로는 데미지가 거의 안 박히는" 체감을 만듦). 정확한 수치는 추정치라 다른 밸런스
 * 수치들처럼 실제 반응 보고 재조정 가능.
 */
export function getEliteTrialBoss(eliteLevel) {
  const lv = Math.max(1, eliteLevel);
  const maxHp = Math.round(15000 + Math.pow(lv, 1.75) * 1400);
  const atk = Math.round(400 + Math.pow(lv, 1.5) * 45);
  const def = Math.round(400 + Math.pow(lv, 1.6) * 55);
  // 한 번 클리어로 "현재 정예레벨업까지 필요한 경험치"의 약 15%를 줌 - 3회/일 제한과
  // 맞물려 대략 2~3일에 한 정예레벨씩 오르는 속도(레벨이 오를수록 자연히 더뎌짐)
  const expReward = Math.round(eliteExpToNextLevel(lv) * 0.15);
  return {
    name: `정예 시련 · ${lv}단계`,
    icon: '💠',
    element: 'water', // 신비로운 시련의 공간 테마로 물 속성 고정(속성상성 계산용)
    maxHp, hp: maxHp, atk, def,
    expReward,
  };
}

// ============================================
// 일일 스킬 제한(사용자 요청, 신규) - 정예레벨 구간별로 특정 스킬을 못 쓰게 막아서
// "전직스킬 강화 없이 아무 스킬이나 도배하면 이긴다"를 막고 전략적 스킬 편성을 강제함.
// - 1~19단계: 치유(heal)/지속피해(dot) 타입 항상 금지(고정, 랜덤 아님)
// - 20~59단계: 매일 랜덤으로 3종류 금지(damage 제외 - 공격수단 자체를 막으면 클리어가
//   불가능해지므로 damage 타입은 절대 금지 목록에서 제외)
// - 60~100단계: 신화(mythic) 등급 스킬 전부 금지(타입 무관, 등급 기준)
// 랜덤은 매일 자정(한국시간) 기준으로 서버-클라이언트 무관하게 동일한 결과가 나오도록
// 날짜 기반 시드로 결정(같은 날엔 모든 플레이어가 동일한 금지 목록을 봄).
// ============================================

const BANNABLE_TYPES = ['heal', 'stun', 'dot', 'buff_atk', 'buff_def', 'haste']; // damage는 항상 제외

/** 한국시간 기준 오늘 날짜를 정수 시드로 변환 */
function getKstDateSeed() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCFullYear() * 10000 + (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
}

/** 시드 기반 결정적 PRNG(mulberry32) - 같은 시드면 항상 같은 순서로 뽑음 */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededPick(pool, count, seed) {
  const rand = mulberry32(seed);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

/** 오늘 하루 정예레벨 구간에 따라 금지되는 스킬 "타입" 목록(damage 제외) */
export function getTodayBannedSkillTypes(eliteLevel) {
  const lv = Math.max(1, eliteLevel);
  if (lv < 20) return ['heal', 'dot'];
  if (lv < 60) return seededPick(BANNABLE_TYPES, 3, getKstDateSeed() + lv * 7); // 구간별로 시드를 조금씩 다르게 해서 매 구간 다른 조합
  return []; // 60단계 이상은 타입 제한 대신 등급(신화) 제한을 씀
}

/** 60단계 이상이면 신화 등급 스킬 전부 금지 */
export function isMythicBannedToday(eliteLevel) {
  return (eliteLevel ?? 0) >= 60;
}

/** 특정 스킬이 오늘 정예의 시련에서 금지 목록에 걸리는지 */
export function isSkillBannedInEliteTrial(skill, eliteLevel) {
  if (!skill) return false;
  if (isMythicBannedToday(eliteLevel) && skill.rarity === 'mythic') return true;
  const bannedTypes = getTodayBannedSkillTypes(eliteLevel);
  return bannedTypes.includes(skill.type);
}

export async function fetchEliteTrialAttemptsToday() {
  const { data, error } = await supabase.rpc('fetch_elite_trial_attempts_today');
  if (error) throw error;
  return data ?? 0;
}

export async function enterEliteTrial() {
  const { error } = await supabase.rpc('enter_elite_trial');
  if (error) throw new Error(error.message);
}
