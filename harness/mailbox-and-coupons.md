# 우편함 & 쿠폰

관련 파일: `Settings.jsx`, `Mailbox.jsx`, `mail.js`, `CouponRedeem.jsx`, `coupon.js`

## 진입 경로

헤더의 "⚙️ 설정" 버튼으로 진입, 내부에 우편함/쿠폰입력 서브탭.

## 정기 우편함

- 매일 **08:00 / 12:00 / 19:00 (서울시간)** 기준으로 각 10만 골드
- **정각~1시간 이내에 접속해야만 지급됨**(017부터, 놓치면 그 회차는 영구 소멸, 소급 지급 없음)
- cron 없이 **지연 생성(lazy) 방식** — `sync_daily_mails()` RPC를 우편함 진입 시 호출하면, 지금이 정확히 그 시각의 시(hour) 안일 때만 생성됨. `source_key`(예: `daily_gold_2026-07-15_08`)의 유니크 제약으로 같은 시간대 중복 생성을 원천 차단
- 우편 수령은 `claim_mail` RPC가 골드 지급 + 아이템(있다면)을 `user_inventory`에 원자적으로 넣어줌
- ⚠️ **버그 수정 이력(037)**: `claim_mail`이 `for update` 락 없이 읽고-쓰기를 분리해서, 짧은 간격의 중복 요청 시 골드 이중지급 여지가 있었음(레이스컨디션) → `for update` 추가로 수정. 또한 `user_inventory`의 `unique(user_id, item_key)` 제약(014) 때문에, **이미 보유한 아이템이 든 우편은 INSERT 실패로 골드까지 클레임 전체가 실패**하던 버그도 있었음 → `on conflict do update`로 바꿔서 뽑기 중복과 동일하게 강화수치 +1 병합되도록 수정
- **수령 완료한 우편은 삭제 가능** — `mails`에 "본인 소유 + `claimed=true`" 조건의 DELETE 정책(RPC 없이 직접 삭제, 삭제로 얻을 게 없어 보안상 문제 없음). "수령 완료" 목록에 🗑️ 삭제 버튼
- **"전체 수령" 버튼** + `Enter` 단축키로 미수령 우편 일괄수령

## 신규 유저 환영 패키지 (migration 052)

`create_starter_monster()`(스타터 계약 시점)에 우편함으로 자동 지급되는 1회성 온보딩 보너스 — 골드 3000 + 레어 무기 1개(`weapon_rare`). 초반 그라인딩 부담을 덜어 첫 세션 이탈률을 낮추려는 목적.

- `source_key = 'starter_pack'`으로 삽입, `mails`의 `unique(user_id, source_key)`(008)가 그대로 중복 방지 — 별도 검증 로직 불필요
- **기존 계정에는 소급 지급되지 않음** — `create_starter_monster`는 계정당 정확히 1번만 실행되므로, 052 배포 이전 가입자는 받지 못함(의도된 동작, 신규 가입자 대상 장치)
- 아이템 지급은 기존 우편 시스템(037에서 병합 버그 수정된 `claim_mail`)을 그대로 타므로 클라이언트 수정 불필요

## 복귀 유저(윈백) 보상 (migration 102)

3일 이상 접속하지 않았던 유저가 다시 로그인하면 축하 우편으로 보너스 골드를 지급하는 리텐션 장치. 이탈 직전/직후 유저를 다시 붙잡는 게 신규 유입보다 저렴하다는 모바일 게임 업계의 일반적 통념을 반영.

