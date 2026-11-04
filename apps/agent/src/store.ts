/**
 * Errands are stored as one JSON document each. With DATABASE_URL set they go
 * to Postgres (one table, created on start); without it they live in memory,
 * which is fine for local development and demo mode.
 */
import postgres from "postgres";
import type { Errand } from "@errand/core";
import { env } from "./env";
import { log } from "./log";

export interface Store {
  init(): Promise<void>;
  get(id: string): Promise<Errand | null>;
  put(e: Errand): Promise<void>;
  list(limit: number): Promise<Errand[]>;
  kind: "postgres" | "memory";
}

class MemoryStore implements Store {
  kind = "memory" as const;
  private map = new Map<string, Errand>();
  async init() {}
  async get(id: string) {
    const e = this.map.get(id);
    return e ? structuredClone(e) : null;
  }
  async put(e: Errand) {
    this.map.set(e.id, structuredClone(e));
  }
  async list(limit: number) {
    return [...this.map.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map((e) => structuredClone(e));
  }
}

class PostgresStore implements Store {
  kind = "postgres" as const;
  private sql: postgres.Sql;
  constructor(url: string) {
    this.sql = postgres(url, { max: 5, idle_timeout: 30, ssl: url.includes("localhost") ? false : "require" });
  }
  async init() {
    await this.sql`
      create table if not exists errands (
        id text primary key,
        status text not null,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        data jsonb not null
      )`;
    await this.sql`create index if not exists errands_created_idx on errands (created_at desc)`;
  }
  async get(id: string) {
    const rows = await this.sql<{ data: Errand }[]>`select data from errands where id = ${id}`;
    return rows[0]?.data ?? null;
  }
  async put(e: Errand) {
    await this.sql`
      insert into errands (id, status, created_at, updated_at, data)
      values (${e.id}, ${e.status}, ${e.createdAt}, ${e.updatedAt}, ${this.sql.json(e as never)})
      on conflict (id) do update set status = excluded.status, updated_at = excluded.updated_at, data = excluded.data`;
  }
  async list(limit: number) {
    const rows = await this.sql<{ data: Errand }[]>`select data from errands order by created_at desc limit ${limit}`;
    return rows.map((r) => r.data);
  }
}

export const store: Store = env.databaseUrl ? new PostgresStore(env.databaseUrl) : new MemoryStore();

export async function initStore() {
  await store.init();
  log.info("store.ready", { kind: store.kind });
}
