import { createClient as createLibSqlClient, Client as LibSqlClient } from '@libsql/client';
import type { InStatement } from '@libsql/client';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';

type Params = unknown[];

export interface DbStatement {
  get: (...params: Params) => Promise<any>;
  all: (...params: Params) => Promise<any[]>;
  run: (...params: Params) => Promise<{ changes: number }>;
}

export interface Tx {
  prepare: (sql: string) => DbStatement;
}

export interface Db {
  prepare: (sql: string) => DbStatement;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
}

export function getPostgresUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL
  );
}

export function getDatabaseMetadata() {
  const pgUrl = getPostgresUrl();
  const hasTurso = Boolean(process.env.TURSO_DATABASE_URL);
  const isVercel = process.env.VERCEL === '1';

  if (pgUrl) {
    return {
      isPersistent: true,
      provider: 'neon_postgres',
      mode: 'Neon PostgreSQL (Cloud)',
    };
  }
  if (hasTurso) {
    return {
      isPersistent: true,
      provider: 'turso',
      mode: 'Turso libSQL (Cloud)',
    };
  }
  return {
    isPersistent: !isVercel,
    provider: isVercel ? 'ephemeral_tmp' : 'local_sqlite',
    mode: isVercel ? 'Vercel Ephemeral (/tmp) - Non-persistent' : 'Local SQLite',
  };
}

export const isDatabasePersistent = Boolean(
  getPostgresUrl() || process.env.TURSO_DATABASE_URL || process.env.VERCEL !== '1'
);