- `profiles.last_login_at`(102 신규 컬럼, 기본값 `now()`) — `record_login_and_grant_comeback_reward()` RPC가 로그인마다 호출되어 갱신. 이 함수는 매 호출마다 항상 자기 컬럼을 스스로 갱신하므로 반복 호출해도 최초 1회 외엔 지급되지 않음(안전)
- 갱신 **전** 값과 현재 시각의 차이가 3일 이상이면 `v_days * 1500`(최소 5,000 ~ 최대 50,000) 골드를 `source_key = 'comeback_YYYYMMDD'` 우편으로 발송, 이후 무조건 `last_login_at = now()`로 갱신(보상 지급 여부와 무관하게 매번 갱신해야 다음 이탈 판정 기준일이 정확함)
- 클라이언트: `comeback.js`의 `claimComebackRewardIfEligible()` — `App.jsx`의 `handleSession`에서 메인 데이터 로딩 `Promise.all`보다 **먼저** `await`로 단독 실행(우편함 조회보다 먼저 완료되어야 방금 지급된 우편이 바로 보임). 실패해도 로그인 자체는 막지 않도록 조용히 catch
- `granted=true`면 로그인 직후 "🎉 N일 만의 복귀! 우편함에서 보너스를 받아가세요" 토스트+효과음 표시
- 배포 시점 기존 유저는 컬럼 기본값이 `now()`라 즉시 지급되지 않고, 다음에 실제로 3일 이상 쉬어야 자연스럽게 트리거됨(의도된 동작)
- 반환 컬럼(`granted`/`days_away`/`gold_reward`)이 `profiles`/`mails` 컬럼명과 겹치지 않아 "column reference is ambiguous" 패턴([`dev-guide.md`](./dev-guide.md) 참고) 위험 없음
- 오프라인 골드 보상(103/106, [`stages-and-dungeons.md`](./stages-and-dungeons.md))과는 완전히 별개 컬럼(`last_offline_claim_at`)을 쓰는 독립 기능 — 103 최초 설계는 이 컬럼을 공유하며 오프라인 보상 쪽 갱신을 이 함수에 의존했는데, 그 구조가 반복호출 파밍 취약점의 원인이었어서 106에서 완전히 분리함

## 쿠폰 시스템

- `coupons` 테이블에 쿠폰코드/골드량/아이템/최대사용횟수/만료일을 직접 INSERT해서 발행(관리용 UI 없음, SQL 직접 발행)
- `redeem_coupon(code)` RPC — 만료/횟수소진/중복사용(유저당 1회, `coupon_redemptions` 유니크 제약) 검증 후 보상을 **우편함으로** 지급(즉시 지급 아님)
- ⚠️ **버그 수정 이력(037)**: `max_uses` 체크가 읽고-쓰기 분리라서, 여러 유저가 마지막 남은 횟수를 거의 동시에 입력하면 살짝 초과할 수 있었음(레이스컨디션) → 원자적 `UPDATE ... WHERE used_count < max_uses`로 수정
- 테스트용 예시 쿠폰 `WELCOME2026`(골드 5000 + 레어 무기) 시드
- **`UPDATE2026`**(골드 8000 + 레어 장갑, 무제한, 2026-12-31 만료) — 출석체크/업적/랭킹/무료뽑기/칭호 출시 기념(054)
- **`REFRESH2026`**(골드 10000 + 에픽 방어구, 무제한, 2027-03-31 만료) — 디자인 리프레시/친구추천/업적랭킹 기념(067)
- **`TOWER2026`**(골드 15000 + 에픽 무기, 무제한, 2027-06-30 만료) — 무한의 탑 출시 기념(076)
- **`ACHIEVE44`**(골드 20000 + 레전더리 장갑, 무제한, 2027-12-31 만료) — 업적 44개 돌파 기념(095)
- **`DUNGEONCOMBO`**(골드 12000 + 에픽 무기, 무제한, 2027-12-31 만료) — 던전 일일 콤보 보너스 출시 기념(099)
- `Enter` 단축키로 폼 제출(HTML form 기본 동작)

## 새 쿠폰 발행 예시

```sql
insert into public.coupons (code, gold_amount, item_key, max_uses, expires_at)
values ('원하는코드', 10000, null, 100, '2026-12-31'::timestamptz);
```
