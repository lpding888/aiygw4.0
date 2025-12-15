import fetch from 'node-fetch';
import logger from '../utils/logger.js';

type NotifyPayload = {
  title: string;
  message: string;
  severity?: 'info' | 'warn' | 'error' | 'critical';
  context?: Record<string, unknown>;
};

class NotificationService {
  private webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  private channel = process.env.NOTIFICATION_CHANNEL || 'default';

  async notify(payload: NotifyPayload): Promise<void> {
    const severity = payload.severity || 'info';

    // 如果未配置 webhook，则降级为日志
    if (!this.webhookUrl) {
      logger.warn('[Notification] 未配置 NOTIFICATION_WEBHOOK_URL，降级为日志', {
        channel: this.channel,
        ...payload
      });
      return;
    }

    try {
      const body = {
        channel: this.channel,
        severity,
        title: payload.title,
        message: payload.message,
        context: payload.context || {}
      };

      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`Webhook返回异常: ${res.status} ${res.statusText}`);
      }

      logger.info('[Notification] 通知已发送', { severity, channel: this.channel });
    } catch (error) {
      logger.error('[Notification] 发送通知失败，已记录日志', {
        error: (error as Error)?.message,
        ...payload
      });
    }
  }
}

export default new NotificationService();
