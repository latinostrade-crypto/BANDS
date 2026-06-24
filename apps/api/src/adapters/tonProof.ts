import crypto from "node:crypto";
import { Address, Cell, contractAddress, loadStateInit } from "@ton/core";
import { sha256, signVerify } from "@ton/crypto";

export interface TonProofVerifier {
  verify(input: {
    address: string;
    network: string;
    publicKey: string;
    walletStateInit: string;
    proof: {
      timestamp: number;
      domain: { value: string; lengthBytes?: number };
      signature: string;
      payload: string;
    };
    expectedDomain: string;
  }): Promise<boolean>;
}

const cellContains = (cell: Cell, needle: Buffer): boolean => {
  const wholeBytes = cell.bits.subbuffer(0, Math.floor(cell.bits.length / 8) * 8);
  if (wholeBytes?.includes(needle)) return true;
  return cell.refs.some((ref) => cellContains(ref, needle));
};

export class BasicTonProofVerifier implements TonProofVerifier {
  async verify(input: Parameters<TonProofVerifier["verify"]>[0]) {
    try {
      const ageSeconds = Math.abs(Date.now() / 1000 - input.proof.timestamp);
      if (ageSeconds > 15 * 60) return false;
      if (input.proof.domain.value !== input.expectedDomain) return false;
      if (!input.proof.payload) return false;

      const address = Address.parse(input.address);
      const publicKey = Buffer.from(input.publicKey, "hex");
      const signature = Buffer.from(input.proof.signature, "base64");
      if (publicKey.length !== 32 || signature.length !== 64) return false;

      const stateInitCell = Cell.fromBase64(input.walletStateInit);
      const stateInit = loadStateInit(stateInitCell.beginParse());
      const derivedAddress = contractAddress(address.workChain, stateInit);
      if (!derivedAddress.equals(address)) return false;
      if (!cellContains(stateInitCell, publicKey)) return false;

      const domain = Buffer.from(input.proof.domain.value);
      if (input.proof.domain.lengthBytes !== undefined && input.proof.domain.lengthBytes !== domain.length) {
        return false;
      }

      const workchain = Buffer.alloc(4);
      workchain.writeInt32BE(address.workChain);
      const domainLength = Buffer.alloc(4);
      domainLength.writeUInt32LE(domain.length);
      const timestamp = Buffer.alloc(8);
      timestamp.writeBigUInt64LE(BigInt(input.proof.timestamp));
      const message = Buffer.concat([
        Buffer.from("ton-proof-item-v2/"),
        workchain,
        address.hash,
        domainLength,
        domain,
        timestamp,
        Buffer.from(input.proof.payload)
      ]);
      const messageHash = await sha256(message);
      const signedMessage = await sha256(
        Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from("ton-connect"), messageHash])
      );
      return signVerify(signedMessage, signature, publicKey);
    } catch {
      return false;
    }
  }
}

export const makeProofPayload = () => `bands:${crypto.randomBytes(24).toString("hex")}`;
