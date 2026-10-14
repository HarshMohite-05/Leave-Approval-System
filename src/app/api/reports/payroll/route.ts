import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User, LeaveBalance, LeaveRequest } from '@/lib/types';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || format(new Date(), 'yyyy-MM');

    const users = db
      .prepare("SELECT * FROM users WHERE status = 'ACTIVE' ORDER BY role ASC, employee_id ASC")
      .all() as User[];

    const currentYear = parseInt(month.split('-')[0], 10) || new Date().getFullYear();
    const balances = db
      .prepare('SELECT * FROM leave_balances WHERE year = ?')
      .all(currentYear) as LeaveBalance[];

    const balanceMap = new Map<string, LeaveBalance>();
    for (const b of balances) {
      balanceMap.set(b.user_id, b);
    }

    // Approved leaves in this month
    const leavesInMonth = db
      .prepare(`
        SELECT * FROM leave_requests
        WHERE status = 'APPROVED'
          AND (start_date LIKE ? OR end_date LIKE ?)
      `)
      .all(`${month}%`, `${month}%`) as LeaveRequest[];

    // CSV Headers
    const headers = [
      'Employee ID',
      'Employee Name',
      'Role',
      'Designation',
      'Department',
      'Contact',
      'Email',
      'Casual Leave (Used/Alloc)',
      'Sick Leave (Used/Alloc)',
      'Paid Leave (Used/Alloc)',
      'Comp-Off (Used/Alloc)',
      'LOP / Unpaid Days',
      'Leaves Approved in Selected Month',
      'Reporting Authority',
    ];

    const rows = users.map((u) => {
      const b = balanceMap.get(u.id);
      const userMonthLeaves = leavesInMonth
        .filter((l) => l.user_id === u.id)
        .map((l) => `${l.leave_type}: ${l.start_date} to ${l.end_date} (${l.total_days}d)`)
        .join('; ');

      return [
        `"${u.employee_id}"`,
        `"${u.name}"`,
        `"${u.role}"`,
        `"${u.designation}"`,
        `"${u.department}"`,
        `"${u.contact}"`,
        `"${u.email}"`,
        `"${b ? `${b.cl_used}/${b.cl_allocated}` : '0/12'}"`,
        `"${b ? `${b.sl_used}/${b.sl_allocated}` : '0/8'}"`,
        `"${b ? `${b.pl_used}/${b.pl_allocated}` : '0/15'}"`,
        `"${b ? `${b.co_used}/${b.co_allocated}` : '0/0'}"`,
        `"${b ? b.lop_days : 0}"`,
        `"${userMonthLeaves || 'None'}"`,
        `"${u.reports_to}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Nirmaan_WaterTech_Attendance_Payroll_${month}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
