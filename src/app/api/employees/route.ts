import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User, LeaveBalance } from '@/lib/types';
import { NotificationService } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const users = await db
      .prepare("SELECT * FROM users ORDER BY CASE WHEN role = 'DIRECTOR' THEN 0 WHEN role = 'ADMIN' THEN 1 ELSE 2 END, employee_id ASC")
      .all() as User[];

    const currentYear = new Date().getFullYear();
    const balances = await db
      .prepare('SELECT * FROM leave_balances WHERE year = ?')
      .all(currentYear) as LeaveBalance[];

    const balanceMap = new Map<string, LeaveBalance>();
    for (const b of balances) {
      balanceMap.set(b.user_id, b);
    }

    const result = users.map((u) => {
      const { password, ...safe } = u;
      return {
        ...safe,
        balance: balanceMap.get(u.id) || null,
      };
    });

    return NextResponse.json(
      { employees: result },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      caller_id,
      employee_id,
      name,
      role,
      designation,
      contact,
      email,
      password,
    } = body;

    // Strict Hierarchy Check: Only Directors can add employees
    const caller = await db.prepare('SELECT * FROM users WHERE id = ?').get(caller_id) as User | undefined;
    if (!caller || caller.role !== 'DIRECTOR') {
      return NextResponse.json(
        { error: 'Forbidden: Only Nirmaan WaterTech Directors can add new employees to the roster.' },
        { status: 403 }
      );
    }

    if (!name || !role || !designation || !contact || !email || !password) {
      return NextResponse.json(
        { error: 'All fields (Name, Role, Designation, Contact, Email, Password) are required' },
        { status: 400 }
      );
    }

    // Auto-generate employee_id if not provided or empty
    let empId = employee_id ? employee_id.trim().toUpperCase() : '';
    if (!empId) {
      const existingEmps = await db
        .prepare("SELECT employee_id FROM users WHERE employee_id LIKE 'EMP%'")
        .all() as { employee_id: string }[];
      let maxNum = 4;
      for (const e of existingEmps) {
        const num = parseInt(e.employee_id.replace('EMP', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      empId = `EMP${String(maxNum + 1).padStart(3, '0')}`;
    }

    // Check unique employee_id or email
    const duplicate = await db
      .prepare('SELECT id FROM users WHERE LOWER(employee_id) = ? OR LOWER(email) = ?')
      .get(empId.toLowerCase(), email.trim().toLowerCase());

    if (duplicate) {
      return NextResponse.json(
        { error: `An employee with ID "${empId}" or Email "${email}" already exists.` },
        { status: 409 }
      );
    }

    const userId = `usr_${empId.toLowerCase()}`;
    const department =
      role === 'DIRECTOR'
        ? 'Executive Leadership'
        : designation.toLowerCase().includes('technician')
        ? 'Service & Field Operations'
        : designation.toLowerCase().includes('sales')
        ? 'Sales & Business Development'
        : 'Operations & HR Coordination';

    const reportsTo = role === 'DIRECTOR' ? 'None' : 'D001, D002';
    const currentYear = new Date().getFullYear();

    const avatarColors = [
      'bg-gradient-to-tr from-sky-600 to-cyan-500',
      'bg-gradient-to-tr from-teal-600 to-emerald-500',
      'bg-gradient-to-tr from-indigo-600 to-blue-500',
      'bg-gradient-to-tr from-amber-600 to-orange-500',
      'bg-gradient-to-tr from-purple-600 to-pink-500',
    ];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const addEmployeeTx = () => db.transaction(async (tx) => {
      await tx.prepare(`
        INSERT INTO users (id, employee_id, name, role, designation, department, reports_to, contact, email, password, avatar_color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        empId,
        name.trim(),
        role,
        designation.trim(),
        department,
        reportsTo,
        contact.trim(),
        email.trim().toLowerCase(),
        password.trim(),
        avatarColor
      );

      await tx.prepare(`
        INSERT INTO leave_balances (
          user_id, year, cl_allocated, cl_used, cl_pending,
          sl_allocated, sl_used, sl_pending,
          pl_allocated, pl_used, pl_pending,
          co_allocated, co_used, co_pending, lop_days
        ) VALUES (?, ?, 12, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0)
      `).run(userId, currentYear);
    });

    await addEmployeeTx();

    const createdUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    const balance = await db.prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?').get(userId, currentYear);

    // Notify Directors
    NotificationService.dispatch({
      type: 'LEAVE_SUBMITTED',
      targetUserIds: ['D001', 'D002'],
      title: `👤 New Employee Onboarded: ${createdUser.name} (${createdUser.employee_id})`,
      message: `${caller.name} added ${createdUser.name} as ${createdUser.designation}. Reporting directly to Directors with standard leave allocation (CL: 12, SL: 12).`,
    });

    const { password: _, ...safe } = createdUser;
    return NextResponse.json({
      success: true,
      employee: { ...safe, balance },
    });
  } catch (error: any) {
    console.error('Add employee error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
