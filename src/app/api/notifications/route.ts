import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { NotificationItem } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id'); // e.g. 'D001' or 'EMP001'

    let query = 'SELECT * FROM notifications';
    const params: any[] = [];

    if (targetUserId) {
      query += ' WHERE target_user_ids LIKE ?';
      params.push(`%${targetUserId}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const notifications = await db.prepare(query).all(...params) as NotificationItem[];
    const countStmt = targetUserId
      ? await db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND target_user_ids LIKE ?').get(`%${targetUserId}%`)
      : await db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get();
    const unreadCount = countStmt as { count: number };

    return NextResponse.json({
      notifications,
      unreadCount: unreadCount?.count || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, mark_all, user_id } = body;

    if (mark_all) {
      if (user_id) {
        await db.prepare("UPDATE notifications SET is_read = 1 WHERE target_user_ids LIKE ?").run(`%${user_id}%`);
      } else {
        await db.prepare('UPDATE notifications SET is_read = 1').run();
      }
    } else if (id) {
      await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
