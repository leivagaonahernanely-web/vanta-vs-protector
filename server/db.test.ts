import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  selectFrom: vi.fn(),
  selectWhere: vi.fn(),
  selectOrderBy: vi.fn(),
  selectLimit: vi.fn(),
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    insert: () => ({ values: database.insertValues }),
    update: () => ({ set: (value: unknown) => { database.updateSet(value); return { where: database.updateWhere }; } }),
    select: () => ({
      from: () => {
        database.selectFrom();
        return {
          where: () => {
            database.selectWhere();
            return {
              orderBy: () => {
                database.selectOrderBy();
                return { limit: database.selectLimit };
              },
              limit: database.selectLimit,
            };
          },
        };
      },
    }),
  })),
}));

import { createDiscordPanel, createProtection, getDiscordPanelsByOwner, getProtectionsByUser, updateDiscordChannelId } from "./db";

const saved = {
  id: 4,
  userId: 9,
  name: "saved.lua",
  sourceSize: 10,
  status: "protected" as const,
  mode: "balanced" as const,
  obfuscateStrings: 1,
  addLoaderGuard: 1,
  checksum: "abcdef1234567890",
  resultCode: "return true",
  message: "ok",
  createdAt: new Date("2026-08-26T00:00:00.000Z"),
  updatedAt: new Date("2026-08-26T00:00:00.000Z"),
};

describe("database persistence helpers", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test";
    database.insertValues.mockResolvedValue([{ insertId: 4 }]);
    database.updateWhere.mockResolvedValue(undefined);
    database.selectLimit.mockResolvedValue([saved]);
  });

  it("updates the channel preference for one user", async () => {
    await updateDiscordChannelId(9, "123456789012345678");
    expect(database.updateSet).toHaveBeenCalledWith({ discordChannelId: "123456789012345678" });
    expect(database.updateWhere).toHaveBeenCalled();
  });

  it("inserts and retrieves a saved protection", async () => {
    const result = await createProtection({ ...saved, id: undefined });
    expect(database.insertValues).toHaveBeenCalled();
    expect(result).toEqual(saved);
  });

  it("inserts a Discord panel with its owner and message metadata", async () => {
    const panel = { id: 12, ownerId: 9, name: "Custom Buyer Panel", description: "Buyer panel", channelId: "123456789012345678", targetScript: "main.lua", hwidHours: 24, messageId: "987654321098765432", createdAt: new Date(), updatedAt: new Date() };
    database.selectLimit.mockResolvedValueOnce([panel]);
    const result = await createDiscordPanel({ ...panel, id: undefined });
    expect(database.insertValues).toHaveBeenCalled();
    expect(result).toEqual(panel);
  });

  it("filters and orders Discord panels by owner", async () => {
    const result = await getDiscordPanelsByOwner(9);
    expect(database.selectWhere).toHaveBeenCalled();
    expect(database.selectOrderBy).toHaveBeenCalled();
    expect(result).toEqual([saved]);
  });

  it("filters and orders protection history by user", async () => {
    const result = await getProtectionsByUser(9);
    expect(database.selectWhere).toHaveBeenCalled();
    expect(database.selectOrderBy).toHaveBeenCalled();
    expect(result).toEqual([saved]);
  });
});