function toPgSql(sql: string): string {
  let paramIndex = 0;
  return sql
    .replace(/\?/g, () => `$${++paramIndex}`)
    .replace(/MAX\s*\(\s*0\s*,/gi, 'GREATEST(0,')
    .replace(/\bFROM\s+users\b/gi, 'FROM leave_system.users')
    .replace(/\bINTO\s+users\b/gi, 'INTO leave_system.users')
    .replace(/\bUPDATE\s+users\b/gi, 'UPDATE leave_system.users')
    .replace(/\bTABLE\s+(IF\s+NOT\s+EXISTS\s+)?users\b/gi, 'TABLE IF NOT EXISTS leave_system.users')
    .replace(/\bFROM\s+leave_balances\b/gi, 'FROM leave_system.leave_balances')
    .replace(/\bINTO\s+leave_balances\b/gi, 'INTO leave_system.leave_balances')
    .replace(/\bUPDATE\s+leave_balances\b/gi, 'UPDATE leave_system.leave_balances')
    .replace(/\bTABLE\s+(IF\s+NOT\s+EXISTS\s+)?leave_balances\b/gi, 'TABLE IF NOT EXISTS leave_system.leave_balances')
    .replace(/\bFROM\s+leave_requests\b/gi, 'FROM leave_system.leave_requests')
    .replace(/\bINTO\s+leave_requests\b/gi, 'INTO leave_system.leave_requests')
    .replace(/\bUPDATE\s+leave_requests\b/gi, 'UPDATE leave_system.leave_requests')
    .replace(/\bTABLE\s+(IF\s+NOT\s+EXISTS\s+)?leave_requests\b/gi, 'TABLE IF NOT EXISTS leave_system.leave_requests')
    .replace(/\bFROM\s+holidays\b/gi, 'FROM leave_system.holidays')
    .replace(/\bINTO\s+holidays\b/gi, 'INTO leave_system.holidays')
    .replace(/\bTABLE\s+(IF\s+NOT\s+EXISTS\s+)?holidays\b/gi, 'TABLE IF NOT EXISTS leave_system.holidays')
    .replace(/\bFROM\s+notifications\b/gi, 'FROM leave_system.notifications')
    .replace(/\bINTO\s+notifications\b/gi, 'INTO leave_system.notifications')
    .replace(/\bUPDATE\s+notifications\b/gi, 'UPDATE leave_system.notifications')
    .replace(/\bTABLE\s+(IF\s+NOT\s+EXISTS\s+)?notifications\b/gi, 'TABLE IF NOT EXISTS leave_system.notifications')
    .replace(/\bFROM\s+push_subscriptions\b/gi, 'FROM leave_system.push_subscriptions')
    .replace(/\bINTO\s+push_subscriptions\b/gi, 'INTO leave_system.push_subscriptions')
    .replace(/\bUPDATE\s+push_subscriptions\b/gi, 'UPDATE leave_system.push_subscriptions')
    .replace(/\bTABLE\s+(IF\s+NOT\s+EXISTS\s+)?push_subscriptions\b/gi, 'TABLE IF NOT EXISTS leave_system.push_subscriptions')
    .replace(/REFERENCES\s+users\s*\(/gi, 'REFERENCES leave_system.users(');
}

// Hosted Turso/libSQL when TURSO_DATABASE_URL is set; otherwise a local SQLite file.
function resolveLibSqlConfig() {
  if (process.env.TURSO_DATABASE_URL) {
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  const isVercel = process.env.VERCEL === '1';
  if (isVercel) {
    console.error(
      '[Nirmaan DB] CRITICAL WARNING: Running on Vercel without persistent database! SQLite database is stored in ephemeral /tmp and will be wiped on serverless cold starts. Connect Neon PostgreSQL (POSTGRES_URL) or Turso (TURSO_DATABASE_URL) in Vercel project environment variables to persist data.'
    );
  }
  const file = isVercel
    ? path.join('/tmp', 'nirmaan_leave.db')
    : path.join(process.cwd(), 'data', 'nirmaan_leave.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return { url: `file:${file}`, authToken: undefined };
}

declare global {
  // eslint-disable-next-line no-var
  var __nirmaan_db: Db | undefined;
}

function buildLibSqlDb(client: LibSqlClient, ready: Promise<void> | null): Db {
  const wait = async () => {
    if (ready) await ready;
  };

  function statement(sql: string): DbStatement {
    const exec = (params: Params) => client.execute({ sql, args: params as any });
    return {
      async get(...params: Params): Promise<any> {
        await wait();
        return (await exec(params)).rows[0] as any;
      },
      async all(...params: Params): Promise<any[]> {
        await wait();
        return (await exec(params)).rows as any[];
      },
      async run(...params: Params) {
        await wait();
        const r = await exec(params);
        return { changes: r.rowsAffected };
      },
    };
  }

  return {
    prepare(sql: string) {
      return statement(sql);
    },
    async exec(sql: string) {
      await client.executeMultiple(sql);
    },
    async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      await wait();
      const t = await client.transaction('write');
      try {
        const txObj: Tx = {
          prepare: (sql: string) => {
            const exec = (params: Params) => t.execute({ sql, args: params as any });
            return {
              async get(...params: Params): Promise<any> {
                return (await exec(params)).rows[0] as any;
              },
              async all(...params: Params): Promise<any[]> {
                return (await exec(params)).rows as any[];
              },
              async run(...params: Params) {
                const r = await exec(params);
                return { changes: r.rowsAffected };
              },
            };
          },
        };
        const result = await fn(txObj);
        await t.commit();
        return result;
      } catch (err) {
        await t.rollback();
        throw err;
      } finally {
        t.close();
      }
    },
  };
}

function buildNeonDb(sqlClient: ReturnType<typeof neon<false, true>>, ready: Promise<void> | null): Db {
  const wait = async () => {
    if (ready) await ready;
  };

  function statement(sqlStr: string): DbStatement {
    const pgSql = toPgSql(sqlStr);
    return {
      async get(...params: Params): Promise<any> {
        await wait();
        const res = (await sqlClient.query(pgSql, params as any[])) as any;
        return res.rows ? res.rows[0] : res[0];
      },
      async all(...params: Params): Promise<any[]> {
        await wait();
        const res = (await sqlClient.query(pgSql, params as any[])) as any;
        return res.rows ? res.rows : res;
      },
      async run(...params: Params) {
        await wait();
        const res = (await sqlClient.query(pgSql, params as any[])) as any;
        return { changes: res.rowCount ?? (Array.isArray(res) ? res.length : 1) };
      },
    };
  }

  return {
    prepare(sqlStr: string) {
      return statement(sqlStr);
    },
    async exec(sqlStr: string) {
      const statements = sqlStr
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        const pgStmt = toPgSql(stmt);
        await sqlClient.query(pgStmt);
      }
    },
    async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      await wait();
      const txObj: Tx = {
        prepare: (sqlStr: string) => statement(sqlStr),
      };
      return await fn(txObj);
    },
  };
}

function getDatabase(): Db {
  if (!global.__nirmaan_db) {
    const pgUrl = getPostgresUrl();
    if (pgUrl) {
      console.log('[Nirmaan DB] Connecting to Neon PostgreSQL via HTTP...');
      const sqlClient = neon<false, true>(pgUrl, { fullResults: true });
      const raw = buildNeonDb(sqlClient, null);
      const ready = (async () => {
        try {
          await sqlClient.query('CREATE SCHEMA IF NOT EXISTS leave_system');
          await initTablesAndSeed(raw);
          console.log('[Nirmaan DB] Neon PostgreSQL tables and seeds ready in schema leave_system.');
        } catch (err: any) {
          console.error('[Nirmaan DB] Failed to initialize Neon PostgreSQL:', err);
          throw err;
        }
      })();
      global.__nirmaan_db = buildNeonDb(sqlClient, ready);
    } else {
      console.log('[Nirmaan DB] Using libSQL / SQLite...');
      const client = createLibSqlClient(resolveLibSqlConfig());
      const raw = buildLibSqlDb(client, null);
      const ready = client.execute('PRAGMA foreign_keys = ON').then(() => initTablesAndSeed(raw));
      global.__nirmaan_db = buildLibSqlDb(client, ready);
    }
  }
  return global.__nirmaan_db;
}

export const db: Db = {
  prepare: (sql) => getDatabase().prepare(sql),
  exec: (sql) => getDatabase().exec(sql),
  transaction: (fn) => getDatabase().transaction(fn),
};

async function initTablesAndSeed(database: Db) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      designation TEXT NOT NULL,
      department TEXT NOT NULL,
      reports_to TEXT NOT NULL,
      contact TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      avatar_color TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leave_balances (
      user_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      cl_allocated REAL DEFAULT 12,
      cl_used REAL DEFAULT 0,
      cl_pending REAL DEFAULT 0,
      sl_allocated REAL DEFAULT 12,
      sl_used REAL DEFAULT 0,
      sl_pending REAL DEFAULT 0,
      pl_allocated REAL DEFAULT 0,
      pl_used REAL DEFAULT 0,
      pl_pending REAL DEFAULT 0,
      co_allocated REAL DEFAULT 0,
      co_used REAL DEFAULT 0,
      co_pending REAL DEFAULT 0,
      lop_days REAL DEFAULT 0,
      PRIMARY KEY (user_id, year),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      designation TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_half_day INTEGER DEFAULT 0,
      half_day_period TEXT,
      total_days REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      is_same_day INTEGER DEFAULT 0,
      technician_overlap_flag INTEGER DEFAULT 0,
      technician_overlap_details TEXT,
      action_by_id TEXT,
      action_by_name TEXT,
      action_at TIMESTAMP,
      action_remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT UNIQUE NOT NULL,
      is_optional INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      target_user_ids TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      leave_request_id TEXT,
      metadata TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Policy: 12 casual + 12 sick per year, no paid leave
  await database.prepare('UPDATE leave_balances SET sl_allocated = 12, pl_allocated = 0 WHERE sl_allocated != 12 OR pl_allocated != 0').run();

  const countRow = ((await database.prepare('SELECT COUNT(*) as count FROM users').get()) as { count: any }) || { count: 0 };
  const count = Number(countRow.count);

  if (count === 0) {
    const seedUsers = [
      {
        id: 'usr_manav',
        employee_id: 'D001',
        name: 'Manav Shah',
        role: 'DIRECTOR',
        designation: 'Director',
        department: 'Executive Leadership',
        reports_to: 'None',
        contact: '9909963575',
        email: 'manav@nirmaanwatertech.com',
        password: '30111999',
        avatar_color: 'bg-gradient-to-tr from-sky-600 to-cyan-500',
      },
      {
        id: 'usr_neer',
        employee_id: 'D002',
        name: 'Neer Savla',
        role: 'DIRECTOR',
        designation: 'Director',
        department: 'Executive Leadership',
        reports_to: 'None',
        contact: '9022444000',
        email: 'neer@nirmaanwatertech.com',
        password: '20081999',
        avatar_color: 'bg-gradient-to-tr from-blue-700 to-indigo-500',
      },
      {
        id: 'usr_mahesh',
        employee_id: 'EMP001',
        name: 'Mahesh Kavadkar',
        role: 'EMPLOYEE',
        designation: 'Technician',
        department: 'Service & Field Operations',
        reports_to: 'D001, D002',
        contact: '8451895152',
        email: 'service.mum@nirmaanwatertech.com',
        password: '15051995',
        avatar_color: 'bg-gradient-to-tr from-emerald-600 to-teal-500',
      },
      {
        id: 'usr_ritesh',
        employee_id: 'EMP002',
        name: 'Ritesh Dantani',
        role: 'EMPLOYEE',
        designation: 'Technician',
        department: 'Service & Field Operations',
        reports_to: 'D001, D002',
        contact: '9104518118',
        email: 'info@nirmaanwatertech.com',
        password: '30091999',
        avatar_color: 'bg-gradient-to-tr from-amber-600 to-yellow-500',
      },
      {
        id: 'usr_payal',
        employee_id: 'EMP003',
        name: 'Payal Kadam',
        role: 'ADMIN',
        designation: 'Admin',
        department: 'Operations & HR Coordination',
        reports_to: 'D001, D002',
        contact: '9372946315',
        email: 'payalkadam0430@gmail.com',
        password: '30092005',
        avatar_color: 'bg-gradient-to-tr from-purple-600 to-pink-500',
      },
      {
        id: 'usr_shubham',
        employee_id: 'EMP004',
        name: 'Shubham Singh',
        role: 'EMPLOYEE',
        designation: 'Sales Executive',
        department: 'Sales & Business Development',
        reports_to: 'D001, D002',
        contact: '7041521897',
        email: 'sales@nirmaanwatertech.com',
        password: '11011995',
        avatar_color: 'bg-gradient-to-tr from-rose-600 to-orange-500',
      },
    ];

    const currentYear = new Date().getFullYear();

    await database.transaction(async (tx) => {
      for (const u of seedUsers) {
        await tx.prepare(`
          INSERT INTO users (id, employee_id, name, role, designation, department, reports_to, contact, email, password, avatar_color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO NOTHING
        `).run(u.id, u.employee_id, u.name, u.role, u.designation, u.department, u.reports_to, u.contact, u.email, u.password, u.avatar_color);

        await tx.prepare(`
          INSERT INTO leave_balances (user_id, year, cl_allocated, cl_used, cl_pending, sl_allocated, sl_used, sl_pending, pl_allocated, pl_used, pl_pending, co_allocated, co_used, co_pending, lop_days)
          VALUES (?, ?, 12, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0)
          ON CONFLICT (user_id, year) DO NOTHING
        `).run(u.id, currentYear);
      }
    });

    // Seed Public Holidays
    const holidays = [
      { id: 'hol_1', name: 'Republic Day', date: `${currentYear}-01-26`, is_optional: 0 },
      { id: 'hol_2', name: 'Holi', date: `${currentYear}-03-25`, is_optional: 0 },
      { id: 'hol_3', name: 'Maharashtra Day', date: `${currentYear}-05-01`, is_optional: 0 },
      { id: 'hol_4', name: 'Independence Day', date: `${currentYear}-08-15`, is_optional: 0 },
      { id: 'hol_5', name: 'Ganesh Chaturthi', date: `${currentYear}-09-07`, is_optional: 0 },
      { id: 'hol_6', name: 'Gandhi Jayanti', date: `${currentYear}-10-02`, is_optional: 0 },
      { id: 'hol_7', name: 'Diwali (Laxmi Pujan)', date: `${currentYear}-11-01`, is_optional: 0 },
      { id: 'hol_8', name: 'Christmas Day', date: `${currentYear}-12-25`, is_optional: 0 },
    ];

    for (const h of holidays) {
      await database
        .prepare('INSERT INTO holidays (id, name, date, is_optional) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING')
        .run(h.id, h.name, h.date, h.is_optional);
    }
  }
}
