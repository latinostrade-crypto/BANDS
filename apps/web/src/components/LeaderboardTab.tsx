import { Heart, Trophy, Vote } from "lucide-react";
import type { ReactNode } from "react";
import type { LeaderboardEntry, LeaderboardResponse } from "@bands/shared";

type Props = {
  leaderboard: LeaderboardResponse | null;
  mode: "nft" | "people";
  qualified: boolean;
  busyId: number | null;
  onMode: (mode: "nft" | "people") => void;
  onVote: (id: number) => void;
  onLike: (id: number) => void;
};

export function LeaderboardTab({ leaderboard, mode, qualified, busyId, onMode, onVote, onLike }: Props) {
  const rows = mode === "nft" ? leaderboard?.nftRace : leaderboard?.peoplesChoice;
  return (
    <div className="space-y-4">
      {/* Селектор режима */}
      <div className="grid grid-cols-2 rounded-xl bg-white/5 border border-white/5 p-1 backdrop-blur-md">
        <Segment active={mode === "nft"} onClick={() => onMode("nft")} icon={<Trophy size={14} />} label="NFT Гонка" />
        <Segment active={mode === "people"} onClick={() => onMode("people")} icon={<Heart size={14} />} label="Выбор народа" />
      </div>

      {/* Список участников */}
      <div className="space-y-2.5">
        {rows?.length ? (
          rows.map((entry, index) => (
            <Entry
              key={entry.userId}
              entry={entry}
              place={index + 1}
              mode={mode}
              qualified={qualified}
              busy={busyId === entry.userId}
              onVote={onVote}
              onLike={onLike}
            />
          ))
        ) : (
          <div className="rounded-2xl glass p-8 text-center text-xs text-tg-hint flex flex-col items-center justify-center gap-2 border border-dashed border-white/10">
            <Trophy size={28} className="text-white/20" />
            <span>Лидерборд пока пуст. Синхронизируйте подарки, чтобы попасть в рейтинг!</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Segment(props: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all duration-300 ${
        props.active 
          ? "bg-[#0098ea] text-white shadow-[0_2px_10px_rgba(0,152,234,0.3)] scale-[1.01]" 
          : "text-tg-hint hover:text-white"
      }`}
      onClick={props.onClick}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

function Entry({
  entry,
  place,
  mode,
  qualified,
  busy,
  onVote,
  onLike
}: {
  entry: LeaderboardEntry;
  place: number;
  mode: "nft" | "people";
  qualified: boolean;
  busy: boolean;
  onVote: (id: number) => void;
  onLike: (id: number) => void;
}) {
  const name = entry.username ? `@${entry.username}` : entry.firstName ?? `User ${entry.userId}`;
  const avatarInitials = entry.username 
    ? entry.username.slice(0, 2).toUpperCase() 
    : entry.firstName 
      ? entry.firstName.slice(0, 2).toUpperCase() 
      : "U";

  const isPodium = place <= 3;
  
  // Цветовая разметка для тройки лидеров
  const containerStyle = 
    place === 1 ? "border-[#f59e0b]/30 bg-gradient-to-r from-[#f59e0b]/5 to-[#f59e0b]/2 shadow-[0_0_15px_rgba(245,158,11,0.05)]" :
    place === 2 ? "border-[#94a3b8]/30 bg-gradient-to-r from-[#94a3b8]/5 to-[#94a3b8]/2 shadow-[0_0_15px_rgba(148,163,184,0.05)]" :
    place === 3 ? "border-[#b45309]/30 bg-gradient-to-r from-[#b45309]/5 to-[#b45309]/2 shadow-[0_0_15px_rgba(180,83,9,0.05)]" :
    "border-white/5 bg-white/2";

  const rankBadgeStyle = 
    place === 1 ? "bg-gradient-to-tr from-amber-400 to-yellow-500 text-[#080a10] shadow-[0_0_10px_rgba(245,158,11,0.4)]" :
    place === 2 ? "bg-gradient-to-tr from-slate-300 to-slate-400 text-[#080a10] shadow-[0_0_10px_rgba(148,163,184,0.4)]" :
    place === 3 ? "bg-gradient-to-tr from-amber-600 to-amber-700 text-white shadow-[0_0_10px_rgba(180,83,9,0.4)]" :
    "bg-white/5 text-tg-hint border border-white/5";

  return (
    <article className={`rounded-2xl border p-4 flex items-center justify-between gap-3 animate-fade-in-up relative overflow-hidden ${containerStyle}`}>
      <div className="flex items-center gap-3 min-w-0">
        {/* Номер места */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 font-mono ${rankBadgeStyle}`}>
          {place}
        </div>
        
        {/* Аватар по умолчанию */}
        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-xs text-tg-hint font-bold font-mono shrink-0">
          {avatarInitials}
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-bold text-sm text-white">{name}</h3>
          <p className="mt-1 text-[10px] text-tg-hint leading-none flex flex-wrap gap-x-2.5 gap-y-1">
            <span>Очки: <span className="text-white font-bold font-mono">{entry.score}</span></span>
            <span>Голоса: <span className="text-white font-bold font-mono">{entry.premiumVotes}</span></span>
            <span>Лайки: <span className="text-white font-bold font-mono">{entry.socialLikes}</span></span>
          </p>
        </div>
      </div>

      <div>
        {mode === "nft" ? (
          <button
            className="flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0098ea] to-[#00b4d8] px-3.5 text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
            disabled={!qualified || busy}
            onClick={() => onVote(entry.userId)}
            title={qualified ? "Голосовать за участника" : "Требуется верификация подарков"}
          >
            <Vote size={13} className={busy ? "animate-pulse" : ""} />
            Голос
          </button>
        ) : (
          <button
            className="flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 px-3.5 text-xs font-bold text-white active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
            disabled={busy}
            onClick={() => onLike(entry.userId)}
          >
            <Heart size={13} className={busy ? "animate-pulse text-red-400" : ""} />
            Лайк
          </button>
        )}
      </div>
    </article>
  );
}

