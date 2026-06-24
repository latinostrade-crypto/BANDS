import { describe, expect, it } from "vitest";
import { calculateVoteWeight, isReferralQualified, referralBonusPoints } from "./scoring.js";

describe("scoring", () => {
  it("calculates hold-to-vote weight from gift count", () => {
    expect(calculateVoteWeight(0)).toBe(1);
    expect(calculateVoteWeight(9)).toBe(1);
    expect(calculateVoteWeight(10)).toBe(2);
    expect(calculateVoteWeight(3000)).toBe(301);
  });

  it("does not allow negative gift counts to reduce vote weight", () => {
    expect(calculateVoteWeight(-10)).toBe(1);
  });

  it("calculates referral qualification and bonus points", () => {
    expect(isReferralQualified(2)).toBe(false);
    expect(isReferralQualified(3)).toBe(true);
    expect(referralBonusPoints(false)).toBe(50);
    expect(referralBonusPoints(true)).toBe(150);
  });
});
