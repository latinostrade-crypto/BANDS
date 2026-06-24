import { ClipboardCheck, Crown, Gift, Plus, Sparkles, Vote } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Challenge, ChallengeMode, ChallengeProposal, CpaTask, SantaPoolResponse } from "@bands/shared";
import { api } from "../lib/api";
import { tma } from "../lib/tma";

type Mode = ChallengeMode;

const modes: Array<{ id: Mode; label: string; icon: ReactNode }> = [
  { id: "tournament", label: "Турниры", icon: <Crown size={14} /> },
  { id: "influencer", label: "Блогеры", icon: <Sparkles size={14} /> },
  { id: "santa", label: "Санта", icon: <Gift size={14} /> },
  { id: "tasks", label: "Задания", icon: <ClipboardCheck size={14} /> }
];

export function ChallengesTab() {
  const [mode, setMode] = useState<Mode>("tournament");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [proposals, setProposals] = useState<ChallengeProposal[]>([]);
  const [tasks, setTasks] = useState<CpaTask[]>([]);
  const [santaPool, setSantaPool] = useState<SantaPoolResponse | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyProposalId, setBusyProposalId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (nextMode = mode) => {
    const [challengeData, proposalData, taskData, poolData] = await Promise.all([
      api.challenges(nextMode),
      api.challengeProposals(),
      api.tasks(),
      api.santaPool()
    ]);
    setChallenges(challengeData.challenges);
    setProposals(proposalData.proposals);
    setTasks(taskData.tasks);
    setSantaPool(poolData);
  };

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось загрузить данные"));
  }, []);

  const selectMode = (next: Mode) => {
    setMode(next);
    setMessage(null);
    tma.impact();
    load(next).catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось загрузить данные"));
  };

  const createProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.createChallengeProposal({
        title: title.trim(),
        description: description.trim() ? description.trim() : null
      });
      setTitle("");
      setDescription("");
      await load();
      tma.success();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать предложение");
      tma.error();
    } finally {
      setBusy(false);
    }
  };

  const voteProposal = async (proposalId: number) => {
    setBusyProposalId(proposalId);
    setMessage(null);
    try {
      const payment = await api.createDevPayment({
        purpose: "challenge_vote",
        amount: 0.05,
        currency: "TON",
        metadata: { proposalId }
      });
      const result = await api.challengeVote(proposalId, payment.payment.id);
      setMessage(`Голос засчитан. Вес вашего голоса: ${result.voteWeight} (количество подарков: ${result.giftCount}).`);
      await load();
      tma.success();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Голосование отклонено");
      tma.error();
    } finally {
      setBusyProposalId(null);
    }
  };

  const completeTask = async (taskId: number) => {
    setBusyProposalId(taskId);
    setMessage(null);
    try {
      const result = await api.completeTask(taskId);
      setMessage(result.completion.status === "verified" ? "Задание успешно выполнено, очки начислены." : "Задание отправлено на проверку модераторам.");
      await load();
      tma.success();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось завершить задание");
      tma.error();
    } finally {
      setBusyProposalId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Горизонтальный переключатель */}
      <div className="grid grid-cols-4 rounded-xl bg-white/5 border border-white/5 p-1 backdrop-blur-md">
        {modes.map((item) => (
          <button
            key={item.id}
            className={`flex h-10 flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 ${
              mode === item.id 
                ? "bg-[#0098ea] text-white shadow-[0_2px_10px_rgba(0,152,234,0.3)] scale-[1.02]" 
                : "text-tg-hint hover:text-white"
            }`}
            onClick={() => selectMode(item.id)}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Вывод информационного сообщения */}
      {message ? (
        <div className="rounded-xl border border-[#0098ea]/20 bg-[#0098ea]/5 p-3.5 text-xs text-tg-hint font-medium animate-fade-in-up">
          {message}
        </div>
      ) : null}

      {/* Список челленджей/заданий */}
      <section className="space-y-3">
        {mode === "santa" ? <SantaPool pool={santaPool} /> : null}
        {mode === "tasks" ? (
          tasks.length ? (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={busyProposalId === task.id}
                onComplete={() => completeTask(task.id)}
              />
            ))
          ) : (
            <div className="rounded-2xl glass p-8 text-center text-xs text-tg-hint flex flex-col items-center justify-center gap-2 border border-dashed border-white/10">
              <ClipboardCheck size={28} className="text-white/20" />
              <span>Пока нет активных заданий.</span>
            </div>
          )
        ) : challenges.length ? (
          challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} />)
        ) : (
          <div className="rounded-2xl glass p-8 text-center text-xs text-tg-hint flex flex-col items-center justify-center gap-2 border border-dashed border-white/10">
            <Crown size={28} className="text-white/20" />
            <span>В этом режиме пока нет активных челленджей.</span>
          </div>
        )}
      </section>

      {/* Форма создания предложения (DAO) */}
      <section className="rounded-2xl glass p-5 shadow-xl animate-fade-in-up">
        <div className="mb-4 flex items-center gap-2">
          <Vote size={18} className="text-[#0098ea]" />
          <h2 className="font-bold text-white text-md">DAO-предложения</h2>
        </div>
        <form className="space-y-3" onSubmit={createProposal}>
          <input
            className="h-11 w-full rounded-xl border border-white/10 bg-[#161a26]/40 hover:border-white/20 focus:border-[#0098ea] px-3 text-xs outline-none placeholder:text-tg-hint text-white transition-all"
            value={title}
            maxLength={140}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Название предложения"
          />
          <textarea
            className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-[#161a26]/40 hover:border-white/20 focus:border-[#0098ea] px-3 py-2.5 text-xs outline-none placeholder:text-tg-hint text-white transition-all"
            value={description}
            maxLength={1000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Короткое описание идеи для турнира"
          />
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0098ea] to-[#00b4d8] px-4 text-xs font-semibold text-white shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
            disabled={busy || !title.trim()}
          >
            <Plus size={15} />
            Создать предложение
          </button>
        </form>
      </section>

      {/* Список DAO предложений */}
      <section className="space-y-3">
        {proposals.length ? (
          proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              busy={busyProposalId === proposal.id}
              onVote={() => voteProposal(proposal.id)}
            />
          ))
        ) : (
          <div className="rounded-2xl glass p-8 text-center text-xs text-tg-hint flex flex-col items-center justify-center gap-2 border border-dashed border-white/10">
            <Vote size={28} className="text-white/20" />
            <span>Пока нет открытых предложений. Станьте первым!</span>
          </div>
        )}
      </section>
    </div>
  );
}

