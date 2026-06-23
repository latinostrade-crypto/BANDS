import type { LeaderboardResponse, MeResponse, SyncSummary } from "@bands/shared";
import { tma } from "./tma";

const API_URL = import.meta.env.VITE_API_URL ?? "";

let sessionToken = localStorage.getItem("bands_session");

const authHeader = (): Record<string, string> => {
  const initData = tma.initData();
  if (initData) return { Authorization: `tma ${initData}` };
  if (sessionToken) return { Authorization: `Bearer ${sessionToken}` };
  return {};
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...authHeader(),
      ...(options.headers as Record<string, string> | undefined)
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 403) {
      sessionToken = null;
      localStorage.removeItem("bands_session");
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
      localStorage.removeItem("bands_session");
      throw new Error("Telegram auth data is missing. Open from the bot menu button, not as a regular link.");
    }
    const data = await request<{ token: string }>("/api/auth", { method: "POST" });
    sessionToken = data.token;
    localStorage.setItem("bands_session", data.token);
  },
  me: () => request<MeResponse>("/api/me"),
  sync: () => request<SyncSummary>("/api/profile/sync", { method: "POST" }),
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
    })
};
