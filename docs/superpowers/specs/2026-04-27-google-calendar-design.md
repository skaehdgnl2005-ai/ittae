# Google Calendar 연동 + 개인 일정 직접 추가 설계 (2026-04-27)

## 배경

홈 화면(`/home`)은 현재 우리 DB의 `schedules` 테이블만 보여주지만, 사용자가 외부에 이미 가지고 있는 일정(직장, 학교, 개인 약속)은 우리 앱에 보이지 않고, 또한 사용자가 우리 앱 안에서 자기 개인 일정을 직접 만드는 UI도 없다. 이 두 결손을 함께 해결한다:

1. **Google 캘린더 읽기 전용 연동** — 사용자의 외부 일정을 우리 홈에 personal 일정 형태로 흡수.
2. **개인 일정 직접 추가** — 사용자가 우리 앱 안에서 직접 personal 일정을 만들고 편집·삭제.

두 기능 모두 같은 `schedules.type='personal'` 행에 저장되며 `source` 컬럼으로 출처(`'manual'` vs `'google'`)를 구분한다. 같은 날짜·시간에 잡힌 group 모임 카드는 시각적으로 충돌 표시한다. Apple 캘린더는 공개 API 부재로 MVP 범위에서 제외한다.

## 결정 사항

### Google Calendar 연동
- **연동 범위**: Google Calendar **읽기 전용**(`calendar.readonly` 스코프). 우리 앱이 사용자 캘린더에 쓰지 않음. Apple은 빼기.
- **인증 모델**: 카카오 로그인은 그대로. 별도의 "Google 캘린더 연결" 추가 동의 단계. 카카오 user 1명에 Google account 0~1개 매핑.
- **데이터 모델**: `schedules` 테이블 재사용. `source: 'manual' | 'google'` 컬럼으로 구분. 일정 표시는 personal 일정과 동일 형태(`type='personal'`).
- **동기화 모델**: 배치 sync. (a) 연결 직후 1회, (b) 홈 진입 시 마지막 sync로부터 1시간 경과 시 백그라운드 갱신. 매 진입마다 fetch 안 함.
- **시간 범위**: 다음 30일치 이벤트만 가져옴. 과거·먼 미래는 무시.
- **충돌 표시**: `DayEventList`의 group 카드 렌더링 시, 같은 날 personal/google 일정과 시간 overlap이 있으면 카드 배경을 amber로 + "내 일정과 겹쳐요" 라벨.
- **비공개 일정**: Google `visibility='private'` 이벤트는 제목을 "(비공개 일정)"으로 마스킹.
- **종일 이벤트**: `startTime='00:00'`, `endTime='23:59'`로 매핑.
- **삭제 동기화**: sync 시점에 Google에서 사라진 이벤트는 우리 DB에서도 삭제. wipe & replace는 아니고 `external_event_id` 기준 diff.
- **연결 해제**: 프로필에서 disconnect 가능. refresh token 폐기 + `source='google'` 일정 일괄 삭제.

### 개인 일정 직접 추가
- **진입점**: (a) 홈 화면 헤더 우상단 `+` 아이콘, (b) `DayEventList` 빈 상태("이 날은 일정이 없어요") 영역에 "내 일정 추가" 버튼. 둘 다 같은 바텀시트 컴포넌트(`AddPersonalScheduleSheet`) 호출.
- **필드**: 제목(필수, 최대 80자), 날짜(필수, 기본값=현재 선택일), 종일 토글, 시작/종료 시간(종일 OFF일 때만, 30분 단위), 메모(선택, 최대 200자).
- **저장 결과**: `schedules` INSERT — `type='personal'`, `source='manual'`, `external_event_id=NULL`.
- **편집/삭제 권한**: `source='manual'` 카드만 편집/삭제 가능. `source='google'` 카드는 비활성. 액션 진입은 personal 카드 길게 누르기(long-press 300ms) → 액션 시트(편집·삭제·취소).
- **유효성 검사**: 종료 시간 ≤ 시작 시간이면 저장 차단. 자정 넘는 일정은 시작 날짜에만 등록(MVP 단순화).
- **빠지는 것**: 반복 일정, 알림/푸시, 다른 사람 공유, 색상 커스터마이징, 첨부파일.

