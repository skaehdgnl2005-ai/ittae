import { signInWithGoogle, signInWithKakao } from "./actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  const hasOAuthLeak =
    typeof params.code === "string" ||
    typeof params.access_token === "string" ||
    typeof params.error_description === "string";

  if (Object.keys(params).length > 0) {
    console.warn("[login] arrived with query params:", params);
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      {hasOAuthLeak ? (
        <div className="w-full max-w-sm mb-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 px-4 py-3">
          <p className="text-[13px] text-amber-800 dark:text-amber-200 font-medium">
            OAuth 콜백이 잘못된 경로로 도착했어요
          </p>
          <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-300 break-all">
            URL에 {typeof params.code === "string" ? "code" : "access_token"}{" "}
            파라미터가 붙은 채 /login에 도달했습니다 → Supabase Site URL이
            잘못 설정됐거나 Redirect URL allow-list에 /auth/callback이 빠진 상태
          </p>
        </div>
      ) : null}
      {error ? (
        <div className="w-full max-w-sm mb-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 px-4 py-3">
          <p className="text-[13px] text-red-700 dark:text-red-300 font-medium">
            로그인에 실패했어요
          </p>
          <p className="mt-1 text-[12px] text-red-600 dark:text-red-400 break-all">
            {error}
            {reason ? ` · ${reason}` : ""}
          </p>
        </div>
      ) : null}
      {/* 앱 아이덴티티 */}
      <div className="text-center mb-14">
        <h1 className="font-serif text-[56px] leading-none text-gray-900 dark:text-gray-50 mb-4">
          된다
        </h1>
        <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed">
          친구들과 일정을 맞추고
          <br />
          장소를 고르는 소셜 스케줄링
        </p>
      </div>

      {/* 소셜 로그인 버튼 */}
      <div className="w-full max-w-sm space-y-3">
        <form action={signInWithGoogle}>
          <button
            type="submit"
            aria-label="Google로 로그인"
            className="w-full h-[52px] flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-[15px] font-medium transition-colors active:bg-gray-50 dark:active:bg-gray-700"
          >
            <GoogleIcon />
            Google로 로그인
          </button>
        </form>

        <form action={signInWithKakao}>
          <button
            type="submit"
            aria-label="카카오로 로그인"
            className="w-full h-[52px] flex items-center justify-center gap-3 rounded-xl bg-[#FEE500] text-[#191919] text-[15px] font-medium transition-colors active:bg-[#F0D800]"
          >
            <KakaoIcon />
            카카오로 로그인
          </button>
        </form>
      </div>

      <p className="mt-10 text-xs text-gray-400 dark:text-gray-600 text-center leading-relaxed">
        로그인 시 서비스 이용약관 및
        <br />
        개인정보 처리방침에 동의합니다.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg
      width="18"
      height="17"
      viewBox="0 0 18 17"
      aria-hidden="true"
      focusable="false"
      fill="#191919"
    >
      <path d="M9 0C4.03 0 0 3.13 0 7c0 2.49 1.63 4.67 4.09 5.93L3.1 16.1c-.08.3.23.54.5.37L8.1 13.9c.3.03.6.04.9.04 4.97 0 9-3.13 9-7S13.97 0 9 0z" />
    </svg>
  );
}
