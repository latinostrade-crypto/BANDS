import { TonConnectButton, useTonAddress, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { CheckCircle, Wallet } from "lucide-react";
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
        proof: proof.proof
      })
      .then(() => setStatus("verified"))
      .catch(() => setStatus("proof_pending"));
  }, [wallet, address]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-tg-secondary p-4">
        <div className="mb-4 flex items-center gap-2">
          <Wallet size={20} />
          <h2 className="font-semibold">Кошелек</h2>
        </div>
        <TonConnectButton />
        {address ? <p className="mt-4 text-sm text-tg-hint">Connected: {shortAddress}</p> : null}
      </section>

      <section className="rounded-lg bg-tg-secondary p-4">
        <div className="flex items-center gap-2">
          <CheckCircle size={18} className={status === "verified" ? "text-emerald-400" : "text-tg-hint"} />
          <h3 className="font-semibold">Backend verification</h3>
        </div>
        <p className="mt-2 text-sm text-tg-hint">
          {status === "verified"
            ? "Verified wallet is saved for rewards."
            : status === "proof_pending"
              ? "Wallet connected, proof is pending."
              : "Connect wallet to request TON proof."}
        </p>
      </section>

      <section className="rounded-lg border border-white/10 p-4 text-sm text-tg-hint">
        Награды отправляются только на verified wallet после проверки ton_proof на backend.
      </section>
    </div>
  );
}
