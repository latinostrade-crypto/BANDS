import type {
  AdminChallengesResponse,
  AdminCpaTasksResponse,
  AdminProposalsResponse,
  AdminStatusResponse,
  AdminTargetGiftsResponse,
  ChallengeClaimResponse,
  ChallengeProgressResponse,
  ChallengeProposalsResponse,
  ChallengeProposalResponse,
  ChallengeVoteResponse,
  ChallengesResponse,
  CpaCompletionResponse,
  CpaTasksResponse,
  DevPaymentResponse,
  LeaderboardResponse,
  MeResponse,
  SantaEntryResponse,
  SantaPoolResponse,
  SyncProgress,
  SyncStartResponse
} from "@bands/shared";
import { tma } from "./tma";

const API_URL = import.meta.env.VITE_API_URL ?? "";

let sessionToken = sessionStorage.getItem("bands_session");

const missingTelegramAuthMessage =
  "Telegram auth data is missing. Open from the bot menu button, not as a regular link.";

const authHeader = (): Record<string, string> => {
  const initData = tma.initData();
  if (initData) return { Authorization: `tma ${initData}` };
  if (sessionToken) return { Authorization: `Bearer ${sessionToken}` };
  return {};
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...authHeader(),
    ...(options.headers as Record<string, string> | undefined)
  };
  if (path !== "/api/auth" && !headers.Authorization) {
    throw new Error(missingTelegramAuthMessage);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 403 && data?.error?.code !== "admin_required") {
      sessionToken = null;
      sessionStorage.removeItem("bands_session");
    }
    const message = data?.error?.message ?? "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  async auth() {
    if (!tma.initData()) {
      sessionToken = null;
      sessionStorage.removeItem("bands_session");
      throw new Error(missingTelegramAuthMessage);
    }
    const data = await request<{ token: string }>("/api/auth", { method: "POST" });
    sessionToken = data.token;
    sessionStorage.setItem("bands_session", data.token);
  },
  me: () => request<MeResponse>("/api/me"),
  sync: () => request<SyncStartResponse>("/api/profile/sync", { method: "POST" }),
  syncProgress: () => request<SyncProgress>("/api/profile/sync/progress"),
  challenges: (mode?: string) =>
    request<ChallengesResponse>(mode ? `/api/challenges?mode=${encodeURIComponent(mode)}` : "/api/challenges"),
  challengeProposals: () => request<ChallengeProposalsResponse>("/api/challenges/proposals"),
  createChallengeProposal: (body: { title: string; description?: string | null }) =>
    request<ChallengeProposalResponse>("/api/challenges/proposals", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  createDevPayment: (body: { purpose: "challenge_vote" | "paid_sync" | "santa_entry" | "boost"; amount?: number; currency?: "TON" | "STARS"; metadata?: Record<string, unknown> }) =>
    request<DevPaymentResponse>("/api/payments/dev-confirmed", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  challengeVote: (proposalId: number, paymentId: number) =>
    request<ChallengeVoteResponse>("/api/challenges/vote", {
      method: "POST",
      body: JSON.stringify({ proposalId, paymentId })
    }),
  challengeProgress: (challengeId: number) => request<ChallengeProgressResponse>(`/api/challenges/${challengeId}/progress`),
  claimChallenge: (challengeId: number) =>
    request<ChallengeClaimResponse>(`/api/challenges/${challengeId}/claim`, { method: "POST" }),
  tasks: () => request<CpaTasksResponse>("/api/tasks"),
  completeTask: (taskId: number) => request<CpaCompletionResponse>(`/api/tasks/${taskId}/complete`, { method: "POST" }),
  santaPool: () => request<SantaPoolResponse>("/api/santa/pool"),
  santaEntry: (userGiftId: number, paymentId: number) =>
    request<SantaEntryResponse>("/api/santa/entries", {
      method: "POST",
      body: JSON.stringify({ userGiftId, paymentId })
    }),
  leaderboard: () => request<LeaderboardResponse>("/api/leaderboard"),
  vote: (candidateId: number) =>
    request("/api/vote", {
      method: "POST",
      body: JSON.stringify({ candidateId, voteType: "premium" })
    }),
  like: (candidateId: number) =>
    request("/api/social-like", {
      method: "POST",
      body: JSON.stringify({ candidateId })
    }),
  proofPayload: () =>
    request<{ payload: string; expiresAt: string }>("/api/wallet/proof-payload", {
      method: "POST"
    }),
  verifyWallet: (body: unknown) =>
    request<{ ok: boolean; walletAddress: string }>("/api/wallet/verify", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  adminStatus: () => request<AdminStatusResponse>("/api/admin/status"),
  adminTargetGifts: () => request<AdminTargetGiftsResponse>("/api/admin/target-gifts"),
  adminUpsertTargetGift: (body: { giftId: string; baseName?: string | null; weight: number; isActive?: boolean }) =>
    request("/api/admin/target-gifts", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  adminChallenges: () => request<AdminChallengesResponse>("/api/admin/challenges"),
  adminUpsertChallenge: (body: unknown) =>
    request("/api/admin/challenges", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  adminCpaTasks: () => request<AdminCpaTasksResponse>("/api/admin/cpa-tasks"),
  adminUpsertCpaTask: (body: unknown) =>
    request("/api/admin/cpa-tasks", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  adminProposals: () => request<AdminProposalsResponse>("/api/admin/proposals"),
  adminSetProposalStatus: (id: number, status: "open" | "selected" | "rejected" | "archived") =>
    request(`/api/admin/proposals/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    })
};
