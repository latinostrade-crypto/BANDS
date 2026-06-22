import { Gift, RefreshCw, ShieldCheck } from "lucide-react";
import type { MeResponse, SyncSummary } from "@bands/shared";

type Props = {
  me: MeResponse | null;
  syncSummary: SyncSummary | null;
  loading: boolean;
  error: string | null;
  onSync: () => void;
};

export function ProfileTab({ me, syncSummary, loading, error, onSync }: Props) {
  const user = me?.user;
  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-tg-secondary p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-tg-hint">Профиль</p>
            <h1 className="mt-1 text-2xl font-semibold">
              {user?.username ? `@${user.username}` : user?.firstName ?? "Telegram user"}
            </h1>
          </div>
          <span className="rounded-full bg-black/20 px-3 py-1 text-sm text-tg-hint">
            ID {user?.tgId ?? "..."}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Score" value={user?.score ?? 0} />
          <Metric label="Likes" value={user?.socialLikes ?? 0} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <ShieldCheck size={18} className={user?.isQualified ? "text-emerald-400" : "text-tg-hint"} />
          {user?.isQualified ? "Qualified for premium votes" : "Sync target gifts to qualify"}
        </div>
      </section>

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-tg-button px-4 font-semibold text-tg-buttonText disabled:opacity-60"
        onClick={onSync}
        disabled={loading}
      >
        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        Синхронизировать подарки
      </button>

      {error ? <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}

      {syncSummary ? (
        <section className="rounded-lg bg-tg-secondary p-4">
          <p className="text-sm text-tg-hint">Последняя синхронизация</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Found" value={syncSummary.found} />
            <Metric label="Accepted" value={syncSummary.accepted} />
            <Metric label="Rejected" value={syncSummary.rejected} />
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Gift size={18} />
          <h2 className="font-semibold">Засчитанные unique gifts</h2>
        </div>
        <div className="space-y-3">
          {me?.gifts.length ? (
            me.gifts.map((gift) => (
              <article key={gift.id} className="rounded-lg bg-tg-secondary p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{gift.baseName ?? gift.giftId}</h3>
                    <p className="text-sm text-tg-hint">
                      #{gift.uniqueNumber} {gift.uniqueName ? `- ${gift.uniqueName}` : ""}
                    </p>
                  </div>
                  <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-sm text-emerald-200">
                    +{gift.scoreWeight}
                  </span>
                </div>
                <p className="mt-3 text-sm text-tg-hint">
                  {[gift.modelName, gift.symbolName, gift.backdropName].filter(Boolean).join(" / ") || "No traits"}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-lg bg-tg-secondary p-4 text-sm text-tg-hint">
              Пока нет засчитанных подарков.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/20 p-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-tg-hint">{label}</div>
    </div>
  );
}
