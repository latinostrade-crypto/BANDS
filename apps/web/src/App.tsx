import { BarChart3, Shield, Trophy, User, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { LeaderboardResponse, MeResponse, SyncProgress } from "@bands/shared";
import { AdminTab } from "./components/AdminTab";
import { ChallengesTab } from "./components/ChallengesTab";
import { LeaderboardTab } from "./components/LeaderboardTab";
import { ProfileTab } from "./components/ProfileTab";
import { WalletTab } from "./components/WalletTab";
import { api } from "./lib/api";
import { tma } from "./lib/tma";

type Tab = "profile" | "challenges" | "leaderboard" | "wallet" | "admin";

export function App() {
  const [tab, setTab] = useState<Tab>("profile");
  const [leaderboardMode, setLeaderboardMode] = useState<"nft" | "people">("nft");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const refresh = async () => {
    const [profile, board] = await Promise.all([api.me(), api.leaderboard()]);
    setMe(profile);
    setLeaderboard(board);
  };

  useEffect(() => {
    tma.init();
    api
      .auth()
      .then(async () => {
        await refresh();
        api.adminStatus().then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
      })
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
      await api.sync();
      const poll = async () => {
        const progress = await api.syncProgress();
        setSyncProgress(progress);
        if (progress.status === "done" || progress.status === "failed") {
          await refresh();
          setLoading(false);
          if (progress.status === "done") tma.success();
          else tma.error();
          return;
        }
        window.setTimeout(poll, 2000);
      };
      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      tma.error();
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
    <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-4 text-tg-text animate-fade-in-up">
      {tab === "profile" ? (
        <ProfileTab me={me} syncProgress={syncProgress} loading={loading} error={error} onSync={sync} />
      ) : null}
      {tab === "challenges" ? <ChallengesTab /> : null}
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
      {tab === "admin" && isAdmin ? <AdminTab /> : null}

      <nav className="safe-bottom fixed inset-x-0 bottom-4 mx-auto max-w-[calc(100%-2rem)] md:max-w-md rounded-2xl border border-white/10 bg-[#161a26]/90 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] px-4 py-2 backdrop-blur-md z-50">
        <div className={`grid ${isAdmin ? "grid-cols-5" : "grid-cols-4"} gap-1`}>
          <TabButton active={tab === "profile"} onClick={() => selectTab("profile")} icon={<User size={18} />} label="Профиль" />
          <TabButton active={tab === "challenges"} onClick={() => selectTab("challenges")} icon={<Trophy size={18} />} label="Квесты" />
          <TabButton active={tab === "leaderboard"} onClick={() => selectTab("leaderboard")} icon={<BarChart3 size={18} />} label="Рейтинг" />
          <TabButton active={tab === "wallet"} onClick={() => selectTab("wallet")} icon={<Wallet size={18} />} label="Кошелек" />
          {isAdmin ? <TabButton active={tab === "admin"} onClick={() => selectTab("admin")} icon={<Shield size={18} />} label="Админ" /> : null}
        </div>
      </nav>
    </main>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={props.onClick}
      className={`flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-all duration-300 relative overflow-hidden ${
        props.active 
          ? "text-[#0098ea] bg-white/5 shadow-inner scale-105" 
          : "text-tg-hint hover:text-white"
      }`}
    >
      <span className={`transition-transform duration-300 ${props.active ? "scale-110" : "scale-100"}`}>
        {props.icon}
      </span>
      <span>{props.label}</span>
      {props.active && (
        <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#0098ea] shadow-[0_0_8px_#0098ea]" />
      )}
    </button>
  );
}
