# Phase 1 프론트엔드 설계

**날짜:** 2026-04-13  
**범위:** Next.js 14 프로젝트 초기화 + 5개 화면 (홈·친구/그룹·투표·지도·기록)  
**목표:** 심사위원 시연용 MVP 프론트엔드 완성 (목업 데이터 기반, Phase 2에서 Supabase 연결)

---

## 확정된 기술 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 실행 순서 | TASKS.md 그대로 (0→1→2→3→4→5) | 각 화면 완료 후 `/design-check` 게이트 유지 |
| 캘린더 구현 | date-fns 기반 직접 구현 | Instrument Serif 날짜 + violet dot 커스텀 필수 |
| 목업 인터랙션 | React useState | Phase 2 Supabase 교체 최소화 |
| 애니메이션 | Framer Motion: 페이지 fade+translateY(8px), 리스트 50ms stagger | 네이티브 앱 느낌, DESIGN_SYSTEM.md 모션 원칙 준수 |

---

## Phase 0 — 프로젝트 기반

### 설정 파일
- `tailwind.config.ts` — 커스텀 `violet.*` + `gray.*` 팔레트 (DESIGN_SYSTEM.md 부록 기준)
- `next/font/local` — Pretendard Variable (본문), Instrument Serif (숫자 강조)
- shadcn/ui 초기화 + 필요 컴포넌트 설치

### 공통 컴포넌트 (`src/components/ui/`)
| 컴포넌트 | 규격 |
|---------|------|
| `Avatar` | 32/44/64px, border-radius 50%, 그룹 시 최대 4+N |
| `Badge` | 투표중(amber)/확정(emerald)/완료(gray), 4px 8px padding, 6px radius |
| `Card` | white bg, 1px gray-200 border, 12px radius, 16px padding |
| `Button` | Primary(violet-600, 52px)/Secondary(gray-100, 48px)/Ghost/Danger |

### 레이아웃
- `src/app/(main)/layout.tsx` — BottomTabNav 5탭 (home/friends/create/map/history)
- 탭바 높이 83px, safe area 포함

### 목업 데이터 (`src/lib/mock/index.ts`)
타입 포함 export: `users`, `groups`, `votes`, `places`, `memories`, `schedules`

---

## Phase 1 — 홈 (캘린더 대시보드)

**경로:** `src/app/(main)/home/`  
**기능 ID:** H-01 ~ H-05 (H-06 주간 뷰 토글은 P2, Phase 1 제외)

### 컴포넌트
| 컴포넌트 | 설명 |
|---------|------|
| `MonthlyCalendar` | date-fns 기반 직접 구현. 날짜 숫자는 Instrument Serif. 오늘: violet-600 원형 배경. 이벤트 있는 날: 하단 4px dot. |
| `DayEventList` | 선택된 날짜의 일정 카드 리스트. 좌측 3px 컬러바 (개인=gray-300, 모임=violet-600). 시간·장소·참여자 아바타 표시. |
| `TodaySummaryCard` | 상단 고정. "오늘 N개 일정" 요약 + 가장 가까운 일정 하이라이트. |

### 상태 관리
- `selectedDate: Date` — 선택된 날짜 (useState, 오늘로 초기화)
- 날짜 선택 → DayEventList 필터링

### 빈 상태
"아직 일정이 없어요" 텍스트 + "모임 만들기" CTA 버튼 (일러스트 없음)

---

## Phase 2 — 친구/그룹 목록

**경로:** `src/app/(main)/friends/`  
**기능 ID:** F-01 ~ F-05 (F-07 즐겨찾기는 P2, Phase 1 제외)

### 컴포넌트
| 컴포넌트 | 설명 |
|---------|------|
| `FriendList` | 검색바 (gray-100 bg, violet-600 focus border), 32px 아바타, 이름·최근 모임 날짜 |
| `GroupCard` | 모임명 + 상태 배지 + 아바타 그룹(최대 4+N) + 날짜 |
| `FilterChip` | 전체/투표중/확정/완료. 선택 시 violet-50 bg + violet-600 text |