## 데이터 모델

### `users` 컬럼 추가

```sql
alter table users add column google_refresh_token text;
alter table users add column google_calendar_email text;
alter table users add column google_calendar_synced_at timestamptz;
```

- `google_refresh_token`: OAuth refresh token. RLS로 `auth.uid() = id`만 read 가능. 평문 저장(MVP). production 시 암호화 검토.
- `google_calendar_email`: 사용자에게 "어느 구글 계정과 연결됐는지" 보여주기 위한 표시용.
- `google_calendar_synced_at`: 마지막 동기화 시각. NULL이면 미연동 또는 최초 동기화 전.

### `schedules` 컬럼 추가

```sql
alter table schedules add column source text not null default 'manual'
  check (source in ('manual', 'google'));
alter table schedules add column external_event_id text;
alter table schedules add column external_etag text;

create unique index schedules_user_external_unique_idx
  on schedules(user_id, external_event_id)
  where external_event_id is not null;
```

- `source`: `'manual'` = 사용자가 직접 추가하거나 모임 확정으로 생성된 것, `'google'` = Google 캘린더 sync 결과.
- `external_event_id`: Google event id (`events.id`). source='google'일 때 NOT NULL.
- `external_etag`: incremental sync 시 변경 감지용. MVP는 무조건 upsert해서 사실상 미사용 가능. 컬럼만 두고 추후 확장.
- 기존 `schedules` 행은 자동으로 `source='manual'` (default).

### 기존 RLS 그대로

`schedules` RLS는 이미 `auth.uid() = user_id`로 제한된다고 가정. 추가 정책 불필요. `source='google'` 일정도 같은 정책으로 보호됨.

## 인증 / OAuth 플로우

### 환경 변수

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

`NEXT_PUBLIC_` 접두사는 사용 안 함. 모든 OAuth 처리는 서버 라우트에서.

### 라우트

| 경로 | 메서드 | 동작 |
|---|---|---|
| `/api/auth/google/connect` | GET | state(랜덤) 생성 → 쿠키에 저장 → Google consent URL로 302. 스코프: `openid email https://www.googleapis.com/auth/calendar.readonly`. `access_type=offline` + `prompt=consent`로 refresh token 강제 발급. |
| `/api/auth/google/callback` | GET | state 검증 → code 교환 → tokens 수신 → `users` UPDATE (`google_refresh_token`, `google_calendar_email`) → 즉시 1회 sync 트리거 → `/profile?google=connected` 또는 `/home`으로 redirect. |
| `/api/google/sync` | POST | server action으로도 가능. 본인 캘린더 sync 실행. |

### CSRF & state

- `connect`에서 32바이트 랜덤 state 생성. `Set-Cookie: google_oauth_state=<value>; HttpOnly; SameSite=Lax; Max-Age=600`.
- `callback`에서 쿼리 state와 쿠키 state 일치 확인. 불일치 시 400.

### Refresh token 부재

Google이 refresh token을 첫 동의에서만 주고 재동의 시 생략하는 경우가 있음. `prompt=consent`를 명시해 강제. 그래도 없으면 사용자에게 "이미 연결된 적이 있습니다, 구글 계정 보안 설정에서 우리 앱 액세스를 제거 후 재시도하세요" 안내.

## 동기화 로직 (`src/lib/google/sync.ts`)

### `syncUserGoogleCalendar(userId: string): Promise<SyncResult>`

1. `users` 행 조회 → `google_refresh_token` 없으면 `{ok:false, error:"NOT_CONNECTED"}` 반환.
2. refresh token으로 access token 발급. 실패(401, invalid_grant) 시 token revoke된 것으로 보고 `google_refresh_token=NULL` 처리 + `{ok:false, error:"REAUTH_REQUIRED"}`.
3. Google Calendar API 호출:
   - `GET https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={now}&timeMax={now+30d}&singleEvents=true&orderBy=startTime&maxResults=250`
   - 단일 페이지로 충분. 250개 초과 시 nextPageToken 처리.
