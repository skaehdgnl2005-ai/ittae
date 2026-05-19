# Revert Kakao SDK Share — Normalize Link Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore link-sharing functionality by replacing the Kakao Share SDK rich-card flow (which fails domain verification with error 4019) with `navigator.share` + clipboard fallback.

**Architecture:** Surgical fix to `src/lib/share.ts` only. The two share functions (`shareInviteLink`, `shareGroupLink`) drop the `Kakao.Share.sendDefault` branch and instead try `navigator.share` first, falling back to clipboard. No callers' signatures change. Map page's `KakaoShareButton` and the global `KakaoSdkInitializer` mount stay untouched so unrelated surfaces are not impacted.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Web Share API.

**Scope policy:**
- Touch only `src/lib/share.ts`.
- Do NOT modify `layout.tsx`, `KakaoSdkInitializer.tsx`, `KakaoShareButton.tsx`, `GroupDetailClient.tsx`, or `AddFriendSheet.tsx`. Their public contracts (ShareResult union, function signatures) remain identical, so callers keep working unchanged.
- Kakao SDK keeps loading (still mounted in layout) — only the consumption inside `share.ts` switches to `navigator.share`. This guarantees zero regression for the map share button and any future SDK uses.

**Origin of bug:** Commit `84ca9663` (2026-05-14) introduced `Kakao.Share.sendDefault` calls in `shareInviteLink` and `shareGroupLink`. Kakao server validates the calling origin against domains registered in Kakao Developer Console — error code 4019 means the origin isn't whitelisted for this JS key's app. Until domain registration is sorted out (separate config task), we revert to a transport that doesn't require Kakao verification.

---

### Task 1: Replace Kakao SDK branches with navigator.share in `src/lib/share.ts`

**Files:**
- Modify: `src/lib/share.ts` (full rewrite — file is 115 lines, replaces both share functions)

- [ ] **Step 1: Rewrite `src/lib/share.ts`**

Replace the entire file with:

```typescript
// src/lib/share.ts
"use client";

export type ShareResult = "shared" | "clipboard" | "failed";

type ShareArgs = {
  url: string;
  title: string;
  text: string;
};

async function tryShare({ url, title, text }: ShareArgs): Promise<ShareResult> {
  // 1. Web Share API — opens the OS native share sheet (mobile: KakaoTalk, iMessage, etc.)
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      // User cancelled the share sheet — treat as a successful "opened" outcome.
      // Do NOT fall through to clipboard, which would silently overwrite their clipboard.
      if (e instanceof DOMException && e.name === "AbortError") {
        return "shared";
      }
      console.warn("[share] navigator.share 실패, 클립보드 폴백", e);
    }
  }

  // 2. Clipboard fallback (desktop, in-app browsers without Web Share, etc.)
  try {
    await navigator.clipboard.writeText(url);
    return "clipboard";
  } catch (e) {
    console.error("[share] 클립보드 실패", e);
    return "failed";
  }
}

export async function shareInviteLink(args: {
  url: string;
  hostNickname: string;
}): Promise<ShareResult> {
  return tryShare({
    url: args.url,
    title: `${args.hostNickname}님이 된다에 초대했어요`,
    text: "친구 추가하고 같이 모임을 잡아보세요",
  });
}

export async function shareGroupLink(args: {
  url: string;
  groupName: string;
  status: string;
  confirmedDate?: string | null;
  confirmedStartTime?: string | null;
  confirmedEndTime?: string | null;
}): Promise<ShareResult> {
  const isVoting = args.status === "voting";
  const title = isVoting
    ? `${args.groupName} 투표가 도착했어요`
    : `${args.groupName} 일정이 확정됐어요`;

  let text: string;
  if (isVoting) {
    text = "가능한 시간을 골라주세요";
  } else if (
    args.confirmedDate &&
    args.confirmedStartTime &&
    args.confirmedEndTime
  ) {
    text = `${args.confirmedDate} ${args.confirmedStartTime}~${args.confirmedEndTime}`;
  } else {
    text = "확정된 일정을 확인하세요";
  }

  return tryShare({ url: args.url, title, text });
}
```

Notes:
- `ShareResult` literal `"kakao"` is renamed to `"shared"` — this is the only API surface change. Callers in `AddFriendSheet.tsx:73` and `GroupDetailClient.tsx:157` check this string. Step 2 handles that.
- `navigator.share` doesn't need feature flag — `typeof navigator.share === "function"` is a runtime guard. On unsupported environments (some desktop browsers, server-side render passes), it falls through to clipboard automatically.
- AbortError must be caught explicitly — otherwise cancelling the share sheet would copy URL silently.

- [ ] **Step 2: Verify both callers handle the renamed `"shared"` result**

The `ShareResult` union changes from `"kakao" | "clipboard" | "failed"` to `"shared" | "clipboard" | "failed"`. TypeScript will surface this at:

- `src/components/friends/AddFriendSheet.tsx:73-77` — `r === "kakao"` check
- `src/app/group/[id]/GroupDetailClient.tsx:157` — `if (r === "kakao")` check

Both callers must be updated to compare against `"shared"`. Apply these edits:

