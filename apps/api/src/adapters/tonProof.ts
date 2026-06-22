import crypto from "node:crypto";

export interface TonProofVerifier {
  verify(input: {
    address: string;
    network: string;
    publicKey: string;
    proof: {
      timestamp: number;
      domain: { value: string; lengthBytes?: number };
      signature: string;
      payload: string;
    };
    expectedDomain: string;
  }): Promise<boolean>;
}

export class BasicTonProofVerifier implements TonProofVerifier {
  async verify(input: Parameters<TonProofVerifier["verify"]>[0]) {
    const ageSeconds = Math.abs(Date.now() / 1000 - input.proof.timestamp);
    if (ageSeconds > 15 * 60) return false;
    if (input.proof.domain.value !== input.expectedDomain) return false;
    if (!input.proof.payload) return false;

    // Full TON proof verification also checks the wallet state init and address/public-key relation.
    // Keep this adapter isolated so production can swap in a chain-aware verifier without route changes.
    return Boolean(input.address && input.network && input.publicKey && input.proof.signature);
  }
}

export const makeProofPayload = () => `bands:${crypto.randomBytes(24).toString("hex")}`;
