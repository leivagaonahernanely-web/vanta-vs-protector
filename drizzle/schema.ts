import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  discordChannelId: varchar("discordChannelId", { length: 32 }),
  discordUserId: varchar("discordUserId", { length: 32 }),
  discordUsername: varchar("discordUsername", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const protections = mysqlTable("protections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  sourceSize: int("sourceSize").notNull(),
  status: mysqlEnum("status", ["protected", "review", "failed"]).default("protected").notNull(),
  mode: mysqlEnum("mode", ["fast", "balanced", "fortified"]).default("balanced").notNull(),
  obfuscateStrings: int("obfuscateStrings").default(1).notNull(),
  addLoaderGuard: int("addLoaderGuard").default(1).notNull(),
  checksum: varchar("checksum", { length: 16 }).notNull(),
  resultCode: text("resultCode"),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Protection = typeof protections.$inferSelect;
export type InsertProtection = typeof protections.$inferInsert;