import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Employee ID / Email and password are required' },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    // Query user by either employee_id OR email
    const user = await db
      .prepare(`
        SELECT * FROM users
        WHERE LOWER(employee_id) = ? OR LOWER(email) = ?
      `)
      .get(cleanIdentifier, cleanIdentifier) as User | undefined;

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid Employee ID or Email ID. Please check your credentials.' },
        { status: 401 }
      );
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This employee account has been deactivated. Contact Directors.' },
        { status: 403 }
      );
    }

    if (user.password !== password.trim()) {
      return NextResponse.json(
        { error: 'Incorrect password. Please verify and try again.' },
        { status: 401 }
      );
    }

    // Fetch user's leave balance
    const currentYear = new Date().getFullYear();
    const balance = await db
      .prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?')
      .get(user.id, currentYear);

    // Return sanitized user object without exposing password in other contexts
    const { password: _, ...safeUser } = user;

    return NextResponse.json({
      user: safeUser,
      balance,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
