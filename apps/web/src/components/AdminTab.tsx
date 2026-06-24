import { ClipboardList, Flag, Gift, ListChecks, Save } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { tma } from "../lib/tma";

type AdminSection = "gifts" | "challenges" | "tasks" | "proposals";
type Row = Record<string, unknown>;

const sections: Array<{ id: AdminSection; label: string; icon: ReactNode }> = [
  { id: "gifts", label: "Цели", icon: <Gift size={14} /> },
  { id: "challenges", label: "События", icon: <Flag size={14} /> },
  { id: "tasks", label: "Задания", icon: <ListChecks size={14} /> },
  { id: "proposals", label: "DAO", icon: <ClipboardList size={14} /> }
];

export function AdminTab() {
  const [section, setSection] = useState<AdminSection>("gifts");
  const [targetGifts, setTargetGifts] = useState<Row[]>([]);
  const [challenges, setChallenges] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [proposals, setProposals] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const [gifts, challengeData, taskData, proposalData] = await Promise.all([
      api.adminTargetGifts(),
      api.adminChallenges(),
      api.adminCpaTasks(),
      api.adminProposals()
    ]);
    setTargetGifts(gifts.targetGifts as unknown as Row[]);
    setChallenges(challengeData.challenges as Row[]);
    setTasks(taskData.tasks as Row[]);
    setProposals(proposalData.proposals as Row[]);
  };

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Ошибка загрузки панели администрирования"));
  }, []);

  const saveTargetGift = async (body: { giftId: string; baseName?: string | null; weight: number; isActive: boolean }) => {
    await api.adminUpsertTargetGift(body);
    await load();
  };

  const saveChallenge = async (body: Row) => {
    await api.adminUpsertChallenge(body);
    await load();
  };

  const saveTask = async (body: Row) => {
    await api.adminUpsertCpaTask(body);
    await load();
  };

  const setProposalStatus = async (id: number, status: "open" | "selected" | "rejected" | "archived") => {
    await api.adminSetProposalStatus(id, status);
    await load();
  };

  const run = async (fn: () => Promise<void>) => {
    setMessage(null);
    try {
      await fn();
      setMessage("Сохранено");
      tma.success();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Действие отклонено сервером");
      tma.error();
    }
  };

  return (
    <div className="space-y-4">
      {/* Сегментный переключатель админ-панели */}
      <div className="grid grid-cols-4 rounded-xl bg-white/5 border border-white/5 p-1 backdrop-blur-md">
        {sections.map((item) => (
          <button
            key={item.id}
            className={`flex h-10 flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 ${
              section === item.id 
                ? "bg-[#0098ea] text-white shadow-[0_2px_10px_rgba(0,152,234,0.3)] scale-[1.02]" 
                : "text-tg-hint hover:text-white"
            }`}
            onClick={() => setSection(item.id)}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Информационные сообщения */}
      {message ? (
        <div className="rounded-xl border border-[#0098ea]/20 bg-[#0098ea]/5 p-3 text-xs text-tg-hint font-medium animate-fade-in-up">
          {message}
        </div>
      ) : null}

      {/* Редакторы по вкладкам */}
      {section === "gifts" ? <TargetGiftEditor rows={targetGifts} onSave={(body) => run(() => saveTargetGift(body))} /> : null}
      {section === "challenges" ? <ChallengeEditor rows={challenges} onSave={(body) => run(() => saveChallenge(body))} /> : null}
      {section === "tasks" ? <TaskEditor rows={tasks} onSave={(body) => run(() => saveTask(body))} /> : null}
      {section === "proposals" ? <ProposalAdmin rows={proposals} onStatus={(id, status) => run(() => setProposalStatus(id, status))} /> : null}
    </div>
  );
}

function TargetGiftEditor({ rows, onSave }: { rows: Row[]; onSave: (body: { giftId: string; baseName?: string | null; weight: number; isActive: boolean }) => void }) {
  const [giftId, setGiftId] = useState("");
  const [baseName, setBaseName] = useState("");
  const [weight, setWeight] = useState(1);
  const [isActive, setIsActive] = useState(true);

  return (
    <section className="space-y-4">
      <form
        className="rounded-2xl glass p-5 shadow-xl animate-fade-in-up"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ giftId, baseName: baseName || null, weight, isActive });
        }}
      >
        <h2 className="mb-3 font-bold text-white text-sm">Целевой подарок</h2>
        <Field value={giftId} onChange={setGiftId} placeholder="gift_id (ID подарка)" />
        <Field value={baseName} onChange={setBaseName} placeholder="Базовое имя" />
        <NumberField value={weight} onChange={setWeight} placeholder="Вес / множитель очков" />
        <label className="mt-3 flex items-center gap-2 text-xs text-tg-hint select-none font-semibold cursor-pointer">
          <input 
            type="checkbox" 
            checked={isActive} 
            onChange={(event) => setIsActive(event.target.checked)}
            className="w-4 h-4 rounded-lg bg-black/20 border border-white/10 outline-none accent-[#0098ea]"
          />
          Активен в раунде
        </label>
        <Submit />
      </form>
      <RowList rows={rows} title="Активные целевые подарки" />
    </section>
  );
}

