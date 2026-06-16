import { Pool } from "pg"

// Singleton pg Pool. Next.js dev hot-reloads modules, so we stash the pool on
// globalThis to avoid exhausting the Supabase pooler with a new pool per reload.
declare global {
  // eslint-disable-next-line no-var
  var __jzPool: Pool | undefined
}

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot reach the JeetZombies database.")
  }
  // On Vercel each serverless instance is isolated, so keep the per-instance pool
  // tiny to avoid exhausting the Supabase pooler under concurrency. Locally we can
  // afford a few more connections.
  const isServerless = !!process.env.VERCEL
  return new Pool({
    connectionString,
    // Supabase pooler terminates SSL at the edge; relax cert verification.
    ssl: { rejectUnauthorized: false },
    max: isServerless ? 1 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  })
}

export const pool: Pool = global.__jzPool ?? createPool()
if (process.env.NODE_ENV !== "production") global.__jzPool = pool

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await pool.query(text, params)
  return res.rows as T[]
}

// Run a set of statements inside a single transaction.
export async function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}
