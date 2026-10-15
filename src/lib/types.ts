export type UserRole = 'DIRECTOR' | 'ADMIN' | 'EMPLOYEE';

export interface User {
  id: string;
  employee_id: string;
  name: string;
  role: UserRole;
  designation: string;
  department: string;
  reports_to: string;
  contact: string;
  email: string;
  password?: string;
  status: 'ACTIVE' | 'INACTIVE';
  avatar_color?: string;
  created_at?: string;
}

export type LeaveType = 'CASUAL' | 'SICK' | 'COMP_OFF' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type HalfDayPeriod = 'FIRST_HALF' | 'SECOND_HALF';

export interface LeaveBalance {
  user_id: string;
  year: number;
  cl_allocated: number;
  cl_used: number;
  cl_pending: number;
  sl_allocated: number;
  sl_used: number;
  sl_pending: number;
  pl_allocated: number;
  pl_used: number;
  pl_pending: number;
  co_allocated: number;
  co_used: number;
  co_pending: number;
  lop_days: number;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  employee_id: string;
  employee_name: string;
  designation: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  is_half_day: number; // 0 or 1
  half_day_period?: HalfDayPeriod | null;
  total_days: number;
  reason: string;
  status: LeaveStatus;
  is_same_day: number; // 0 or 1
  technician_overlap_flag: number; // 0 or 1
  technician_overlap_details?: string | null;
  action_by_id?: string | null;
  action_by_name?: string | null;
  action_at?: string | null;
  action_remarks?: string | null;
  created_at: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  is_optional: number; // 0 or 1
}

export interface NotificationItem {
  id: string;
  target_user_ids: string; // comma separated e.g. "D001,D002"
  type: string;
  title: string;
  message: string;
  leave_request_id?: string | null;
  metadata?: string | null;
  is_read: number;
  created_at: string;
}

export interface DailyDigest {
  generated_at: string;
  on_leave_today: Array<{
    employee_id: string;
    employee_name: string;
    designation: string;
    leave_type: LeaveType;
    is_half_day: boolean;
    half_day_period?: HalfDayPeriod | null;
  }>;
  on_leave_tomorrow: Array<{
    employee_id: string;
    employee_name: string;
    designation: string;
    leave_type: LeaveType;
    is_half_day: boolean;
    half_day_period?: HalfDayPeriod | null;
  }>;
  coverage_status: {
    technicians: { available: number; total: number; percentage: number };
    sales: { available: number; total: number; percentage: number };
    admin: { available: number; total: number; percentage: number };
    overall_staff: { working: number; total: number; percentage: number };
  };
  pending_requests: Array<{
    id: string;
    employee_name: string;
    designation: string;
    dates: string;
    total_days: number;
    reason: string;
    is_same_day: boolean;
    technician_overlap: boolean;
  }>;
}
