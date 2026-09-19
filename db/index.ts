import { env } from 'cloudflare:workers';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Client, type QueryResultRow } from 'pg';

type BoundStatement = { sql: string; params: unknown[] };

type Prepared = {
  bind: (...params: unknown[]) => Prepared;
  first: <T extends QueryResultRow = QueryResultRow>() => Promise<T | null>;
  all: <T extends QueryResultRow = QueryResultRow>() => Promise<{ results: T[] }>;
  run: () => Promise<{ meta: { changes: number } }>;
  statement: BoundStatement;
};

function parameterize(sql: string): string {
  let parameter = 0;
  return sql.replace(/\?/g, () => `$${++parameter}`);
}

function connectionString(): string {
  const hyperdrive = (env as unknown as { HYPERDRIVE?: { connectionString?: string } }).HYPERDRIVE
    ?.connectionString;
  const configured = hyperdrive ?? (env as unknown as { DATABASE_URL?: string }).DATABASE_URL;
  if (!configured) throw new Error('DATABASE_URL ou binding HYPERDRIVE não configurado.');
  return configured;
}

class PostgresDatabase {
  private clientPromise: Promise<Client> | null = null;

  private client(): Promise<Client> {
    if (!this.clientPromise) {
      const client = new Client({ connectionString: connectionString() });
      this.clientPromise = client.connect().then(() => client);
      this.clientPromise.catch(() => {
        this.clientPromise = null;
      });
    }
    return this.clientPromise;
  }

  prepare(statement: string): Prepared {
    const prepared: Prepared = {
      statement: { sql: parameterize(statement), params: [] },
      bind: (...params: unknown[]) => {
        prepared.statement.params = params;
        return prepared;
      },
      first: async <T extends QueryResultRow = QueryResultRow>() => {
        const result = await (
          await this.client()
        ).query<T>(prepared.statement.sql, prepared.statement.params);
        const row = result.rows[0] as T | undefined;
        return row ?? null;
      },
      all: async <T extends QueryResultRow>() => {
        const result = await (
          await this.client()
        ).query<T>(prepared.statement.sql, prepared.statement.params);
        return { results: result.rows };
      },
      run: async () => {
        const result = await (
          await this.client()
        ).query(prepared.statement.sql, prepared.statement.params);
        return { meta: { changes: result.rowCount ?? 0 } };
      },
    };
    return prepared;
  }

  async batch(statements: Prepared[]): Promise<void> {
    const client = await this.client();
    await client.query('BEGIN');
    try {
      for (const statement of statements)
        await client.query(statement.statement.sql, statement.statement.params);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  async close(): Promise<void> {
    const pending = this.clientPromise;
    this.clientPromise = null;
    if (!pending) return;
    try {
      await (await pending).end();
    } catch {
      /* connection already closed */
    }
  }
}

const requestDatabase = new AsyncLocalStorage<PostgresDatabase>();

export function getDb(): PostgresDatabase {
  const database = requestDatabase.getStore();
  if (!database) throw new Error('Database access outside a request scope.');
  return database;
}

export async function withRequestDb<T>(operation: () => Promise<T>): Promise<T> {
  // Shared application functions can be called by another route handler in the
  // same request. Reuse that request's client instead of opening a nested one.
  if (requestDatabase.getStore()) return operation();

  const database = new PostgresDatabase();
  return requestDatabase.run(database, async () => {
    try {
      return await operation();
    } finally {
      await database.close();
    }
  });
}

export type { Prepared as PgPreparedStatement };
