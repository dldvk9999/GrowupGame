# 출석체크 & 업적 시스템

## 출석체크 (migration 046)

모바일 게임의 대표적인 재방문 유도 장치. 매일 접속해서 헤더의 "📅 출석체크" 버튼을 누르면 골드를 받는다.

### 데이터 구조

- `attendance_state`(user_id PK): `cycle_day`(0~7, 마지막으로 받은 날), `last_claim_date`(date, 서버 UTC 기준), `total_claim_count`
- client select만 허용, insert/update는 전부 `claim_attendance()` RPC(security definer) 경유

### 7일 주기 보상

| 일차 | 보상 |
|---|---|
| 1 | 💰500 |
| 2 | 💰800 |
| 3 | 💰1,200 |
| 4 | 💰1,800 |
| 5 | 💰2,500 |
| 6 | 💰3,500 |
| 7 (보너스) | 💰8,000 |

7일차를 받으면 다음 클레임은 다시 1일차부터 시작(무한 반복).

### 스트릭 규칙

`claim_attendance()`가 `last_claim_date`와 오늘 날짜(`current_date`, 서버 UTC)를 비교:
- **오늘 이미 받음** → 에러(`오늘은 이미 출석체크를 했어요.`)
- **어제 받음(연속)** → `cycle_day + 1`(7 넘으면 1로 순환)
- **그 외(하루 이상 건너뜀, 또는 첫 클레임)** → `cycle_day = 1`로 리셋. 첫 클레임(`last_claim_date is null`)은 "스트릭이 끊긴 것"으로 취급하지 않음(`streak_broken = false`)

스트릭이 끊겨도 이미 받은 보상은 회수하지 않음 — 처벌보다 재방문 유도가 목적이라 끊겨도 부담 없이 다시 시작하게 설계함.

**알려진 단순화**: 날짜 판정이 서버(UTC) 기준이라, 한국 시간(UTC+9) 자정 근처(오후 9시~자정)에 접속하면 실제 체감 날짜와 서버 판정 날짜가 다를 수 있음(예: 한국시간 밤 11시는 아직 UTC로는 전날 오후 2시). 크리티컬한 문제는 아니지만(어차피 "하루에 한 번" 개념이 유지됨) 정밀한 타임존 처리가 필요해지면 `last_claim_date`를 KST 기준으로 계산하도록 개선 필요.

### 클라이언트

- `src/lib/attendance.js`: `fetchAttendanceState`, `claimAttendance`, `hasClaimedToday`(로컬에서 오늘 날짜와 `last_claim_date` 비교)
- `src/components/AttendanceModal.jsx`: 7일 캘린더 그리드 모달. 이미 받은 날은 흐리게+체크, 다음 받을 날은 초록 테두리로 하이라이트, 7일차는 2칸 차지하는 보너스 카드로 강조
- 헤더의 "📅 출석체크" 버튼(데스크톱 헤더 + 모바일 드로워 양쪽)에 오늘 미수령 시 빨간 점 뱃지(`.mail-unread-dot` 재사용) — 우편함 뱃지와 동일한 시각 언어로 통일
- App.jsx가 로그인 시점에 `attendanceState`를 조회해서 뱃지 여부를 계산하고, 클레임 성공 시 로컬 state와 골드를 즉시 갱신(서버 재조회 없이 낙관적 업데이트)
