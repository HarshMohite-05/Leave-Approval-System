import { format, parseISO, eachDayOfInterval, isSunday, isSameDay } from 'date-fns';
import { LeaveRequest } from './types';

/**
 * Calculates net working days between start and end date (inclusive),
 * automatically excluding Sundays and company public holidays.
 * Supports 0.5 days for half-day leaves.
 */
export function calculateWorkingDays(
  startDateStr: string,
  endDateStr: string,
  isHalfDay: boolean,
  holidayDates: string[] = []
): number {
  if (isHalfDay) {
    return 0.5;
  }

  try {
    const start = parseISO(startDateStr);
    const end = parseISO(endDateStr);

    if (start > end) {
      return 0;
    }

    const intervalDays = eachDayOfInterval({ start, end });
    const holidaySet = new Set(holidayDates.map((h) => h.split('T')[0]));

    let workingDays = 0;
    for (const day of intervalDays) {
      const dateKey = format(day, 'yyyy-MM-dd');
      // Exclude Sunday
      if (isSunday(day)) {
        continue;
      }
      // Exclude public holidays
      if (holidaySet.has(dateKey)) {
        continue;
      }
      workingDays += 1;
    }

    return workingDays;
  } catch (err) {
    console.error('Error calculating working days:', err);
    return 1;
  }
}

/**
 * Checks whether the leave starts on today's date (Same-Day Emergency)
 */
export function isSameDayLeave(startDateStr: string): boolean {
  try {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const start = startDateStr.split('T')[0];
    return start === todayStr;
  } catch {
    return false;
  }
}

/**
 * Technician IDs at Nirmaan WaterTech
 */
export const TECHNICIAN_IDS = ['EMP001', 'EMP002'];

/**
 * Critical Service Check:
 * If Mahesh (EMP001) or Ritesh (EMP002) is applying, check if the other technician
 * has an active (PENDING or APPROVED) leave overlapping the requested window.
 */
export function checkTechnicianOverlap(
  applicantEmployeeId: string,
  startDateStr: string,
  endDateStr: string,
  activeLeaves: LeaveRequest[],
  excludeLeaveId?: string
): { hasOverlap: boolean; overlappingLeave?: LeaveRequest; message?: string } {
  const isTechnician = TECHNICIAN_IDS.includes(applicantEmployeeId);
  if (!isTechnician) {
    return { hasOverlap: false };
  }

  const otherTechnicianId = applicantEmployeeId === 'EMP001' ? 'EMP002' : 'EMP001';
  const reqStart = startDateStr.split('T')[0];
  const reqEnd = endDateStr.split('T')[0];

  const overlappingLeave = activeLeaves.find((leave) => {
    if (leave.id === excludeLeaveId) return false;
    if (leave.employee_id !== otherTechnicianId) return false;
    if (leave.status !== 'APPROVED' && leave.status !== 'PENDING') return false;

    const leaveStart = leave.start_date.split('T')[0];
    const leaveEnd = leave.end_date.split('T')[0];

    // Check interval overlap: [reqStart, reqEnd] overlaps [leaveStart, leaveEnd]
    // reqStart <= leaveEnd && reqEnd >= leaveStart
    return reqStart <= leaveEnd && reqEnd >= leaveStart;
  });

  if (overlappingLeave) {
    return {
      hasOverlap: true,
      overlappingLeave,
      message: `⚠️ CRITICAL SERVICE ALERT: Both Technicians will be out on overlapping dates (${reqStart} to ${reqEnd}) — 0% Field Coverage!`,
    };
  }

  return { hasOverlap: false };
}
