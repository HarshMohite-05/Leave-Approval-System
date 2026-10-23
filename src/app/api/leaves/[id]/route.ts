import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LeaveRequest, User } from '@/lib/types';
import { NotificationService } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leaveId = params.id;
    const body = await req.json();
    const { action, actor_id, remarks } = body;

    if (!action || !actor_id) {
      return NextResponse.json(
        { error: 'Action and actor_id are required' },
        { status: 400 }
      );
    }

    const leave = await db
      .prepare('SELECT * FROM leave_requests WHERE id = ?')
      .get(leaveId) as LeaveRequest | undefined;

    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    const actor = await db.prepare('SELECT * FROM users WHERE id = ?').get(actor_id) as
      | User
      | undefined;

    if (!actor) {
      return NextResponse.json({ error: 'Actor user not found' }, { status: 404 });
    }

    const currentYear = new Date().getFullYear();

    if (action === 'APPROVE' || action === 'REJECT') {
      // Permission check: Directors and Admin can approve or reject leaves
      if (actor.role !== 'DIRECTOR' && actor.role !== 'ADMIN') {
        return NextResponse.json(
          {
            error:
              'Forbidden: Only Nirmaan WaterTech Directors (Manav Shah, Neer Savla) or Admin (Payal Kadam) have authority to approve or reject leave requests.',
          },
          { status: 403 }
        );
      }

      if (leave.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Cannot ${action.toLowerCase()} a leave that is already ${leave.status}.` },
          { status: 400 }
        );
      }

      const isApprove = action === 'APPROVE';
      const targetStatus = isApprove ? 'APPROVED' : 'REJECTED';

      const decisionTx = () => db.transaction(async (tx) => {
        // Update leave request
        await tx.prepare(`
          UPDATE leave_requests
          SET status = ?, action_by_id = ?, action_by_name = ?, action_at = CURRENT_TIMESTAMP, action_remarks = ?
          WHERE id = ?
        `).run(targetStatus, actor.id, actor.name, remarks || null, leave.id);

        // Balance adjustment (if not UNPAID)
        if (leave.leave_type !== 'UNPAID') {
          let pendingCol = '';
          let usedCol = '';

          if (leave.leave_type === 'CASUAL') {
            pendingCol = 'cl_pending';
            usedCol = 'cl_used';
          } else if (leave.leave_type === 'SICK') {
            pendingCol = 'sl_pending';
            usedCol = 'sl_used';
          } else if (leave.leave_type === 'COMP_OFF') {
            pendingCol = 'co_pending';
            usedCol = 'co_used';
          }

          if (isApprove) {
            // Pending -> Used
            await tx.prepare(`
              UPDATE leave_balances
              SET ${pendingCol} = MAX(0, ${pendingCol} - ?),
                  ${usedCol} = ${usedCol} + ?
              WHERE user_id = ? AND year = ?
            `).run(leave.total_days, leave.total_days, leave.user_id, currentYear);
          } else {
            // Reject: Release pending back to available
            await tx.prepare(`
              UPDATE leave_balances
              SET ${pendingCol} = MAX(0, ${pendingCol} - ?)
              WHERE user_id = ? AND year = ?
            `).run(leave.total_days, leave.user_id, currentYear);
          }
        } else if (isApprove) {
          // If UNPAID and approved, record LOP days
          await tx.prepare(`
            UPDATE leave_balances
            SET lop_days = lop_days + ?
            WHERE user_id = ? AND year = ?
          `).run(leave.total_days, leave.user_id, currentYear);
        }
      });

      await decisionTx();

      const updatedLeave = await db
        .prepare('SELECT * FROM leave_requests WHERE id = ?')
        .get(leave.id) as LeaveRequest;

      // Trigger multi-channel Notification
      await NotificationService.notifyLeaveDecision(
        updatedLeave,
        targetStatus as 'APPROVED' | 'REJECTED',
        actor.name,
        remarks
      );

      return NextResponse.json({
        success: true,
        leave: updatedLeave,
        message: `Leave ${targetStatus.toLowerCase()} successfully by ${actor.name}`,
      });
    } else if (action === 'CANCEL') {
      // Cancellation by the employee who submitted it, a Director, or Admin
      if (actor.id !== leave.user_id && actor.role !== 'DIRECTOR' && actor.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'You are only authorized to cancel your own pending requests.' },
          { status: 403 }
        );
      }

      if (leave.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Cannot cancel a leave that is already ${leave.status}.` },
          { status: 400 }
        );
      }

      const cancelTx = () => db.transaction(async (tx) => {
        await tx.prepare(`
          UPDATE leave_requests
          SET status = 'CANCELLED', action_at = CURRENT_TIMESTAMP, action_remarks = ?
          WHERE id = ?
        `).run(remarks || 'Cancelled by employee/authorized admin', leave.id);

        // Release locked pending balance
        if (leave.leave_type !== 'UNPAID') {
          let pendingCol = '';
          if (leave.leave_type === 'CASUAL') pendingCol = 'cl_pending';
          else if (leave.leave_type === 'SICK') pendingCol = 'sl_pending';
          else if (leave.leave_type === 'COMP_OFF') pendingCol = 'co_pending';

          await tx.prepare(`
            UPDATE leave_balances
            SET ${pendingCol} = MAX(0, ${pendingCol} - ?)
            WHERE user_id = ? AND year = ?
          `).run(leave.total_days, leave.user_id, currentYear);
        }
      });

      await cancelTx();

      const cancelledLeave = await db
        .prepare('SELECT * FROM leave_requests WHERE id = ?')
        .get(leave.id) as LeaveRequest;

      // Alert Directors and Admin of cancellation
      NotificationService.dispatch({
        type: 'LEAVE_CANCELLED',
        targetUserIds: ['D001', 'D002', 'EMP003'],
        title: `Leave Cancelled: ${leave.employee_name}`,
        message: `${leave.employee_name} has withdrawn their ${leave.leave_type} leave request for ${leave.start_date} to ${leave.end_date}. Balance has been restored.`,
        leaveRequestId: leave.id,
      });

      return NextResponse.json({
        success: true,
        leave: cancelledLeave,
        message: 'Leave request cancelled successfully. Balance restored.',
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (error: any) {
    console.error('Leave action error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