function ChallengeEditor({ rows, onSave }: { rows: Row[]; onSave: (body: Row) => void }) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("tournament");
  const [rewardPoints, setRewardPoints] = useState(0);
  const [target, setTarget] = useState(0);
  const [status, setStatus] = useState("active");

  return (
    <section className="space-y-4">
      <form
        className="rounded-2xl glass p-5 shadow-xl animate-fade-in-up"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ mode, creatorType: "system", title, status, rewardPoints, rules: { target } });
        }}
      >
        <h2 className="mb-3 font-bold text-white text-sm">Новое событие / Челлендж</h2>
        <Field value={title} onChange={setTitle} placeholder="Название события" />
        <Select value={mode} onChange={setMode} options={["tournament", "influencer", "santa", "tasks"]} />
        <Select value={status} onChange={setStatus} options={["draft", "scheduled", "active", "finished"]} />
        <NumberField value={rewardPoints} onChange={setRewardPoints} placeholder="Очки за выполнение" />
        <NumberField value={target} onChange={setTarget} placeholder="Целевой показатель прогресса" />
        <Submit />
      </form>
      <RowList rows={rows} title="Список событий" />
    </section>
  );
}

function TaskEditor({ rows, onSave }: { rows: Row[]; onSave: (body: Row) => void }) {
  const [title, setTitle] = useState("");
  const [rewardPoints, setRewardPoints] = useState(0);
  const [verificationType, setVerificationType] = useState("manual");

  return (
    <section className="space-y-4">
      <form
        className="rounded-2xl glass p-5 shadow-xl animate-fade-in-up"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ title, rewardPoints, verificationType, status: "active", metadata: {} });
        }}
      >
        <h2 className="mb-3 font-bold text-white text-sm">Новое CPA-задание</h2>
        <Field value={title} onChange={setTitle} placeholder="Название задания" />
        <NumberField value={rewardPoints} onChange={setRewardPoints} placeholder="Очки за выполнение" />
        <Select value={verificationType} onChange={setVerificationType} options={["manual", "instant"]} />
        <Submit />
      </form>
      <RowList rows={rows} title="Список CPA-заданий" />
    </section>
  );
}

function ProposalAdmin({ rows, onStatus }: { rows: Row[]; onStatus: (id: number, status: "open" | "selected" | "rejected" | "archived") => void }) {
  return (
    <section className="space-y-3">
      {rows.map((row) => {
        const id = Number(row.id);
        const currentStatus = String(row.status);
        return (
          <article key={id} className="rounded-2xl glass p-4 shadow-md animate-fade-in-up relative overflow-hidden">
            <h3 className="font-bold text-sm text-white leading-snug">{String(row.title)}</h3>
            <p className="mt-1.5 text-[10px] text-tg-hint font-mono">Голосов: {String(row.votes_count ?? 0)} / Статус: {currentStatus}</p>
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {(["open", "selected", "rejected", "archived"] as const).map((status) => (
                <button 
                  key={status} 
                  className={`h-8 rounded-lg text-[9px] font-bold border transition-all active:scale-95 ${
                    currentStatus === status 
                      ? "bg-[#0098ea] border-[#0098ea] text-white" 
                      : "bg-white/5 border-white/5 text-tg-hint hover:text-white"
                  }`} 
                  onClick={() => onStatus(id, status)}
                >
                  {status.toUpperCase()}
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function RowList({ rows, title }: { rows: Row[]; title: string }) {
  return (
    <section className="space-y-3">
      <h2 className="font-bold text-sm text-white">{title}</h2>
      {rows.length ? (
        rows.map((row) => (
          <pre key={String(row.id)} className="overflow-x-auto rounded-xl bg-black/30 border border-white/5 p-4 text-[10px] text-tg-hint font-mono">
            {JSON.stringify(row, null, 2)}
          </pre>
        ))
      ) : (
        <div className="rounded-xl glass p-4 text-center text-xs text-tg-hint border border-dashed border-white/10">Записи отсутствуют.</div>
      )}
    </section>
  );
}

function Field({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <input className="mb-2 h-11 w-full rounded-xl border border-white/10 bg-[#161a26]/40 hover:border-white/20 focus:border-[#0098ea] px-3 text-xs outline-none text-white transition-all placeholder:text-tg-hint" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function NumberField({ value, onChange, placeholder }: { value: number; onChange: (value: number) => void; placeholder: string }) {
  return <input className="mb-2 h-11 w-full rounded-xl border border-white/10 bg-[#161a26]/40 hover:border-white/20 focus:border-[#0098ea] px-3 text-xs outline-none text-white transition-all placeholder:text-tg-hint" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} placeholder={placeholder} />;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select className="mb-2 h-11 w-full rounded-xl border border-white/10 bg-[#161a26]/40 hover:border-white/20 focus:border-[#0098ea] px-3 text-xs outline-none text-white transition-all" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option} className="bg-[#161a26] text-white">{option}</option>)}
    </select>
  );
}

function Submit() {
  return (
    <button className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0098ea] to-[#00b4d8] px-4 text-xs font-semibold text-white shadow-md active:scale-95 transition-all">
      <Save size={14} />
      Сохранить
    </button>
  );
}

