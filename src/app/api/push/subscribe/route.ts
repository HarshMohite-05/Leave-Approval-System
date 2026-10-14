import { NextRequest, NextResponse } from 'next/server';
import { WebPushService } from '@/lib/web-push';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, subscription } = body;

    if (!userId || !subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'userId and valid PushSubscription are required' },
        { status: 400 }
      );
    }

    WebPushService.saveSubscription(userId, subscription);
    return NextResponse.json({ success: true, message: 'Push subscription registered successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (endpoint) {
      WebPushService.removeSubscription(endpoint);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
