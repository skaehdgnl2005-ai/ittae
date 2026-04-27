export const ROUTES = {
  HOME: "/home",
  LOGIN: "/login",
  AUTH_CALLBACK: "/auth/callback",
  AUTH_CALLBACK_KAKAO: "/auth/callback/kakao",
  PROFILE_SETUP: "/profile/setup",
  INVITE: (code: string) => `/i/${code}`,
} as const;

export const PUBLIC_PATHS = [ROUTES.LOGIN, "/auth"] as const;
