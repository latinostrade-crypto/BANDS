export type UserProfile = {
  id: number;
  tgId: string;
  username: string | null;
  firstName: string | null;
  walletAddress: string | null;
  walletVerifiedAt: string | null;
  isQualified: boolean;
  score: number;
  socialLikes: number;
};

export type UserGift = {
  id: number;
  giftId: string;
  baseName: string | null;
  uniqueName: string | null;
  uniqueNumber: number;
  modelName: string | null;
  symbolName: string | null;
  backdropName: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  scoreWeight: number;
};

export type SyncSummary = {
  found: number;
  accepted: number;
  rejected: number;
  cooldownUntil: string | null;
};

export type MeResponse = {
  user: UserProfile;
  gifts: UserGift[];
  lastSync: SyncSummary | null;
};

export type LeaderboardEntry = {
  userId: number;
  username: string | null;
  firstName: string | null;
  score: number;
  premiumVotes: number;
  socialLikes: number;
  isQualified: boolean;
};

export type LeaderboardResponse = {
  nftRace: LeaderboardEntry[];
  peoplesChoice: LeaderboardEntry[];
};

export type VoteType = "premium";

export type SyncedUniqueGift = {
  giftId: string;
  baseName?: string;
  uniqueName?: string;
  uniqueNumber: number;
  modelName?: string;
  symbolName?: string;
  backdropName?: string;
  imageFileId?: string;
  imageWidth?: number;
  imageHeight?: number;
  isBurned: boolean;
  isFromBlockchain: boolean;
  rawPayload: unknown;
};

export type WalletStatus = "not_connected" | "proof_pending" | "verified";
