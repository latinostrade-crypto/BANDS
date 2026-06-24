import { Gift, RefreshCw, ShieldCheck, Trophy, Heart, ShieldAlert, Award } from "lucide-react";
import type { MeResponse, SyncProgress } from "@bands/shared";
import type { ReactNode } from "react";
import { tma } from "../lib/tma";

type Props = {
  me: MeResponse | null;
  syncProgress: SyncProgress | null;
  loading: boolean;
  error: string | null;
  onSync: () => void;
};

function getBackdropColor(name: string | null | undefined): string {
  if (!name) return "#0098ea"; // TON blue fallback
  const colors: Record<string, string> = {
    Midnight: "#0f172a",
    Pulse: "#7f00ff",
    Sunlight: "#eab308",
    Aqua: "#06b6d4",
    Fire: "#ef4444",
    Green: "#22c55e",
  };
  return colors[name] || "#0098ea";
}

export function ProfileTab({ me, syncProgress, loading, error, onSync }: Props) {
  const user = me?.user;
  const telegramAuthStatus = tma.hasInitData() ? "подключено" : "отсутствует";
  const buildId = import.meta.env.VITE_BUILD_ID ?? "auth4";

  return (
    <div className="space-y-5">
      {/* Карточка профиля */}
      <section className="rounded-2xl glass p-5 shadow-xl animate-fade-in-up relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0098ea]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#0098ea] to-[#7f00ff] p-0.5 flex items-center justify-center shadow-lg shrink-0">
            <div className="w-full h-full rounded-full bg-[#161a26] flex items-center justify-center text-white text-lg font-bold font-mono">
              {user?.username ? user.username.slice(0, 2).toUpperCase() : user?.firstName ? user.firstName.slice(0, 2).toUpperCase() : "TG"}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-tg-hint uppercase tracking-wider">Мой профиль</p>
            <h1 className="mt-0.5 text-lg font-bold truncate text-white leading-tight">
              {user?.username ? `@${user.username}` : user?.firstName ?? "Telegram user"}
            </h1>
            <span className="mt-1 inline-block text-[9px] font-mono text-tg-hint bg-white/5 px-2 py-0.5 rounded border border-white/5">
              ID {user?.tgId ?? "..."}
            </span>
          </div>
        </div>

        {/* Метрики */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="Счет" value={user?.score ?? 0} icon={<Trophy size={18} />} />
          <Metric label="Лайки" value={user?.socialLikes ?? 0} icon={<Heart size={18} />} />
        </div>

        {/* Статус квалификации */}
        <div className={`mt-4 flex items-center gap-3 p-3 rounded-xl border text-xs transition-all duration-300 ${
          user?.isQualified 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.05)]" 
            : "bg-amber-500/10 border-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
        }`}>
          {user?.isQualified ? (
            <>
              <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
              <span className="font-medium leading-normal">Верификация пройдена. Вы допущены к премиум-голосованию!</span>
            </>
          ) : (
            <>
              <ShieldAlert size={18} className="text-amber-400 shrink-0" />
              <span className="font-medium leading-normal">Синхронизируйте целевые подарки для прохождения верификации.</span>
            </>
          )}
        </div>

        {/* Статус авторизации */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 border border-white/5 px-3 py-2 text-[10px] text-tg-hint font-mono">
          <span>Telegram Auth: <span className="text-[#0098ea] font-bold">{telegramAuthStatus}</span></span>
          <span className="bg-white/5 px-1.5 py-0.5 rounded text-[9px]">v{buildId}</span>
        </div>
      </section>

      {/* Кнопка синхронизации */}
      <button
        className="relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0098ea] to-[#00b4d8] px-4 font-semibold text-white shadow-[0_4px_20px_rgba(0,152,234,0.3)] hover:shadow-[0_4px_25px_rgba(0,152,234,0.45)] disabled:opacity-50 disabled:pointer-events-none"
        onClick={onSync}
        disabled={loading}
      >
        <RefreshCw size={18} className={`transition-all duration-300 ${loading ? "animate-spin" : ""}`} />
        Синхронизировать подарки
      </button>

      {/* Вывод ошибки */}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 shadow-md">
          {error}
        </div>
      ) : null}

      {/* Прогресс синхронизации */}
      {syncProgress ? (
        <section className="rounded-2xl glass p-5 shadow-xl animate-fade-in-up">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-tg-hint uppercase tracking-wider">Прогресс синхронизации</p>
            <span className="rounded-full bg-white/5 border border-white/5 px-2.5 py-0.5 text-[10px] text-[#0098ea] font-bold uppercase tracking-wider font-mono">
              {syncProgress.status === "done" ? "завершено" : syncProgress.status === "failed" ? "ошибка" : "выполняется"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MetricSmall label="Найдено" value={syncProgress.fetched} />
            <MetricSmall label="Принято" value={syncProgress.accepted} />
            <MetricSmall label="Отклонено" value={syncProgress.rejected} />
          </div>
          {syncProgress.status === "running" && (
            <div className="mt-4 w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#0098ea] to-[#00b4d8] rounded-full animate-pulse-glow" style={{ width: "100%" }} />
            </div>
          )}
          {syncProgress.error ? <p className="mt-3 text-xs text-red-400 font-medium">{syncProgress.error}</p> : null}
        </section>
      ) : null}

      {/* Засчитанные подарки */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-[#0098ea]" />
            <h2 className="font-bold text-md text-white">Уникальные подарки</h2>
          </div>
          <span className="text-[10px] text-tg-hint font-mono bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
            Всего: {me?.gifts.length ?? 0}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {me?.gifts.length ? (
            me.gifts.map((gift) => (
              <article 
                key={gift.id} 
                className="rounded-2xl glass-interactive p-3 flex flex-col relative group overflow-hidden"
                style={{ 
                  borderColor: gift.backdropName ? `${getBackdropColor(gift.backdropName)}33` : "rgba(255,255,255,0.07)"
                }}
              >
                <div 
                  className="absolute inset-0 opacity-[0.03] transition-opacity duration-300 group-hover:opacity-[0.08]"
                  style={{ backgroundColor: getBackdropColor(gift.backdropName) }}
                />
                
                <div className="relative aspect-square w-full rounded-xl bg-white/5 flex items-center justify-center overflow-hidden mb-3 border border-white/5 transition-transform duration-300 group-hover:scale-[1.02]">
                  {gift.imageUrl ? (
                    <img
                      src={gift.imageUrl}
                      alt={gift.baseName ?? gift.uniqueName ?? gift.giftId}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <Gift size={28} className="text-tg-hint opacity-50" />
                  )}
                  
                  <span className="absolute top-2 right-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 font-bold">
                    +{gift.scoreWeight}
                  </span>
                </div>
                
                <div className="min-w-0 flex-1 flex flex-col">
                  <h3 className="font-bold text-xs text-white truncate group-hover:text-[#0098ea] transition-colors">
                    {gift.baseName ?? gift.giftId}
                  </h3>
                  <p className="text-[9px] text-tg-hint font-mono mt-0.5">
                    #{gift.uniqueNumber} {gift.uniqueName ? `- ${gift.uniqueName}` : ""}
                  </p>
                  
                  <div className="mt-2 pt-1 flex flex-wrap gap-1">
                    {gift.modelName && (
                      <span className="text-[7px] bg-white/5 border border-white/5 text-tg-hint px-1.5 py-0.5 rounded uppercase font-semibold">
                        {gift.modelName}
                      </span>
                    )}
                    {gift.symbolName && (
                      <span className="text-[7px] bg-white/5 border border-white/5 text-tg-hint px-1.5 py-0.5 rounded uppercase font-semibold">
                        {gift.symbolName}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="col-span-2 rounded-2xl glass p-8 text-center text-xs text-tg-hint flex flex-col items-center justify-center gap-2 border border-dashed border-white/10">
              <Gift size={32} className="text-white/20" />
              <span>У вас пока нет засчитанных подарков. Синхронизируйте коллекцию, чтобы они появились здесь!</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-3 flex items-center justify-between shadow-md relative overflow-hidden group">
      <div>
        <div className="text-xl font-bold tracking-tight text-white">{value}</div>
        <div className="text-[9px] text-tg-hint font-semibold uppercase tracking-wider mt-0.5">{label}</div>
      </div>
      <div className="p-2 rounded-lg bg-white/5 text-tg-hint group-hover:text-white transition-colors">
        {icon}
      </div>
    </div>
  );
}

function MetricSmall({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-2 text-center">
      <div className="text-md font-bold text-white">{value}</div>
      <div className="text-[8px] text-tg-hint uppercase tracking-wider font-semibold mt-0.5">{label}</div>
    </div>
  );
}