4. 각 이벤트를 우리 Schedule 형태로 변환:
   - `external_event_id = event.id`
   - `title = event.visibility === 'private' ? '(비공개 일정)' : (event.summary || '제목 없음')`
   - 종일 이벤트: `event.start.date` 존재 → `date = event.start.date`, `startTime='00:00'`, `endTime='23:59'`
   - 시간 이벤트: `event.start.dateTime` → KST로 변환 → `date`, `startTime`, `endTime`
   - `type='personal'`, `source='google'`
5. DB 동기화 (트랜잭션 권장):
   - 현재 DB의 `(user_id, source='google', date BETWEEN now AND now+30d)` 조회 → 기존 set
   - 새 set과 diff:
     - 새 set에만: INSERT
     - 양쪽 모두: UPDATE (title/시간 변경 가능)
     - 기존 set에만: DELETE (Google에서 삭제됨)
6. `users.google_calendar_synced_at = now()` 업데이트.
7. `revalidatePath('/home')` 호출.
8. `{ok:true, data: {added, updated, removed}}` 반환.

### 시간대 처리

- 클라이언트는 KST(`Asia/Seoul`)로 가정.
- Google `dateTime`은 RFC3339 (UTC 포함). 변환 시 KST 날짜 경계 고려.
- 자정 넘어가는 이벤트(예: 23:00~01:00)는 시작 날짜에만 등록(MVP 단순화).

### Sync 트리거

| 트리거 | 위치 |
|---|---|
| OAuth callback 직후 | `app/api/auth/google/callback/route.ts` 안에서 `syncUserGoogleCalendar` 호출 후 redirect. |
| 홈 진입 시 stale check | `app/(main)/home/page.tsx`에서 `google_calendar_synced_at`이 1시간 이상 지났으면 fire-and-forget로 sync 호출. 페이지 렌더 블록하지 않음. |
| 수동 새로고침 | 홈에 작은 sync 버튼. 누르면 `/api/google/sync` POST 후 router.refresh(). |

## UI 변경

### `src/components/calendar/DayEventList.tsx`

- 그룹 카드 렌더 시 `hasConflict(groupSchedule, personalSchedulesOnSameDay)` 호출.
- overlap 정의: `groupSchedule`의 `[startTime, endTime)` 구간과 personal/google 일정의 `[startTime, endTime)`가 교집합 있음.
- 충돌 시 카드 클래스 변경:
  - 배경: `bg-amber-50 dark:bg-amber-950/30`
  - 좌측 컬러바: `bg-amber-500`
  - 카드 하단에 "⚠ 내 일정과 겹쳐요" 라벨 (`text-xs text-amber-700 dark:text-amber-400`)
- 일반(충돌 없음): 기존 violet/gray 그대로.

### `src/components/calendar/MonthlyCalendar.tsx`

- `hasEvent` 검사에 `source='google'` 일정도 포함 (현재 모든 schedule을 합쳐서 검사하므로 자동으로 동작).
- 점 색상은 그대로 violet-400.

### `src/components/calendar/DayEventList.tsx` (Google 일정 카드)

- `source='google'` 일정 카드는 personal과 동일 레이아웃이나, 제목 옆에 작은 Google 아이콘(`<GoogleIcon />`, lucide-react의 `Calendar` 또는 인라인 SVG) 표시. 14px gray-400.

### 신규 컴포넌트

