import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Cuentas de NextOfuscator. Para crear una cuenta hace falta una NX_KEY de Premium.
 * Las columnas de Discord y de planes antiguos se eliminaron.
 * La migración debe generarse con drizzle-kit en un entorno con base de datos.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Identificador de sesión: "email:<correo>" para cuentas nuevas. */
  openId: varchar("openId", { length: 320 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["free", "premium"]).default("free").notNull(),
  /** Hash HMAC de la API key activa. Solo hay una por cuenta. */
  apiKeyHash: varchar("apiKeyHash", { length: 64 }),
  /** Dominio web al que queda vinculada la API key. */
  apiKeyDomain: varchar("apiKeyDomain", { length: 253 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Claves NX_KEY emitidas por el administrador. Solo se guarda su hash. */
export const nxKeys = mysqlTable("nxKeys", {
  id: int("id").autoincrement().primaryKey(),
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  redeemedByUserId: int("redeemedByUserId").references(() => users.id),
  redeemedAt: timestamp("redeemedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type NxKey = typeof nxKeys.$inferSelect;
