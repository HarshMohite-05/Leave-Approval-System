import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LeaveRequest, User, DailyDigest } from '@/lib/types';
import { format, addDays } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');

    // 1. Fetch approved leaves covering today or tomorrow
    const approvedLeaves = db
      .prepare(`
        SELECT * FROM leave_requests
        WHERE status = 'APPROVED'
          AND (
            (start_date <= ? AND end_date >= ?)
            OR
            (start_date <= ? AND end_date >= ?)
          )
      `)
      .all(todayStr, todayStr, tomorrowStr, tomorrowStr) as LeaveRequest[];

    const onLeaveToday: DailyDigest['on_leave_today'] = [];
    const onLeaveTomorrow: DailyDigest['on_leave_tomorrow'] = [];

    for (const l of approvedLeaves) {
      const coversToday = l.start_date <= todayStr && l.end_date >= todayStr;
      const coversTomorrow = l.start_date <= tomorrowStr && l.end_date >= tomorrowStr;

      if (coversToday) {
        onLeaveToday.push({
          employee_id: l.employee_id,
          employee_name: l.employee_name,
          designation: l.designation,
          leave_type: l.leave_type,
          is_half_day: Boolean(l.is_half_day),
          half_day_period: l.half_day_period,
        });
      }

      if (coversTomorrow) {
        onLeaveTomorrow.push({
          employee_id: l.employee_id,
          employee_name: l.employee_name,
          designation: l.designation,
          leave_type: l.leave_type,
          is_half_day: Boolean(l.is_half_day),
          half_day_period: l.half_day_period,
        });
      }
    }

    // 2. Compute Department Coverage
    const activeStaff = db
      .prepare("SELECT * FROM users WHERE status = 'ACTIVE' AND role != 'DIRECTOR'")
      .all() as User[];

    const technicianStaff = activeStaff.filter((u) => u.designation.toLowerCase().includes('technician'));
    const salesStaff = activeStaff.filter((u) => u.designation.toLowerCase().includes('sales'));
    const adminStaff = activeStaff.filter((u) => u.role === 'ADMIN');

    const todayLeaveEmpIds = new Set(onLeaveToday.map((item) => item.employee_id));

    const techAvailable = technicianStaff.filter((t) => !todayLeaveEmpIds.has(t.employee_id)).length;
    const salesAvailable = salesStaff.filter((s) => !todayLeaveEmpIds.has(s.employee_id)).length;
    const adminAvailable = adminStaff.filter((a) => !todayLeaveEmpIds.has(a.employee_id)).length;
    const totalWorkingStaff = activeStaff.filter((u) => !todayLeaveEmpIds.has(u.employee_id)).length;

    // 3. Pending requests awaiting Director action
    const pendingRequests = db
      .prepare("SELECT * FROM leave_requests WHERE status = 'PENDING' ORDER BY is_same_day DESC, created_at ASC")
      .all() as LeaveRequest[];

    const pendingFormatted = pendingRequests.map((p) => ({
      id: p.id,
      employee_name: p.employee_name,
      designation: p.designation,
      dates: `${p.start_date}${p.start_date !== p.end_date ? ' to ' + p.end_date : ''}`,
      total_days: p.total_days,
      reason: p.reason,
      is_same_day: Boolean(p.is_same_day),
      technician_overlap: Boolean(p.technician_overlap_flag),
    }));

    const digest: DailyDigest = {
      generated_at: new Date().toISOString(),
      on_leave_today: onLeaveToday,
      on_leave_tomorrow: onLeaveTomorrow,
      coverage_status: {
        technicians: {
          available: techAvailable,
          total: technicianStaff.length,
          percentage: technicianStaff.length ? Math.round((techAvailable / technicianStaff.length) * 100) : 100,
        },
        sales: {
          available: salesAvailable,
          total: salesStaff.length,
          percentage: salesStaff.length ? Math.round((salesAvailable / salesStaff.length) * 100) : 100,
        },
        admin: {
          available: adminAvailable,
          total: adminStaff.length,
          percentage: adminStaff.length ? Math.round((adminAvailable / adminStaff.length) * 100) : 100,
        },
        overall_staff: {
          working: totalWorkingStaff,
          total: activeStaff.length,
          percentage: activeStaff.length ? Math.round((totalWorkingStaff / activeStaff.length) * 100) : 100,
        },
      },
      pending_requests: pendingFormatted,
    };

    return NextResponse.json({
      success: true,
      digest,
    });
  } catch (error: any) {
    console.error('Daily digest error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
