import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Holiday, User } from '@/lib/types';

export async function GET() {
  try {
    const holidays = db
      .prepare('SELECT * FROM holidays ORDER BY date ASC')
      .all() as Holiday[];
    return NextResponse.json({ holidays });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caller_id, name, date, is_optional } = body;

    const caller = db.prepare('SELECT * FROM users WHERE id = ?').get(caller_id) as User | undefined;
    if (!caller || (caller.role !== 'DIRECTOR' && caller.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Forbidden: Only Directors or Admin can manage company holidays.' },
        { status: 403 }
      );
    }

    if (!name || !date) {
      return NextResponse.json(
        { error: 'Holiday name and date (YYYY-MM-DD) are required' },
        { status: 400 }
      );
    }

    const id = `hol_${Date.now()}`;
    db.prepare(`
      INSERT INTO holidays (id, name, date, is_optional)
      VALUES (?, ?, ?, ?)
    `).run(id, name.trim(), date.trim(), is_optional ? 1 : 0);

    const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id);
    return NextResponse.json({ success: true, holiday });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const callerId = searchParams.get('caller_id');

    const caller = db.prepare('SELECT * FROM users WHERE id = ?').get(callerId) as User | undefined;
    if (!caller || (caller.role !== 'DIRECTOR' && caller.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Forbidden: Only Directors or Admin can manage company holidays.' },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json({ error: 'Holiday ID required' }, { status: 400 });
    }

    db.prepare('DELETE FROM holidays WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: 'Holiday deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
