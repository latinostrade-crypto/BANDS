import type { SyncedUniqueGift } from "@bands/shared";
import { config } from "../config.js";

export interface TelegramGiftsProvider {
  getUserUniqueGiftsPage(userId: number, offset?: string): Promise<{
    gifts: SyncedUniqueGift[];
    nextOffset?: string;
  }>;
  getUserUniqueGifts(userId: number): Promise<SyncedUniqueGift[]>;
}

type BotApiGift = {
  type?: string;
  gift?: {
    gift_id?: string;
    base_name?: string;
    name?: string;
    number?: number;
    model?: {
      name?: string;
      sticker?: {
        thumbnail?: {
          file_id?: string;
          width?: number;
          height?: number;
        };
        thumb?: {
          file_id?: string;
          width?: number;
          height?: number;
        };
      };
    };
    symbol?: { name?: string };
    backdrop?: { name?: string };
  };
  is_burned?: boolean;
  is_from_blockchain?: boolean;
};

export class BotApiTelegramGiftsProvider implements TelegramGiftsProvider {
  async getUserUniqueGiftsPage(userId: number, offset?: string) {
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

    const gifts: SyncedUniqueGift[] = [];
    for (const item of payload.result.gifts) {
      const gift = item.gift;
      if (item.type !== "unique" || !gift?.gift_id || typeof gift.number !== "number") continue;
      const image = gift.model?.sticker?.thumbnail ?? gift.model?.sticker?.thumb;
      gifts.push({
        giftId: gift.gift_id,
        baseName: gift.base_name,
        uniqueName: gift.name,
        uniqueNumber: gift.number,
        modelName: gift.model?.name,
        symbolName: gift.symbol?.name,
        backdropName: gift.backdrop?.name,
        imageFileId: image?.file_id,
        imageWidth: image?.width,
        imageHeight: image?.height,
        isBurned: Boolean(item.is_burned),
        isFromBlockchain: Boolean(item.is_from_blockchain),
        rawPayload: item
      });
    }

    return { gifts, nextOffset: payload.result.next_offset };
  }

  async getUserUniqueGifts(userId: number): Promise<SyncedUniqueGift[]> {
    const gifts: SyncedUniqueGift[] = [];
    let offset: string | undefined;
    do {
      const page = await this.getUserUniqueGiftsPage(userId, offset);
      gifts.push(...page.gifts);
      offset = page.nextOffset;
    } while (offset);
    return gifts;
  }
}

export class MockTelegramGiftsProvider implements TelegramGiftsProvider {
  private readonly gifts: SyncedUniqueGift[] = [
    {
      giftId: "mock-star",
      baseName: "Star Crown",
      uniqueName: "Star Crown #128",
      uniqueNumber: 128,
      modelName: "Gold",
      symbolName: "Comet",
      backdropName: "Midnight",
      imageFileId: undefined,
      imageWidth: 128,
      imageHeight: 128,
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
      imageFileId: undefined,
      imageWidth: 128,
      imageHeight: 128,
      isBurned: false,
      isFromBlockchain: false,
      rawPayload: { source: "mock", gift_id: "mock-band", number: 42 }
    }
  ];

  async getUserUniqueGiftsPage(_userId: number, offset?: string) {
    const start = offset ? Number(offset) : 0;
    const gifts = this.gifts.slice(start, start + 100);
    const nextOffset = start + gifts.length < this.gifts.length ? String(start + gifts.length) : undefined;
    return { gifts, nextOffset };
  }

  async getUserUniqueGifts(): Promise<SyncedUniqueGift[]> {
    return this.gifts;
  }
}
