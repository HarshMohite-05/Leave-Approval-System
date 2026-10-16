import { db } from './db';
import { LeaveRequest, NotificationItem } from './types';
import { WebPushService } from './web-push';

export interface DispatchNotificationParams {
  type: 'LEAVE_SUBMITTED' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'LEAVE_CANCELLED' | 'TECHNICIAN_OVERLAP' | 'COMP_OFF_GRANTED' | 'DAILY_DIGEST';
  targetUserIds: string[]; // e.g. ['D001', 'D002']
  title: string;
  message: string;
  leaveRequestId?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * Records notification in DB and dispatches via in-app & Web Push
   */
  static async dispatch(params: DispatchNotificationParams): Promise<NotificationItem> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const targetsStr = params.targetUserIds.join(',');
    const metadataStr = params.metadata ? JSON.stringify(params.metadata) : null;

    await db.prepare(`
      INSERT INTO notifications (id, target_user_ids, type, title, message, leave_request_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, targetsStr, params.type, params.title, params.message, params.leaveRequestId || null, metadataStr);

    console.log(`[NotificationService] Dispatched ${params.type} to [${targetsStr}]: ${params.title}`);

    return {
      id,
      target_user_ids: targetsStr,
      type: params.type,
      title: params.title,
      message: params.message,
      leave_request_id: params.leaveRequestId || null,
      metadata: metadataStr,
      is_read: 0,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Alert Directors and Admin on a new submission via In-App & Web Push
   */
  static async notifyDirectorsNewLeave(leave: LeaveRequest, hasTechnicianOverlap: boolean, overlapMsg?: string) {
    const urgency = leave.is_same_day ? '🚨 [SAME-DAY URGENT] ' : '';
    const overlapAlert = hasTechnicianOverlap ? ' ⚠️ [CRITICAL OVERLAP] ' : '';

    await this.dispatch({
      type: hasTechnicianOverlap ? 'TECHNICIAN_OVERLAP' : 'LEAVE_SUBMITTED',
      targetUserIds: ['D001', 'D002', 'EMP003'],
      title: `${urgency}${overlapAlert}New Leave Request: ${leave.employee_name} (${leave.designation})`,
      message: `${leave.employee_name} (${leave.employee_id}) requested ${leave.total_days} day(s) ${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date}. Reason: "${leave.reason}".${overlapMsg ? ` Alert: ${overlapMsg}` : ''}`,
      leaveRequestId: leave.id,
      metadata: {
        employee_id: leave.employee_id,
        leave_type: leave.leave_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        total_days: leave.total_days,
        is_same_day: Boolean(leave.is_same_day),
        technician_overlap: hasTechnicianOverlap,
      },
    });

    // Dispatch real-time Mobile & Browser Web Push Notification to Directors & Admin
    await WebPushService.sendPushToUsers(['D001', 'D002', 'EMP003'], {
      title: `${urgency}${overlapAlert}Leave Request: ${leave.employee_name}`,
      body: `${leave.employee_name} (${leave.designation}) requested ${leave.total_days}d ${leave.leave_type} (${leave.start_date} to ${leave.end_date}). Reason: "${leave.reason}".${overlapMsg ? ` ${overlapMsg}` : ''}`,
      url: '/',
      tag: `leave-sub-${leave.id}`,
    }).catch((err) => console.error('[NotificationService] Error sending new leave push notification:', err));
  }

  /**
   * Alert employee, Directors, and Admin on Approval / Rejection via In-App & Web Push
   */
  static async notifyLeaveDecision(
    leave: LeaveRequest,
    decision: 'APPROVED' | 'REJECTED',
    approverName: string,
    remarks?: string
  ) {
    const isApproved = decision === 'APPROVED';
    const title = isApproved
      ? `✅ Leave Approved by ${approverName}`
      : `❌ Leave Rejected by ${approverName}`;

    const msg = isApproved
      ? `Your leave request for ${leave.start_date} to ${leave.end_date} (${leave.total_days} days) has been APPROVED by ${approverName}.${remarks ? ` Remarks: "${remarks}"` : ''}`
      : `Your leave request for ${leave.start_date} to ${leave.end_date} was not approved by ${approverName}.${remarks ? ` Remarks: "${remarks}"` : ''}`;

    // 1. Notify Applicant Employee
    await this.dispatch({
      type: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      targetUserIds: [leave.employee_id],
      title,
      message: msg,
      leaveRequestId: leave.id,
      metadata: {
        action_by: approverName,
        remarks: remarks || '',
        calendar_sync: isApproved ? 'OUT_OF_OFFICE_BLOCK_SCHEDULED' : 'N/A',
      },
    });

    // 2. Notify Both Directors and Admin for company synchronization
    await this.dispatch({
      type: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      targetUserIds: ['D001', 'D002', 'EMP003'],
      title: `[Sync Alert] ${leave.employee_name}'s request ${decision} by ${approverName}`,
      message: `${approverName} has ${decision.toLowerCase()} the ${leave.leave_type} request for ${leave.employee_name} (${leave.start_date} to ${leave.end_date}).${remarks ? ` Remarks: "${remarks}"` : ''}`,
      leaveRequestId: leave.id,
      metadata: {
        action_by: approverName,
      },
    });

    // Dispatch real-time Mobile & Browser Web Push Notification
    await WebPushService.sendPushToUsers([leave.employee_id, 'D001', 'D002', 'EMP003'], {
      title: `${isApproved ? '✅ Leave Approved' : '❌ Leave Rejected'}: ${leave.employee_name}`,
      body: `${leave.employee_name}'s request for ${leave.total_days}d (${leave.start_date} to ${leave.end_date}) was ${decision.toLowerCase()} by ${approverName}.${remarks ? ` "${remarks}"` : ''}`,
      url: '/',
      tag: `leave-dec-${leave.id}`,
    }).catch((err) => console.error('[NotificationService] Error sending decision push notification:', err));
  }
}
