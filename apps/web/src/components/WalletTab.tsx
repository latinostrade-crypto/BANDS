import { TonConnectButton, useTonAddress, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { CheckCircle, Wallet, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export function WalletTab({ verifiedAddress }: { verifiedAddress: string | null }) {
  const address = useTonAddress();
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const [status, setStatus] = useState(verifiedAddress ? "verified" : "not_connected");
  const shortAddress = useMemo(() => (address ? `${address.slice(0, 6)}...${address.slice(-6)}` : ""), [address]);

  useEffect(() => {
    api
      .proofPayload()
      .then(({ payload }) => {
        tonConnectUI.setConnectRequestParameters({
          state: "ready",
          value: { tonProof: payload }
        });
      })
      .catch(() => undefined);
  }, [tonConnectUI]);

  useEffect(() => {
    const proof = wallet?.connectItems?.tonProof;
    if (!wallet || !address || !proof || "error" in proof) return;
    setStatus("proof_pending");
    api
      .verifyWallet({
        address,
        network: wallet.account.chain,
        publicKey: wallet.account.publicKey,
        walletStateInit: wallet.account.walletStateInit,
        proof: proof.proof
      })
      .then(() => setStatus("verified"))
      .catch(() => setStatus("proof_pending"));
  }, [wallet, address]);

  return (
    <div className="space-y-4">
      {/* Секция подключения кошелька */}
      <section className="rounded-2xl glass p-5 shadow-xl animate-fade-in-up relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#0098ea]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="mb-4 flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/5 text-[#0098ea] border border-white/5">
            <Wallet size={18} />
          </div>
          <div>
            <h2 className="font-bold text-white text-md">TON Кошелек</h2>
            <p className="text-[10px] text-tg-hint">Подключите ваш кошелек для вывода наград</p>
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/5 mt-4">
          <TonConnectButton />
          
          {address ? (
            <div className="mt-4 px-3 py-1.5 rounded-lg bg-[#0098ea]/10 border border-[#0098ea]/20 text-xs font-mono text-[#0098ea]">
              Адрес: {shortAddress}
            </div>
          ) : null}
        </div>
      </section>

      {/* Верификация на бэкенде */}
      <section className={`rounded-2xl border p-5 shadow-xl animate-fade-in-up transition-all duration-300 ${
        status === "verified"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
          : status === "proof_pending"
            ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
            : "bg-white/5 border-white/5 text-tg-hint"
      }`}>
        <div className="flex items-center gap-2.5">
          {status === "verified" ? (
            <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
          ) : status === "proof_pending" ? (
            <Loader2 size={20} className="text-blue-400 animate-spin shrink-0" />
          ) : (
            <ShieldAlert size={20} className="text-tg-hint shrink-0" />
          )}
          <h3 className="font-bold text-white text-sm">Серверная верификация</h3>
        </div>
        
        <p className="mt-3 text-xs leading-relaxed font-medium">
          {status === "verified"
            ? "Верификация успешно пройдена. Кошелек привязан и готов к начислению наград."
            : status === "proof_pending"
              ? "Кошелек подключен. Подпись отправлена на сервер, ожидаем подтверждения..."
              : "Подключите некостодиальный кошелек, чтобы подписать авторизационное сообщение."}
        </p>
      </section>

      {/* Информационная плашка */}
      <section className="rounded-2xl border border-white/5 bg-white/2 p-4 text-[11px] text-tg-hint leading-normal flex items-start gap-2.5">
        <span className="text-[#0098ea] font-bold">ℹ</span>
        <span>
          Важно: награды распределяются в автоматическом режиме только на верифицированные адреса кошельков, прошедшие валидацию криптографической подписи ton_proof на бэкенде.
        </span>
      </section>
    </div>
  );
}
