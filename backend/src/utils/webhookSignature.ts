import crypto from 'crypto';
import type { Request } from 'express';
import logger from './logger.js';

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000; // 5分钟

const SIGNATURE_HEADER = 'x-webhook-signature';
const TIMESTAMP_HEADER = 'x-webhook-timestamp';

/**
 * 校验会员回调签名
 * 艹！防止随便伪造回调送配额！
 */
export function verifyMembershipWebhookSignature(
  req: Request,
  secret?: string | null
): { ok: boolean; reason?: string } {
  if (!secret) {
    logger.error('[Webhook] 缺少回调签名秘钥，拒绝处理回调');
    return { ok: false, reason: 'secret_missing' };
  }

  const signatureHeader = req.header(SIGNATURE_HEADER);
  const timestampHeader = req.header(TIMESTAMP_HEADER);

  if (!signatureHeader || !timestampHeader) {
    return { ok: false, reason: 'missing_signature' };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  const skew = Math.abs(Date.now() - timestamp);
  if (skew > DEFAULT_TOLERANCE_MS) {
    return { ok: false, reason: 'timestamp_out_of_window' };
  }

  const payload = `${timestamp}.${JSON.stringify(req.body ?? {})}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    const provided = Buffer.from(signatureHeader, 'utf8');
    const expected = Buffer.from(expectedSignature, 'utf8');

    if (provided.length !== expected.length) {
      return { ok: false, reason: 'invalid_signature_length' };
    }

    const match = crypto.timingSafeEqual(provided, expected);
    return match ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('[Webhook] 验证签名失败', err);
    return { ok: false, reason: 'signature_error' };
  }
}
