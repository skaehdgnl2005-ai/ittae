import { describe, it, expect } from "vitest";
import { generateInviteCode, INVITE_CODE_ALPHABET } from "../invite-code";

describe("generateInviteCode", () => {
  it("6자 길이를 반환한다", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("허용 알파벳 외 글자가 들어 있지 않다", () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateInviteCode();
      for (const ch of code) {
        expect(INVITE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("혼동 글자(0/O/1/I/L)를 포함하지 않는다", () => {
    const banned = ["0", "O", "1", "I", "L"];
    for (const ch of banned) {
      expect(INVITE_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("매번 동일한 값을 반환하지 않는다 (충돌 가능성 무시 가능 수준)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateInviteCode());
    expect(set.size).toBeGreaterThan(90);
  });
});
