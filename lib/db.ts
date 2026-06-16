import { Pool } from "pg"

// Lazy singleton pg Pool.
//
// IMPORTANT: the pool is created on first use, NOT at module import. Next.js
// imports route modules during `next build` ("collecting page data"), and env
// vars like DATABASE_URL are not guaranteed to be present then. Creating the
// pool eagerly would throw and fail the build. Lazy init means we only require
// DATABASE_URL when an actual request runs a query.
//
// We also stash the pool on globalThis so Next.js dev hot-reload and warm
// serverless instances reuse one pool instead of exhausting the Supabase pooler.
declare global {
  // eslint-disable-next-line no-var
  var __jzPool: Pool | undefined
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot reach the Jeet Survival database.")
  }
  // On Vercel each serverless instance is isolated, so keep the per-instance pool
  // tiny to avoid exhausting the Supabase pooler under concurrency.
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

function getPool(): Pool {
  if (!global.__jzPool) global.__jzPool = createPool()
  return global.__jzPool
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await getPool().query(text, params)
  return res.rows as T[]
}

// Run a set of statements inside a single transaction.
export async function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
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
