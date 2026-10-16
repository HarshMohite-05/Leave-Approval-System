import { createClient, Client, InStatement } from '@libsql/client';
import path from 'path';
import fs from 'fs';

// Hosted Turso/libSQL when TURSO_DATABASE_URL is set; otherwise a local SQLite file.
// (On Vercel without Turso the file lives in /tmp and is wiped on cold starts.)
function resolveConfig() {
  if (process.env.TURSO_DATABASE_URL) {
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  const file =
    process.env.VERCEL === '1'
      ? path.join('/tmp', 'nirmaan_leave.db')
      : path.join(process.cwd(), 'data', 'nirmaan_leave.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return { url: `file:${file}`, authToken: undefined };
}

type Params = unknown[];
type Executor = { execute: (stmt: InStatement) => ReturnType<Client['execute']> };

function statement(executor: Executor, sql: string) {
  const exec = (params: Params) => executor.execute({ sql, args: params as any });
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
}

export interface Tx {
  prepare: (sql: string) => ReturnType<typeof statement>;
}

declare global {
  // eslint-disable-next-line no-var
  var __nirmaan_db: Db | undefined;
}

function buildDb(client: Client, ready: Promise<void> | null) {
  const wait = async () => {
    if (ready) await ready;
  };
  return {
    prepare(sql: string) {
      const base = statement(client, sql);
      return {
        get: async (...p: Params) => (await wait(), base.get(...p)),
        all: async (...p: Params) => (await wait(), base.all(...p)),
        run: async (...p: Params) => (await wait(), base.run(...p)),
      };
    },
    async exec(sql: string) {
      await client.executeMultiple(sql);
    },
    /** Runs fn atomically. Use the `tx` argument for all queries inside. */
    async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      await wait();
      const t = await client.transaction('write');
      try {
        const result = await fn({ prepare: (sql) => statement(t, sql) });
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

type Db = ReturnType<typeof buildDb>;

function getDatabase(): Db {
  if (!global.__nirmaan_db) {
    const client = createClient(resolveConfig());
    const raw = buildDb(client, null);
    const ready = client.execute('PRAGMA foreign_keys = ON').then(() => initTablesAndSeed(raw));
    global.__nirmaan_db = buildDb(client, ready);
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      action_at DATETIME,
      action_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default 6 users if users table is empty
  // Policy: 12 casual + 12 sick per year, no paid leave (also fixes existing rows)
  await database.prepare('UPDATE leave_balances SET sl_allocated = 12, pl_allocated = 0 WHERE sl_allocated != 12 OR pl_allocated != 0').run();

  const count = ((await database.prepare('SELECT COUNT(*) as count FROM users').get()) as { count: number }).count;
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
          INSERT OR IGNORE INTO users (id, employee_id, name, role, designation, department, reports_to, contact, email, password, avatar_color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(u.id, u.employee_id, u.name, u.role, u.designation, u.department, u.reports_to, u.contact, u.email, u.password, u.avatar_color);
        await tx.prepare(`
          INSERT OR IGNORE INTO leave_balances (user_id, year, cl_allocated, cl_used, cl_pending, sl_allocated, sl_used, sl_pending, pl_allocated, pl_used, pl_pending, co_allocated, co_used, co_pending, lop_days)
          VALUES (?, ?, 12, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0)
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
        .prepare('INSERT OR IGNORE INTO holidays (id, name, date, is_optional) VALUES (?, ?, ?, ?)')
        .run(h.id, h.name, h.date, h.is_optional);
    }
  }
}