- `GoogleConnectButton.tsx`: 프로필 페이지에 배치. 미연결 시 "Google 캘린더 연결" 버튼 → `/api/auth/google/connect` 이동. 연결 시 `{email} 연결됨` + 해제 버튼 표시.
- `GoogleSyncIndicator.tsx`: 홈 상단 또는 `TodaySummaryCard` 옆에 작은 칩. "방금 동기화 / 5분 전 / 1시간 전" 표기 + 새로고침 아이콘.
- `AddPersonalScheduleSheet.tsx`: 바텀시트. 제목/날짜/종일/시작/종료/메모 입력 + 저장. 편집 모드에서는 기존 일정 데이터로 prefill하고 액션을 INSERT 대신 UPDATE로 분기.
- `PersonalScheduleActionSheet.tsx`: 길게 누른 personal 카드에서 띄우는 액션 시트(편집·삭제·취소).
- `AddPersonalScheduleButton.tsx`: 홈 헤더 우상단 `+` 아이콘 버튼. 클릭 시 시트 오픈.

### 개인 일정 server action (`src/app/(main)/home/actions.ts` 또는 `schedule-actions.ts`)

```ts
"use server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

createPersonalSchedule(input: {
  title: string;
  date: string;
  startTime: string;  // 종일이면 "00:00"
  endTime: string;    // 종일이면 "23:59"
  memo: string | null;
  isAllDay: boolean;
}): Promise<Result<{ id: string }>>

updatePersonalSchedule(id: string, input: ...): Promise<Result<void>>

deletePersonalSchedule(id: string): Promise<Result<void>>
```

세 액션 모두 `createServerClient()` 사용. RLS 정책(`schedules`의 `auth.uid() = user_id` insert/update/delete)에 의존. `source='google'` 행은 update/delete 시 server action 단에서 명시적으로 거부(`source='google'`이면 `{ok:false, error:"GOOGLE_NOT_EDITABLE"}` 반환). 성공 시 `revalidatePath('/home')`.

## 충돌 감지 헬퍼 (`src/lib/schedule-conflict.ts`)

```ts
export function hasTimeOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function hasConflict(
  target: Schedule,
  others: Schedule[]
): boolean {
  return others.some(
    (o) =>
      o.id !== target.id &&
      o.date === target.date &&
      hasTimeOverlap(target, o)
  );
}
```

DayEventList에서:
```ts
const personalAndGoogle = daySchedules.filter((s) => s.type === "personal");
const conflictingGroupIds = new Set(
  daySchedules
    .filter((s) => s.type === "group" && hasConflict(s, personalAndGoogle))
    .map((s) => s.id)
);
```

## 사용자 시나리오

### 시나리오 A: 처음 연결

1. 사용자가 프로필 → "Google 캘린더 연결" 클릭.
2. Google consent 화면 → 동의.
3. callback에서 토큰 저장 + 즉시 sync 실행.
4. `/home` 으로 redirect.
5. 홈에 자기 구글 캘린더 일정이 personal 일정 카드로 표시됨.
6. TodaySummaryCard에 "일정 N개" 카운트 증가.
7. MonthlyCalendar에 점이 더 많이 찍힘.

### 시나리오 B: 모임 충돌 발견

1. 친구가 4/30 14:00~17:00 모임을 만들고 사용자를 초대.
2. 사용자가 홈 → 4/30 클릭.
3. DayEventList에 group 카드(모임)와 personal 카드(구글에서 가져온 "치과 14:30")가 함께 표시.
4. group 카드 배경이 amber로, "⚠ 내 일정과 겹쳐요" 라벨.
5. 사용자가 모임 상세로 이동해 시간 투표에서 X 처리.

### 시나리오 C: 개인 일정 직접 추가/편집/삭제

1. 사용자가 홈에서 4/30 선택 → 우상단 `+` 클릭.
2. 바텀시트 오픈. 제목 "치과 예약", 시간 14:30~15:30, 메모 "강남역 ABC 치과" 입력.
3. 저장 → INSERT → 바텀시트 닫힘 → DayEventList에 personal 카드로 즉시 표시.
4. 같은 시각에 group 모임이 잡혀 있으면 group 카드가 amber 배경으로 변경됨.
5. 사용자가 personal 카드 길게 누름 → 액션 시트 → "편집" 또는 "삭제".
6. 편집 시 동일 바텀시트가 prefill 상태로 열림. 삭제 시 즉시 DELETE.

