---
globs:
  - "src/lib/supabase/**"
  - "supabase/**"
  - "src/app/api/**"
alwaysApply: false
---

# Supabase 패턴

## 클라이언트 사용
```typescript
// 서버 컴포넌트 / Route Handler
import { createServerClient } from "@/lib/supabase/server";
const supabase = await createServerClient();

// 클라이언트 컴포넌트
import { createBrowserClient } from "@/lib/supabase/client";
const supabase = createBrowserClient();
```

## RLS 필수
- 모든 테이블에 RLS 활성화. 예외 없음.
- 정책명 규칙: `{table}_{action}_{role}` (예: groups_select_member)
- 새 테이블 생성 시 최소 select/insert/update/delete 4개 정책.

## 실시간 구독
```typescript
supabase.channel("room-name")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "votes",
    filter: `session_id=eq.${id}`,
  }, handler)
  .subscribe();
```
- 구독은 반드시 cleanup (useEffect return에서 unsubscribe).
- channel 이름은 고유하게 (`votes:${sessionId}`).

## 마이그레이션
- `supabase/migrations/` 디렉토리에 SQL 파일.
- 파일명: `{timestamp}_{description}.sql`
- 변경 후 반드시 `pnpm db:types` 실행.
- 타입 파일을 직접 수정하지 않는다.