`src/components/friends/AddFriendSheet.tsx` lines 73-77, change:

```typescript
setShareToast(
  r === "kakao" ? "카카오톡 공유 창을 열었어요"
    : r === "clipboard" ? "초대 링크를 복사했어요"
    : "공유에 실패했어요"
);
```

to:

```typescript
setShareToast(
  r === "shared" ? "공유 시트를 열었어요"
    : r === "clipboard" ? "초대 링크를 복사했어요"
    : "공유에 실패했어요"
);
```

`src/app/group/[id]/GroupDetailClient.tsx` lines 157-163, change:

```typescript
if (r === "kakao") {
  toast.success("카카오톡 공유 창을 열었어요");
} else if (r === "clipboard") {
  toast.success("링크가 복사되었어요!");
} else {
  toast.error("공유에 실패했어요");
}
```

to:

```typescript
if (r === "shared") {
  toast.success("공유 시트를 열었어요");
} else if (r === "clipboard") {
  toast.success("링크가 복사되었어요!");
} else {
  toast.error("공유에 실패했어요");
}
```

Rationale for new toast text: "공유 시트를 열었어요" is accurate whether the user picks KakaoTalk, iMessage, or another app from the OS sheet. The previous "카카오톡" wording would be a lie on iMessage etc.

- [ ] **Step 3: Run typecheck to confirm no type errors remain**

```bash
pnpm typecheck
```

Expected: PASS (no errors).

- [ ] **Step 4: Run lint**

```bash
pnpm lint
```

Expected: PASS (no errors).

- [ ] **Step 5: Run build to confirm Next.js bundles cleanly**

```bash
pnpm build
```

Expected: build succeeds; no "Type error" or "Module not found".

- [ ] **Step 6: Commit**

```bash
git add src/lib/share.ts src/components/friends/AddFriendSheet.tsx src/app/group/[id]/GroupDetailClient.tsx docs/superpowers/plans/2026-05-19-revert-kakao-sdk-share.md
git commit -m "$(cat <<'EOF'
fix(share): Kakao SDK rich-card 보류, navigator.share + 클립보드로 전환

84ca9663에서 도입한 Kakao.Share.sendDefault가 sharer.kakao.com에서
4019(도메인 미등록) 에러로 실패. 카카오 콘솔 [제품 링크 관리] 정비가
선결돼야 하므로 일단 rich-card 흐름을 보류하고, navigator.share →
clipboard 순으로 폴백하는 OS 네이티브 공유로 전환한다.

- src/lib/share.ts: 두 함수 모두 navigator.share 1차/clipboard 폴백
- ShareResult: "kakao" → "shared" 리네임 (의미 정확화)
- 호출부 두 곳 토스트 문구 "카카오톡 공유 창" → "공유 시트"
- KakaoSdkInitializer/KakaoShareButton(/map)은 의도적으로 미수정 —
  지도 장소 공유는 별도 surface로 추후 일괄 정리

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Deploy to Vercel production

- [ ] **Step 1: Confirm working tree clean except for commit just made**

```bash
git status
```

Expected: branch ahead of origin by N commits, no uncommitted modifications to files in Task 1.

- [ ] **Step 2: Run vercel CLI deploy to production**

```bash
vercel --prod --yes
```

Expected: deploy succeeds, ends with `Production: https://<...>.vercel.app` URL printed.

- [ ] **Step 3: Smoke test deployed URL**

Open the printed production URL in a browser, navigate to any group, tap the share button:
- Mobile: OS share sheet should open (no sharer.kakao.com error).
- Desktop browser with no Web Share support: link copies to clipboard, toast "링크가 복사되었어요!" appears.

If error 4019 appears again — the fix did not deploy or stale build was served. Re-run deploy and verify the bundle hash changed.

---

## Out-of-scope (deliberately NOT changed)

- `src/components/KakaoSdkInitializer.tsx` — left mounted in layout. Map share still uses Kakao SDK.
- `src/components/map/KakaoShareButton.tsx` — has same 4019 issue but is a separate surface; user did not request map-share fix this round.
- Kakao Developer Console domain registration — config task for user, unrelated to code.
- OG metadata / `og-invite.png` — separate concern; navigator.share uses the destination page's OG tags directly, which are already wired up (commits 50b76278, 705bff87).

## Self-Review

**Spec coverage:**
- "find the work that introduced the bug" → commit 84ca9663 identified in plan header ✓
- "shelve the Kakao text feature" → SDK branches removed from share.ts, but `KakaoSdkInitializer` left mounted so unrelated map share unaffected ✓
- "normalize link sharing" → navigator.share + clipboard fallback path is the new normal ✓
- "don't break elsewhere" → out-of-scope section enumerates untouched surfaces ✓
- "deploy via vercel CLI" → Task 2 explicit ✓

**Placeholder scan:** No "TBD", "handle errors appropriately", or "similar to above". All code blocks are complete. ✓

**Type consistency:** `ShareResult` rename `"kakao"` → `"shared"` is propagated through both caller files. `tryShare` private helper signature consistent across both public functions. ✓
