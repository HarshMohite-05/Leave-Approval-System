import { NextResponse } from 'next/server';
import { db, getDatabaseMetadata, getPostgresUrl } from '@/lib/db';
import { isVapidConfigured, VAPID_PUBLIC_KEY } from '@/lib/web-push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();
  const dbMeta = getDatabaseMetadata();
  const pgUrl = getPostgresUrl();

  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      is_vercel: process.env.VERCEL === '1',
      has_database_url: Boolean(process.env.DATABASE_URL),
      has_postgres_url: Boolean(process.env.POSTGRES_URL),
      has_neon_url: Boolean(pgUrl),
      has_turso_url: Boolean(process.env.TURSO_DATABASE_URL),
      vapid_push_configured: isVapidConfigured,
      vapid_public_key_preview: VAPID_PUBLIC_KEY ? `${VAPID_PUBLIC_KEY.slice(0, 10)}...` : 'NOT_SET',
    },
    database: {
      metadata: dbMeta,
    },
  };

  try {
    const userCountRow = await db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: any } | undefined;
    const leaveCountRow = await db.prepare('SELECT COUNT(*) as count FROM leave_requests').get() as { count: any } | undefined;
    const notifCountRow = await db.prepare('SELECT COUNT(*) as count FROM notifications').get() as { count: any } | undefined;
    const subCountRow = await db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get() as { count: any } | undefined;

    diagnostics.database.queries = {
      users_count: Number(userCountRow?.count ?? 0),
      leaves_count: Number(leaveCountRow?.count ?? 0),
      notifications_count: Number(notifCountRow?.count ?? 0),
      push_subscriptions_count: Number(subCountRow?.count ?? 0),
    };
    diagnostics.status = 'HEALTHY';
    diagnostics.response_time_ms = Date.now() - startTime;

    return NextResponse.json(diagnostics, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (err: any) {
    diagnostics.status = 'UNHEALTHY';
    diagnostics.error = {
      message: err.message,
      stack: err.stack,
    };
    diagnostics.response_time_ms = Date.now() - startTime;

    return NextResponse.json(diagnostics, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
