import { NextRequest, NextResponse } from 'next/server';
import { WebPushService } from '@/lib/web-push';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    const targets = userId ? [userId] : ['D001', 'D002', 'EMP003'];

    const result = await WebPushService.sendPushToUsers(targets, {
      title: '🚨 Nirmaan WaterTech: Push Alert Active',
      body: 'Real-time mobile & browser notifications are active! You will receive instant push alerts for leave submissions and approvals.',
      url: '/',
      tag: `test-push-${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      message: `Dispatched push notification to ${result.sentCount} active browser/mobile device(s).`,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
