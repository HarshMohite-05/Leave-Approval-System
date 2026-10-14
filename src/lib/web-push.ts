import webpush from 'web-push';
import { db } from './db';

// VAPID keys configuration
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BA7tO3wlChrmn2MOjiUm0dvTtrZk3nlJqH30Ng23H40XtItx0qZWPhJ6wHVrt8QIwHdlTSHqglGRsO-2ZIVSobk';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'y1LlNDU78hniUTTnndjhtnAmjTR6PPU6dnMgKc0XfBM';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:notifications@nirmaanwatertech.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export interface PushSubscriptionItem {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

export class WebPushService {
  /**
   * Save or update subscription for a user
   */
  static saveSubscription(
    userId: string,
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }
  ) {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        created_at = CURRENT_TIMESTAMP
    `).run(id, userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);

    console.log(`[WebPushService] Registered device subscription for user [${userId}]`);
  }

  /**
   * Remove subscription (e.g. if expired or unsubscribed)
   */
  static removeSubscription(endpoint: string) {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }

  /**
   * Send web push notification to a list of users (by user ID or employee ID)
   */
  static async sendPushToUsers(userIds: string[], payload: PushPayload) {
    if (!userIds || userIds.length === 0) return { sentCount: 0 };

    const placeholders = userIds.map(() => '?').join(',');
    // Fetch all active device endpoints for these user IDs or employee IDs
    const subscriptions = db
      .prepare(`
        SELECT ps.* FROM push_subscriptions ps
        LEFT JOIN users u ON u.id = ps.user_id
        WHERE ps.user_id IN (${placeholders}) OR u.employee_id IN (${placeholders})
      `)
      .all(...userIds, ...userIds) as PushSubscriptionItem[];

    if (subscriptions.length === 0) {
      console.log(`[WebPushService] No registered browser push devices found for users: ${userIds.join(', ')}`);
      return { sentCount: 0 };
    }

    const payloadString = JSON.stringify(payload);
    let sentCount = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payloadString);
          sentCount++;
          console.log(`[WebPushService] Successfully dispatched Web Push to device [${sub.id}] (User: ${sub.user_id})`);
        } catch (err: any) {
          console.warn(`[WebPushService] Push delivery error for device ${sub.id}:`, err?.statusCode || err?.message);
          // 404 or 410 indicates subscription has expired or been revoked
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            this.removeSubscription(sub.endpoint);
          }
        }
      })
    );

    return { sentCount, totalTargets: subscriptions.length };
  }
}
