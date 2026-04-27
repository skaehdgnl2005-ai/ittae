import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildGoogleConsentUrl } from "@/lib/google/oauth";

export async function GET() {
  const state = randomBytes(32).toString("hex");
  const url = buildGoogleConsentUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
