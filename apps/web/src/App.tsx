import { BarChart3, User, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { LeaderboardResponse, MeResponse, SyncSummary } from "@bands/shared";
import { LeaderboardTab } from "./components/LeaderboardTab";
import { ProfileTab } from "./components/ProfileTab";
import { WalletTab } from "./components/WalletTab";
import { api } from "./lib/api";
import { tma } from "./lib/tma";

type Tab = "profile" | "leaderboard" | "wallet";

export function App() {
  const [tab, setTab] = useState<Tab>("profile");
  const [leaderboardMode, setLeaderboardMode] = useState<"nft" | "people">("nft");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const [profile, board] = await Promise.all([api.me(), api.leaderboard()]);
    setMe(profile);
    setLeaderboard(board);
  };

  useEffect(() => {
    tma.init();
    api
      .auth()
      .then(refresh)
      .catch((err) => setError(err instanceof Error ? err.message : "Authorization failed"));
  }, []);

  const selectTab = (next: Tab) => {
    tma.impact();
    setTab(next);
  };

  const sync = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await api.sync();
      setSyncSummary(summary);
      await refresh();
      tma.success();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      tma.error();
    } finally {
      setLoading(false);
    }
  };

  const vote = async (candidateId: number) => {
    setBusyId(candidateId);
    try {
      await api.vote(candidateId);
      await refresh();
      tma.impact();
    } finally {
      setBusyId(null);
    }
  };

  const like = async (candidateId: number) => {
    setBusyId(candidateId);
    try {
      await api.like(candidateId);
      await refresh();
      tma.impact();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-4 text-tg-text">
      {tab === "profile" ? (
        <ProfileTab me={me} syncSummary={syncSummary} loading={loading} error={error} onSync={sync} />
      ) : null}
      {tab === "leaderboard" ? (
        <LeaderboardTab
          leaderboard={leaderboard}
          mode={leaderboardMode}
          qualified={Boolean(me?.user.isQualified)}
          busyId={busyId}
          onMode={(mode) => {
            setLeaderboardMode(mode);
            tma.impact();
          }}
          onVote={vote}
          onLike={like}
        />
      ) : null}
      {tab === "wallet" ? <WalletTab verifiedAddress={me?.user.walletAddress ?? null} /> : null}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-white/10 bg-tg-bg/95 px-4 pt-2 backdrop-blur">
        <div className="grid grid-cols-3 gap-2">
          <TabButton active={tab === "profile"} onClick={() => selectTab("profile")} icon={<User size={19} />} label="Профиль" />
          <TabButton active={tab === "leaderboard"} onClick={() => selectTab("leaderboard")} icon={<BarChart3 size={19} />} label="Рейтинг" />
          <TabButton active={tab === "wallet"} onClick={() => selectTab("wallet")} icon={<Wallet size={19} />} label="Wallet" />
        </div>
      </nav>
    </main>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={props.onClick}
      className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-xs ${
        props.active ? "bg-tg-button text-tg-buttonText" : "text-tg-hint"
      }`}
    >
      {props.icon}
      {props.label}
    </button>
  );
}
