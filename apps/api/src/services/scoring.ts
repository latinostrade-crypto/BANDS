export const calculateVoteWeight = (giftCount: number) => 1 + Math.floor(Math.max(giftCount, 0) / 10);

export const referralBonusPoints = (isPremium: boolean) => (isPremium ? 150 : 50);

export const isReferralQualified = (giftCount: number) => giftCount >= 3;