function SantaPool({ pool }: { pool: SantaPoolResponse | null }) {
  return (
    <article className="rounded-2xl glass p-5 shadow-xl animate-fade-in-up relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-center gap-2">
        <Gift size={20} className="text-[#0098ea]" />
        <h2 className="font-bold text-white text-md">Подарочный пул Санты</h2>
      </div>
      <p className="text-[11px] text-tg-hint mt-1 leading-normal">
        Участники вносят подарки в общий фонд. По завершении раунда пул распределяется случайным образом среди участников.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <PoolMetric label="Всего" value={pool?.entriesCount ?? 0} />
        <PoolMetric label="Одобрено" value={pool?.eligibleCount ?? 0} />
        <PoolMetric label="Ожидает" value={pool?.pendingCount ?? 0} />
      </div>
    </article>
  );
}

function PoolMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[9px] text-tg-hint uppercase tracking-wider font-semibold mt-0.5">{label}</div>
    </div>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <article className="rounded-2xl glass p-4 shadow-md animate-fade-in-up hover:border-[#0098ea]/30 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Активен
          </span>
          <h3 className="font-bold text-sm text-white mt-2 leading-snug">{challenge.title}</h3>
          {challenge.description ? (
            <p className="mt-1 text-xs text-tg-hint leading-relaxed">{challenge.description}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300 font-bold font-mono">
          +{challenge.rewardPoints} XP
        </span>
      </div>
    </article>
  );
}

function ProposalCard({ proposal, busy, onVote }: { proposal: ChallengeProposal; busy: boolean; onVote: () => void }) {
  return (
    <article className="rounded-2xl glass p-4 shadow-md animate-fade-in-up hover:border-[#0098ea]/30 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm text-white leading-snug">{proposal.title}</h3>
          {proposal.description ? (
            <p className="mt-1 text-xs text-tg-hint leading-relaxed">{proposal.description}</p>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-tg-hint">
              Голосов: <span className="text-[#0098ea] font-bold font-mono">{proposal.votesCount}</span>
            </span>
          </div>
        </div>
        <button
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0098ea] to-[#00b4d8] px-3 text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          disabled={busy}
          onClick={onVote}
        >
          <Vote size={13} className={busy ? "animate-pulse" : ""} />
          Голос
        </button>
      </div>
    </article>
  );
}

function TaskCard({ task, busy, onComplete }: { task: CpaTask; busy: boolean; onComplete: () => void }) {
  return (
    <article className="rounded-2xl glass p-4 shadow-md animate-fade-in-up hover:border-[#0098ea]/30 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm text-white leading-snug">{task.title}</h3>
          {task.description ? (
            <p className="mt-1 text-xs text-tg-hint leading-relaxed">{task.description}</p>
          ) : null}
          <span className="mt-3 inline-block text-[9px] bg-white/5 border border-white/5 text-tg-hint px-2 py-0.5 rounded font-mono font-semibold">
            Проверка: {task.verificationType === "manual" ? "Вручную" : "Авто"}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300 font-bold font-mono">
            +{task.rewardPoints} XP
          </span>
          <button
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 px-3 text-xs font-bold text-white active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            disabled={busy}
            onClick={onComplete}
          >
            <ClipboardCheck size={13} className={busy ? "animate-pulse" : ""} />
            Выполнено
          </button>
        </div>
      </div>
    </article>
  );
}

