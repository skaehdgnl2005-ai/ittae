export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

export function generateInviteCode(): string {
  let result = "";
  for (let i = 0; i < LENGTH; i++) {
    const idx = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    result += INVITE_CODE_ALPHABET[idx];
  }
  return result;
}
