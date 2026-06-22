import type { SyncedUniqueGift } from "@bands/shared";
import { config } from "../config.js";

export interface TelegramGiftsProvider {
  getUserUniqueGifts(userId: number): Promise<SyncedUniqueGift[]>;
}

type BotApiGift = {
  type?: string;
  gift?: {
    gift_id?: string;
    base_name?: string;
    name?: string;
    number?: number;
    model?: { name?: string };
    symbol?: { name?: string };
    backdrop?: { name?: string };
  };
  is_burned?: boolean;
  is_from_blockchain?: boolean;
};

export class BotApiTelegramGiftsProvider implements TelegramGiftsProvider {
  async getUserUniqueGifts(userId: number): Promise<SyncedUniqueGift[]> {
    const gifts: SyncedUniqueGift[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams({
        user_id: String(userId),
        limit: "100",
        exclude_unique: "false",
        exclude_unlimited: "true",
        exclude_saved: "false"
      });
      if (offset) params.set("offset", offset);

      const response = await fetch(`https://api.telegram.org/bot${config.botToken}/getUserGifts`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params
      });
      const payload = (await response.json()) as {
        ok: boolean;
        description?: string;
        result?: { gifts: BotApiGift[]; next_offset?: string };
      };
      if (!payload.ok || !payload.result) {
        throw new Error(payload.description ?? "Telegram getUserGifts failed");
      }

      for (const item of payload.result.gifts) {
        const gift = item.gift;
        if (item.type !== "unique" || !gift?.gift_id || typeof gift.number !== "number") continue;
        gifts.push({
          giftId: gift.gift_id,
          baseName: gift.base_name,
          uniqueName: gift.name,
          uniqueNumber: gift.number,
          modelName: gift.model?.name,
          symbolName: gift.symbol?.name,
          backdropName: gift.backdrop?.name,
          isBurned: Boolean(item.is_burned),
          isFromBlockchain: Boolean(item.is_from_blockchain),
          rawPayload: item
        });
      }

      offset = payload.result.next_offset;
    } while (offset);

    return gifts;
  }
}

export class MockTelegramGiftsProvider implements TelegramGiftsProvider {
  async getUserUniqueGifts(): Promise<SyncedUniqueGift[]> {
    return [
      {
        giftId: "mock-star",
        baseName: "Star Crown",
        uniqueName: "Star Crown #128",
        uniqueNumber: 128,
        modelName: "Gold",
        symbolName: "Comet",
        backdropName: "Midnight",
        isBurned: false,
        isFromBlockchain: false,
        rawPayload: { source: "mock", gift_id: "mock-star", number: 128 }
      },
      {
        giftId: "mock-band",
        baseName: "Neon Band",
        uniqueName: "Neon Band #42",
        uniqueNumber: 42,
        modelName: "Chrome",
        symbolName: "Wave",
        backdropName: "Pulse",
        isBurned: false,
        isFromBlockchain: false,
        rawPayload: { source: "mock", gift_id: "mock-band", number: 42 }
      }
    ];
  }
}
