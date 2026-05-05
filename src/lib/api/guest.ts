"use client";

export async function guestFetch(
  url: string,
  options: RequestInit & { token: string }
): Promise<Response> {
  const { token, headers, ...rest } = options;
  return fetch(url, {
    ...rest,
    headers: {
      ...(headers ?? {}),
      "Content-Type": "application/json",
      "x-guest-token": token,
    },
  });
}
