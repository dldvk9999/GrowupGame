// 전직 스킬 전용 키보드 단축키 (신규, 사용자 요청) - 기존 숫자키(1~9)는 장착 스킬
// "순서"대로 매핑돼있어서, 기본 스킬 5개 + 전직 스킬(최대 10개)을 다 채우면 전직
// 스킬 상당수가 9번 이후 순번이라 단축키가 아예 없었음(전직 6~10차 확장 이후 특히
// 심해짐 - 사용자 피드백: "전직스킬을 마우스로만 사용하기가 너무 힘들다").
// 전직 단계(1~10차)별로 고정된 전용 키를 배정해서, 장착한 스킬이 몇 개든 항상
// 같은 키로 그 전직스킬을 쓸 수 있게 함. 사용자가 설정 화면에서 재배치 가능.

export const JOB_SKILL_KEY_SLOTS = 12; // Q W E R A S D F Z X C V (전직 최대 10차 + 여유 2개)
const DEFAULT_KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];
const STORAGE_KEY = 'growupgame-job-skill-keybinds';

/** 현재 키 배치(소문자 12개 배열, 인덱스0=1차전직...인덱스9=10차전직) */
export function getJobSkillKeybinds() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length === JOB_SKILL_KEY_SLOTS && saved.every((k) => typeof k === 'string')) {
      return saved;
    }
  } catch {
    // 저장값이 없거나 손상됐으면 기본값
  }
  return [...DEFAULT_KEYS];
}

/** 키 배치 저장(전체 12개 배열) */
export function setJobSkillKeybinds(keys) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // localStorage 불가 환경이면 조용히 무시(치명적이지 않음, 기본값으로 계속 동작)
  }
}

export function resetJobSkillKeybinds() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function getDefaultJobSkillKeybinds() {
  return [...DEFAULT_KEYS];
}

/** jobTier(1~10) -> 배정된 키(소문자 1글자) */
export function getKeyForJobTier(keybinds, jobTier) {
  return keybinds[jobTier - 1];
}
