// 시각적 모호 문자(0/O/1/I) 제외한 32자 알파벳.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}
