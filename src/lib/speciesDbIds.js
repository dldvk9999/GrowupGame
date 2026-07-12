// growth.js/speciesData.js에서 쓰는 문자열 키(fire_1 등)와
// supabase monster_species 테이블의 정수 PK를 서로 변환하기 위한 매핑표.
// 001_init.sql 시드 데이터의 id 컬럼과 반드시 일치해야 함.
export const speciesKeyToDbId = {
  fire_1: 1, fire_2: 2, fire_3: 3,
  water_1: 4, water_2: 5, water_3: 6,
  grass_1: 7, grass_2: 8, grass_3: 9,
};

export const dbIdToSpeciesKey = Object.fromEntries(
  Object.entries(speciesKeyToDbId).map(([key, id]) => [id, key])
);
