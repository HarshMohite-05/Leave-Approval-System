import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User } from '@/lib/types';
import { NotificationService } from '@/lib/notifications';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeUserId = params.id;
    const body = await req.json();
    const { caller_id, action, password, contact, designation, comp_off_reason } = body;

    const caller = await db.prepare('SELECT * FROM users WHERE id = ?').get(caller_id) as User | undefined;
    if (!caller || caller.role !== 'DIRECTOR') {
      return NextResponse.json(
        { error: 'Forbidden: Only Directors have permission to modify employee credentials or balances.' },
        { status: 403 }
      );
    }

    const employee = await db.prepare('SELECT * FROM users WHERE id = ?').get(employeeUserId) as User | undefined;
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const currentYear = new Date().getFullYear();

    if (action === 'GRANT_COMP_OFF') {
      // Grant +1 day comp-off
      await db.prepare(`
        UPDATE leave_balances
        SET co_allocated = co_allocated + 1
        WHERE user_id = ? AND year = ?
      `).run(employee.id, currentYear);

      NotificationService.dispatch({
        type: 'COMP_OFF_GRANTED',
        targetUserIds: [employee.employee_id, 'D001', 'D002'],
        title: `🎁 +1 Day Comp-Off Granted to ${employee.name}`,
        message: `Director ${caller.name} has credited 1 day Comp-Off to ${employee.name}.${comp_off_reason ? ` Reason: "${comp_off_reason}"` : ''}`,
      });

      const updatedBalance = await db
        .prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?')
        .get(employee.id, currentYear);

      return NextResponse.json({
        success: true,
        message: `Successfully credited +1 Day Comp-Off to ${employee.name}`,
        balance: updatedBalance,
      });
    }

    // Otherwise Edit Info / Reset Password
    const updates: string[] = [];
    const updateParams: any[] = [];

    if (password && password.trim()) {
      updates.push('password = ?');
      updateParams.push(password.trim());
    }
    if (contact && contact.trim()) {
      updates.push('contact = ?');
      updateParams.push(contact.trim());
    }
    if (designation && designation.trim()) {
      updates.push('designation = ?');
      updateParams.push(designation.trim());
    }

    if (updates.length > 0) {
      updateParams.push(employee.id);
      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...updateParams);
    }

    const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(employee.id) as User;
    const { password: _, ...safe } = updatedUser;

    return NextResponse.json({
      success: true,
      message: 'Employee details updated successfully',
      employee: safe,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeUserId = params.id;
    const { searchParams } = new URL(req.url);
    const callerId = searchParams.get('caller_id');

    const caller = await db.prepare('SELECT * FROM users WHERE id = ?').get(callerId) as User | undefined;
    if (!caller || caller.role !== 'DIRECTOR') {
      return NextResponse.json(
        { error: 'Forbidden: Only Directors can remove employees from the active roster.' },
        { status: 403 }
      );
    }

    const employee = await db.prepare('SELECT * FROM users WHERE id = ?').get(employeeUserId) as User | undefined;
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (employee.role === 'DIRECTOR') {
      return NextResponse.json(
        { error: 'Cannot delete a Director from the system.' },
        { status: 400 }
      );
    }

    // Soft delete by setting status to INACTIVE so history is preserved
    await db.prepare("UPDATE users SET status = 'INACTIVE' WHERE id = ?").run(employee.id);

    // Cancel any pending leaves
    await db.prepare("UPDATE leave_requests SET status = 'CANCELLED' WHERE user_id = ? AND status = 'PENDING'").run(employee.id);

    NotificationService.dispatch({
      type: 'LEAVE_CANCELLED',
      targetUserIds: ['D001', 'D002'],
      title: `Employee Removed: ${employee.name} (${employee.employee_id})`,
      message: `${caller.name} removed ${employee.name} from the active roster. Access revoked.`,
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${employee.name} (${employee.employee_id}) removed from active roster and access revoked.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
