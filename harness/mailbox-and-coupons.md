# 우편함 & 쿠폰

관련 파일: `Settings.jsx`, `Mailbox.jsx`, `mail.js`, `CouponRedeem.jsx`, `coupon.js`

## 진입 경로

헤더의 "⚙️ 설정" 버튼으로 진입, 내부에 우편함/쿠폰입력 서브탭.

## 정기 우편함

- 매일 **08:00 / 12:00 / 19:00 (서울시간)** 기준으로 각 10만 골드
- **정각~1시간 이내에 접속해야만 지급됨** (migration 017부터, 놓치면 그 회차는 영구 소멸, 소급 지급 없음)
- cron 없이 **지연 생성(lazy) 방식**으로 구현함 — `sync_daily_mails()` RPC를 우편함 진입 시 호출하면, "지금이 정확히 그 시각의 시(hour) 안"일 때만 생성됨(`v_hour = v_slot.h`). `source_key`(예: `daily_gold_2026-07-15_08`)에 유니크 제약을 걸어 같은 시간대 중복 생성을 원천 차단
- 우편 수령은 `claim_mail` RPC가 골드 지급 + (있다면) 아이템을 `user_inventory`에 원자적으로 넣어줌
- **수령 완료한 우편은 삭제 가능** — `mails` 테이블에 "본인 소유 + `claimed=true`" 조건의 DELETE 정책 추가(RPC 없이 직접 삭제, 삭제는 아무것도 얻을 게 없는 행동이라 보안상 문제 없음). `Mailbox.jsx`의 "수령 완료" 목록에 🗑️ 삭제 버튼
- **"전체 수령" 버튼** + `Enter` 키보드 단축키로 미수령 우편 일괄수령 가능

## 쿠폰 시스템

- `coupons` 테이블에 쿠폰코드/골드량/아이템/최대사용횟수/만료일을 직접 INSERT해서 발행(관리용 UI는 없음, SQL로 직접 발행)
- `redeem_coupon(code)` RPC — 만료/횟수소진/중복사용(유저당 1회, `coupon_redemptions` 유니크 제약) 검증 후, 보상을 **우편함으로** 지급(바로 지급 아님, 우편함에서 수령해야 함)
- 테스트용 예시 쿠폰 `WELCOME2026`(골드 5000 + 레어 무기) 하나가 시드로 들어가 있음
- `Enter` 키보드 단축키로 폼 제출 가능(별도 구현 없이 HTML form 기본 동작)

## 새 쿠폰 발행 예시

```sql
insert into public.coupons (code, gold_amount, item_key, max_uses, expires_at)
values ('원하는코드', 10000, null, 100, '2026-12-31'::timestamptz);
```
