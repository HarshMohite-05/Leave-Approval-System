import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employee_id');
    const userId = searchParams.get('user_id');

    if (!employeeId && !userId) {
      return NextResponse.json({ error: 'Identifier missing' }, { status: 400 });
    }

    const query = employeeId
      ? 'SELECT * FROM users WHERE employee_id = ?'
      : 'SELECT * FROM users WHERE id = ?';
    const param = employeeId || userId;

    const user = await db.prepare(query).get(param) as User | undefined;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentYear = new Date().getFullYear();
    const balance = await db
      .prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?')
      .get(user.id, currentYear);

    const { password: _, ...safeUser } = user;
    return NextResponse.json({ user: safeUser, balance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
