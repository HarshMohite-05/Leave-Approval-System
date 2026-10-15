import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LeaveRequest, Holiday, LeaveBalance, User } from '@/lib/types';
import { calculateWorkingDays, isSameDayLeave, checkTechnicianOverlap } from '@/lib/date-utils';
import { NotificationService } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const employeeId = searchParams.get('employee_id');
    const status = searchParams.get('status');

    let query = 'SELECT * FROM leave_requests';
    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    } else if (employeeId) {
      conditions.push('employee_id = ?');
      params.push(employeeId);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const leaves = db.prepare(query).all(...params) as LeaveRequest[];
    return NextResponse.json({ leaves });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_id,
      leave_type,
      start_date,
      end_date,
      is_half_day,
      half_day_period,
      reason,
    } = body;

    if (!user_id || !leave_type || !start_date || !end_date || !reason) {
      return NextResponse.json(
        { error: 'Missing required leave application fields' },
        { status: 400 }
      );
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id) as User | undefined;
    if (!user) {
      return NextResponse.json({ error: 'Applicant user not found' }, { status: 404 });
    }

    // Fetch public holidays
    const holidays = db.prepare('SELECT date FROM holidays').all() as Holiday[];
    const holidayDates = holidays.map((h) => h.date);

    // Calculate smart working days (excluding Sundays and holidays)
    const totalDays = calculateWorkingDays(start_date, end_date, Boolean(is_half_day), holidayDates);

    if (totalDays <= 0) {
      return NextResponse.json(
        { error: 'Selected date range contains only Sundays or Company Holidays. No leave days required.' },
        { status: 400 }
      );
    }

    // Check same-day urgent emergency flag
    const isSameDay = isSameDayLeave(start_date);

    // Active leaves for overlap calculation
    const allActiveLeaves = db
      .prepare("SELECT * FROM leave_requests WHERE status IN ('APPROVED', 'PENDING')")
      .all() as LeaveRequest[];

    // Check critical technician overlap (EMP001 & EMP002)
    const overlapResult = checkTechnicianOverlap(
      user.employee_id,
      start_date,
      end_date,
      allActiveLeaves
    );

    const currentYear = new Date().getFullYear();

    // Check and lock balance inside atomic transaction
    const leaveId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const createLeaveTx = db.transaction(() => {
      // 1. Fetch balance
      const balance = db
        .prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?')
        .get(user.id, currentYear) as LeaveBalance | undefined;

      if (!balance) {
        throw new Error('Leave balance record not found for user');
      }

      // Check balance availability (excluding UNPAID)
      if (leave_type !== 'UNPAID') {
        let available = 0;
        let pendingCol = '';

        if (leave_type === 'CASUAL') {
          available = balance.cl_allocated - balance.cl_used - balance.cl_pending;
          pendingCol = 'cl_pending';
        } else if (leave_type === 'SICK') {
          available = balance.sl_allocated - balance.sl_used - balance.sl_pending;
          pendingCol = 'sl_pending';
        } else if (leave_type === 'COMP_OFF') {
          available = balance.co_allocated - balance.co_used - balance.co_pending;
          pendingCol = 'co_pending';
        }

        if (available < totalDays) {
          throw new Error(
            `Insufficient ${leave_type} leave balance. Available: ${available} days, Requested: ${totalDays} days. Consider choosing UNPAID / Loss of Pay (LOP) or another leave category.`
          );
        }

        // Lock days in pending
        db.prepare(
          `UPDATE leave_balances SET ${pendingCol} = ${pendingCol} + ? WHERE user_id = ? AND year = ?`
        ).run(totalDays, user.id, currentYear);
      }

      // 2. Insert leave request
      db.prepare(`
        INSERT INTO leave_requests (
          id, user_id, employee_id, employee_name, designation, leave_type,
          start_date, end_date, is_half_day, half_day_period, total_days,
          reason, status, is_same_day, technician_overlap_flag, technician_overlap_details
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, 'PENDING', ?, ?, ?
        )
      `).run(
        leaveId,
        user.id,
        user.employee_id,
        user.name,
        user.designation,
        leave_type,
        start_date,
        end_date,
        is_half_day ? 1 : 0,
        is_half_day ? half_day_period : null,
        totalDays,
        reason.trim(),
        isSameDay ? 1 : 0,
        overlapResult.hasOverlap ? 1 : 0,
        overlapResult.message || null
      );
    });

    createLeaveTx();

    const createdLeave = db
      .prepare('SELECT * FROM leave_requests WHERE id = ?')
      .get(leaveId) as LeaveRequest;

    // Trigger Director Notification Engine
    NotificationService.notifyDirectorsNewLeave(
      createdLeave,
      overlapResult.hasOverlap,
      overlapResult.message
    );

    return NextResponse.json({
      success: true,
      leave: createdLeave,
      overlapAlert: overlapResult.hasOverlap ? overlapResult.message : null,
    });
  } catch (error: any) {
    console.error('Leave submission error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit leave request' },
      { status: 400 }
    );
  }
}
