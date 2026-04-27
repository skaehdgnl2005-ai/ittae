export const ROUTES = {
  HOME: "/home",
  LOGIN: "/login",
  AUTH_CALLBACK: "/auth/callback",
  PROFILE_SETUP: "/profile/setup",
} as const;

export const PUBLIC_PATHS = [ROUTES.LOGIN, "/auth"] as const;
