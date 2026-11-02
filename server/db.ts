import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, nxKeys, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Crea la conexión de forma perezosa para que las herramientas locales funcionen sin base de datos.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  for (const field of ["name", "email", "loginMethod"] as const) {
    const value = user[field];
    if (value === undefined) continue;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  }

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function getUserByApiKeyHash(hash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.apiKeyHash, hash)).limit(1);
  return rows[0];
}

// true si ya existe al menos una cuenta. Se usa para el arranque: antes de que exista cualquier
// cuenta no hay forma de generar una NX_KEY (solo un admin puede hacerlo), así que la primera
// cuenta tiene que poder crearse sin una.
export async function hasAnyUser(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length > 0;
}

// Crea una cuenta admin Premium sin NX_KEY. Solo debe llamarse para destrabar el arranque:
// o el correo coincide con OWNER_OPEN_ID, o todavía no existe ninguna cuenta en la base de datos
// (ver auth.register en routers.ts). A partir de ahí hasAnyUser() ya devuelve true y toda cuenta
// nueva vuelve a exigir una NX_KEY como siempre.
export async function createBootstrapAdmin(input: { email: string; passwordHash: string }): Promise<"ok" | "email_taken"> {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");

  try {
    await db.insert(users).values({
      openId: `email:${input.email}`,
      email: input.email,
      passwordHash: input.passwordHash,
      loginMethod: "email",
      role: "admin",
      plan: "premium",
      lastSignedIn: new Date(),
    });
    return "ok";
  } catch (error) {
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") return "email_taken";
    throw error;
  }
}

// Filas afectadas por un UPDATE/INSERT del driver mysql2.
function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number })?.affectedRows ?? 0);
}

// Crea una cuenta Premium canjeando una NX_KEY. La clave se reclama primero con una condición
// atómica (no usada y no revocada), así dos peticiones no pueden canjear la misma clave.
export async function createAccountWithNxKey(input: {
  email: string;
  passwordHash: string;
  keyHash: string;
}): Promise<"ok" | "invalid_key" | "email_taken"> {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");

  const [key] = await db.select().from(nxKeys).where(eq(nxKeys.keyHash, input.keyHash)).limit(1);
  if (!key || key.revokedAt || key.redeemedAt) return "invalid_key";

  const openId = `email:${input.email}`;
  // Reclamo atómico de la clave: el UPDATE solo afecta si sigue libre.
  const claim = await db
    .update(nxKeys)
    .set({ redeemedAt: new Date() })
    .where(and(eq(nxKeys.id, key.id), isNull(nxKeys.redeemedAt), isNull(nxKeys.revokedAt)));
  if (affectedRows(claim) !== 1) return "invalid_key";

  try {
    const inserted = await db.insert(users).values({
      openId,
      email: input.email,
      passwordHash: input.passwordHash,
      loginMethod: "email",
      plan: "premium",
      lastSignedIn: new Date(),
    });
    const newId = Number((Array.isArray(inserted) ? inserted[0] : inserted).insertId);
    await db.update(nxKeys).set({ redeemedByUserId: newId }).where(eq(nxKeys.id, key.id));
    return "ok";
  } catch (error) {
    // Libera la clave si la cuenta no se pudo crear (por ejemplo, correo repetido).
    await db.update(nxKeys).set({ redeemedAt: null }).where(eq(nxKeys.id, key.id));
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") return "email_taken";
    throw error;
  }
}

export async function createNxKey(input: { keyHash: string; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  await db.insert(nxKeys).values(input);
}

export async function setUserApiKey(userId: number, input: { hash: string; domain: string }) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  await db.update(users).set({ apiKeyHash: input.hash, apiKeyDomain: input.domain }).where(eq(users.id, userId));
}