### 시나리오 D: Token 만료

1. 사용자가 Google 보안 설정에서 우리 앱 액세스 제거.
2. 다음 sync 시도 시 401 반환.
3. `google_refresh_token` NULL로 변경.
4. 홈에 "Google 캘린더 재연결이 필요해요" 배너 표시 → 클릭 시 `/api/auth/google/connect`.
5. 기존 `source='google'` 일정은 유지 (사용자가 명시 disconnect 전까지). 데모 안정성 우선.

## 보안 고려

- `google_refresh_token`은 `users` 테이블 RLS로 본인만 read. server action에서만 admin client로 접근.
- OAuth state CSRF 검증 필수.
- `redirect_uri` 화이트리스트는 Google Cloud Console에서 등록한 것만 허용.
- `client_secret`은 절대 클라이언트로 노출 금지. `.env.local`에만.
- access token은 sync 함수 내에서만 임시로 사용, DB 저장 안 함.

## 시연 동선과의 정합성

CLAUDE.md의 핵심 데모 플로우(홈 → 친구 선택 → 모임 생성 → 투표 → 확정 → 지도 → 공유 → 기록)에서 캘린더는 **홈과 투표 단계**에서 가치를 발휘한다:

- 홈: 사용자의 외부 일정이 함께 보여 "꽉 찬 캘린더 느낌" → 앱 진지하게 사용하고 있다는 인상.
- 투표: 시간표 투표(when2meet 방식)에서 자기 일정이 잡힌 시간 슬롯에 대해 X 표시 결정이 빠름. 자동 X는 MVP 범위 외.

## Open Questions

- 종일 이벤트가 그룹 모임과 겹칠 때 충돌 표시 강도는? (모든 시간 차지하므로 그날 모든 group 카드가 amber 됨 — 의도대로면 OK)
- Multi-calendar 지원 (사용자가 여러 구글 캘린더 가질 때)? MVP는 `primary`만.
- 공휴일 캘린더 같은 구독 캘린더 동기화? `primary`만이라 자동 제외됨.
- Sync 실패 시 retry 정책? MVP는 1회 시도, 실패 시 사용자 수동 새로고침에 의존.

## 친구 추가 작업과의 충돌

| 영역 | 친구 추가 (004) | Google Calendar (005) |
|---|---|---|
| 마이그레이션 | `004_friend_add.sql` | `005_google_calendar.sql` |
| `users` 컬럼 | `invite_code` | `google_refresh_token`, `google_calendar_email`, `google_calendar_synced_at` |
| 신규 라우트 | `/i/[code]`, friends actions | `/api/auth/google/*`, `/api/google/sync` |
| 변경 컴포넌트 | `FriendsView`, `friends/page.tsx` | `DayEventList`, `MonthlyCalendar`, `home/page.tsx` |
| 공유 파일 | `src/types/index.ts`, `src/types/supabase.ts` | 동일 |

`src/types/index.ts`와 `src/types/supabase.ts`만 충돌 가능. 둘 다 `pnpm db:types` 실행 후 재생성하므로 worktree 분리 후 머지 시점에 한 번만 정리하면 됨. 나머지는 완전 독립.

## Success Criteria

- 사용자가 30초 안에 Google 캘린더 연결 완료할 수 있어야 함.
- 연결 후 홈 진입 시 1.5초 내에 자기 구글 일정이 personal 카드로 표시됨.
- 같은 날 group 모임과 시간 겹치면 amber 배경이 즉시 보임.
- Token 폐기/만료 시 앱이 크래시하지 않고 재연결 안내 배너가 뜸.
- 사용자가 우상단 `+` 또는 빈 상태 버튼으로 5초 안에 개인 일정 추가 시작 가능.
- 추가한 personal 일정이 즉시 DayEventList + MonthlyCalendar에 반영.
- `source='manual'` 일정만 편집/삭제 가능, `source='google'`은 차단됨.
- 친구 추가 worktree와 독립적으로 개발·테스트 가능.