### 탭 구조
상단 탭: 친구 | 모임 (useState로 전환)

---

## Phase 3 — 그룹 상세 / 투표

**경로:** `src/app/group/[id]/`  
**기능 ID:** V-01 ~ V-07 (V-08 리마인더는 P2, Phase 1 제외)  
**주의:** `/vote-flow` 스킬 사용

### 컴포넌트
| 컴포넌트 | 설명 |
|---------|------|
| `VoteMatrix` | 날짜(열) × 참여자(행) 그리드. 셀 높이 44px (터치 타겟). |
| `VoteCell` | ⭕ violet-500 / △ amber-400 / ❌ gray-300. 클릭으로 상태 순환. |
| `BestDateBanner` | 가장 많은 ⭕를 받은 날짜 자동 추천. 해당 행 violet-50 bg 하이라이트. |
| `StickyConfirmButton` | 화면 하단 고정. 전원 투표 완료 전 opacity 0.4 disabled. |
| `CommentSection` | 투표 참여자 한 줄 코멘트 목록 |

---

## Phase 4 — 지도 (장소 선택)

**경로:** `src/app/(main)/map/`  
**기능 ID:** M-01 ~ M-05 (M-06 중간 지점, M-07 카톡 공유는 P1, 하지만 Phase 1에서는 목업)

### 컴포넌트
| 컴포넌트 | 설명 |
|---------|------|
| `KakaoMapProvider` | `next/script` afterInteractive. window.kakao 로딩 완료 확인 후 렌더. |
| `MapView` | 100% 너비, 고정 높이. 선택 마커: violet-600, 미선택: gray-400. |
| `RadiusOverlay` | 반투명 violet-100 fill + violet-300 stroke 원. |
| `RadiusSlider` | 500m~5km. 하단 시트 내부. |
| `CategoryFilterBar` | FD6(음식점)/CE7(카페)/SW8(지하철) 칩 필터. 가로 스크롤. |
| `PlaceCard` | 이름·평점·사진·거리 |
| `PlaceCardCarousel` | 지도 위 하단 고정 가로 스크롤 캐러셀 |

**Phase 1 범위:** 실제 Kakao API 연동 없음. 목업 places 데이터 + 정적 지도 렌더링.

---

## Phase 5 — 기록 (히스토리)

**경로:** `src/app/(main)/history/`  
**기능 ID:** R-01 ~ R-03, R-06, R-07 (R-04 사진 업로드, R-05 후기는 Phase 2)

### 컴포넌트
| 컴포넌트 | 설명 |
|---------|------|
| `TimelineView` | 좌측 수직선 gray-200 + 카드 목록, 최신순 |
| `MemoryCard` | 날짜·장소·참여자·대표 사진 (12px radius) |
| `StatsSummary` | "총 N번의 모임" — Instrument Serif Display(28px/700) |
| `MapMemoryView` | 방문 장소 핀 표시. 리스트/지도 토글. |

---

## 완료 기준

1. 각 화면 완료 시 `/design-check` 통과 (통과 전 다음 화면 진행 불가)
2. `pnpm typecheck && pnpm lint` 클린
3. 데모 플로우 끊김 없이 동작: 홈 → 친구 → 그룹 생성 → 투표 → 지도 → 기록
4. `docs/HANDOFF.md` 작성 (Phase 2 진입 전 필수)

---

## 제약 (CLAUDE.md 준수)

- 서버 컴포넌트 기본, 인터랙션 필요 시만 `"use client"`
- `any` 타입 금지
- 인라인 스타일 금지 — Tailwind 전용
- `useEffect` 데이터 페칭 금지
- 컴포넌트 파일 200줄 초과 금지
- 보라 그라데이션·글래스모피즘·Inter 폰트·20px+ border-radius 금지
