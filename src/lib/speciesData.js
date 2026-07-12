// supabase/migrations/001_init.sql의 monster_species 시드와 동일한 값.
// 전투 화면에서 레벨업/진화 계산을 즉시 처리하기 위해 클라이언트에도 들고 있음.
// 나중에 실제 서버 데이터로 완전히 옮기고 싶으면 앱 시작 시
// supabase.from('monster_species').select('*') 결과로 이 객체를 대체하면 됨.
export const speciesById = {
  fire_1: { id: 'fire_1', dbId: 1, name: '이모탄', element: 'fire', evolveLevel: 15, evolvesTo: 'fire_2', baseHp: 40, baseAtk: 12, baseDef: 8 },
  fire_2: { id: 'fire_2', dbId: 2, name: '이모드릴', element: 'fire', evolveLevel: 30, evolvesTo: 'fire_3', baseHp: 70, baseAtk: 20, baseDef: 14 },
  fire_3: { id: 'fire_3', dbId: 3, name: '이모라돈', element: 'fire', evolveLevel: null, evolvesTo: null, baseHp: 120, baseAtk: 34, baseDef: 22 },

  water_1: { id: 'water_1', dbId: 4, name: '아쿠파피', element: 'water', evolveLevel: 15, evolvesTo: 'water_2', baseHp: 44, baseAtk: 10, baseDef: 10 },
  water_2: { id: 'water_2', dbId: 5, name: '아쿠나가', element: 'water', evolveLevel: 30, evolvesTo: 'water_3', baseHp: 76, baseAtk: 17, baseDef: 18 },
  water_3: { id: 'water_3', dbId: 6, name: '아쿠드래곤', element: 'water', evolveLevel: null, evolvesTo: null, baseHp: 128, baseAtk: 28, baseDef: 30 },

  grass_1: { id: 'grass_1', dbId: 7, name: '새프링', element: 'grass', evolveLevel: 15, evolvesTo: 'grass_2', baseHp: 42, baseAtk: 11, baseDef: 9 },
  grass_2: { id: 'grass_2', dbId: 8, name: '새프트리', element: 'grass', evolveLevel: 30, evolvesTo: 'grass_3', baseHp: 74, baseAtk: 19, baseDef: 16 },
  grass_3: { id: 'grass_3', dbId: 9, name: '새프로드', element: 'grass', evolveLevel: null, evolvesTo: null, baseHp: 124, baseAtk: 30, baseDef: 26 },
};

// DB의 owned_monsters.species_id(숫자) → 클라이언트 speciesId(문자열) 역매핑
export const speciesIdByDbId = Object.fromEntries(
  Object.values(speciesById).map((s) => [s.dbId, s.id])
);
