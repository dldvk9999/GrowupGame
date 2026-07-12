// type: 'damage' | 'heal'
// multiplier: 공격력 대비 배율 (heal은 maxHp 대비 회복 비율)
export const SKILLS = [
  {
    id: 'claw',
    name: '불꽃 발톱',
    icon: '🔥',
    type: 'damage',
    multiplier: 1.1,
    cooldown: 800,
    description: '가볍고 빠른 기본기',
  },
  {
    id: 'fireball',
    name: '화염구',
    icon: '☄️',
    type: 'damage',
    multiplier: 1.7,
    cooldown: 2200,
    description: '멀리서 던지는 화염 덩어리',
  },
  {
    id: 'breath',
    name: '폭염 브레스',
    icon: '🌋',
    type: 'damage',
    multiplier: 2.3,
    cooldown: 3600,
    description: '넓게 퍼지는 열기',
  },
  {
    id: 'rage_strike',
    name: '분노의 강타',
    icon: '💥',
    type: 'damage',
    multiplier: 3.0,
    cooldown: 5000,
    description: '가장 강력하지만 쿨타임이 김',
  },
  {
    id: 'ember_heal',
    name: '재생의 불씨',
    icon: '✨',
    type: 'heal',
    multiplier: 0.22,
    cooldown: 6000,
    description: '최대 체력의 22%를 회복',
  },
];
