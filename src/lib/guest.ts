"use client";

const TOKEN_KEY = (groupId: string) => `guest-token:${groupId}`;
const NICK_KEY = (groupId: string) => `guest-nick:${groupId}`;

export function getGuestToken(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY(groupId));
}

export function setGuestToken(groupId: string, token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY(groupId), token);
}

export function getGuestNickname(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NICK_KEY(groupId));
}

export function setGuestNickname(groupId: string, nickname: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NICK_KEY(groupId), nickname);
}

export function generateBrowserToken(): string {
  return crypto.randomUUID();
}
