export type UserProfile = {
  id: number;
  tgId: string;
  username: string | null;
  firstName: string | null;
  walletAddress: string | null;
  walletVerifiedAt: string | null;
  isQualified: boolean;
  isPremium: boolean;
  referrerId: number | null;
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

export type SyncStatus = "idle" | "running" | "done" | "failed";

export type SyncStartResponse = {
  status: "started";
  jobId: string;
  cooldownUntil: string | null;
};

export type SyncProgress = {
  status: SyncStatus;
  jobId: string | null;
  fetched: number;
  accepted: number;
  rejected: number;
  page: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
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

export type ChallengeMode = "tournament" | "influencer" | "santa" | "tasks";

export type Challenge = {
  id: number;
  mode: ChallengeMode;
  creatorType: string;
  creatorId: number | null;
  title: string;
  description: string | null;
  status: string;
  rewardPoints: number;
  rules: unknown;
  startsAt: string | null;
  endsAt: string | null;
};

export type ChallengeProposal = {
  id: number;
  title: string;
  description: string | null;
  creatorId: number | null;
  status: string;
  votesCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type ChallengesResponse = {
  challenges: Challenge[];
};

export type ChallengeProposalsResponse = {
  proposals: ChallengeProposal[];
};

export type ChallengeProposalResponse = {
  proposal: ChallengeProposal;
};

export type ChallengeVoteResponse = {
  ok: true;
  voteWeight: number;
  giftCount: number;
  votesCount: number;
};

export type ChallengeProgress = {
  challengeId: number;
  userId: number;
  progress: number;
  target: number;
  status: string;
  claimedAt: string | null;
};

export type ChallengeProgressResponse = {
  progress: ChallengeProgress;
};

export type ChallengeClaimResponse = {
  ok: true;
  points: number;
  status: string;
};

export type CpaTask = {
  id: number;
  title: string;
  description: string | null;
  rewardPoints: number;
  status: string;
  verificationType: string;
};

export type CpaTasksResponse = {
  tasks: CpaTask[];
};

export type CpaCompletionResponse = {
  completion: {
    taskId: number;
    userId: number;
    status: string;
    verifiedAt: string | null;
  };
};

export type SantaPoolResponse = {
  entriesCount: number;
  eligibleCount: number;
  pendingCount: number;
};

export type SantaEntryResponse = {
  entry: {
    id: number;
    userGiftId: number;
    status: string;
    floorPrice: string | null;
  };
};

export type AdminStatusResponse = {
  isAdmin: boolean;
  userId: number;
};

export type AdminTargetGift = {
  id: number;
  gift_id: string;
  base_name: string | null;
  weight: number;
  is_active: boolean;
};

export type AdminTargetGiftsResponse = {
  targetGifts: AdminTargetGift[];
};

export type AdminChallengesResponse = {
  challenges: unknown[];
};

export type AdminCpaTasksResponse = {
  tasks: unknown[];
};

export type AdminProposalsResponse = {
  proposals: unknown[];
};

export type DevPaymentResponse = {
  payment: {
    id: number;
    provider: string;
    purpose: string;
    amount: string;
    currency: string;
    status: string;
  };
};
