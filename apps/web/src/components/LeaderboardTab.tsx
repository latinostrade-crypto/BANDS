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
      <div className="grid grid-cols-2 rounded-lg bg-tg-secondary p-1">
        <Segment active={mode === "nft"} onClick={() => onMode("nft")} icon={<Trophy size={16} />} label="NFT Race" />
        <Segment active={mode === "people"} onClick={() => onMode("people")} icon={<Heart size={16} />} label="People" />
      </div>

      <div className="space-y-3">
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
          <div className="rounded-lg bg-tg-secondary p-4 text-sm text-tg-hint">Лидерборд пока пуст.</div>
        )}
      </div>
    </div>
  );
}

function Segment(props: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold ${
        props.active ? "bg-tg-button text-tg-buttonText" : "text-tg-hint"
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
  return (
    <article className="rounded-lg bg-tg-secondary p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 text-lg font-semibold">#{place}</span>
            <h3 className="truncate font-semibold">{name}</h3>
          </div>
          <p className="mt-1 text-sm text-tg-hint">
            Score {entry.score} / votes {entry.premiumVotes} / likes {entry.socialLikes}
          </p>
        </div>
        {mode === "nft" ? (
          <button
            className="flex h-10 min-w-20 items-center justify-center gap-1 rounded-lg bg-tg-button px-3 text-sm font-semibold text-tg-buttonText disabled:opacity-40"
            disabled={!qualified || busy}
            onClick={() => onVote(entry.userId)}
            title={qualified ? "Vote" : "Only qualified users can vote"}
          >
            <Vote size={15} />
            Vote
          </button>
        ) : (
          <button
            className="flex h-10 min-w-20 items-center justify-center gap-1 rounded-lg bg-white/10 px-3 text-sm font-semibold disabled:opacity-40"
            disabled={busy}
            onClick={() => onLike(entry.userId)}
          >
            <Heart size={15} />
            Like
          </button>
        )}
      </div>
    </article>
  );
}
