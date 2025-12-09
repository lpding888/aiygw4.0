/**
 * BullMQ监控面板安全中间件
 * 提供IP白名单和Basic Auth双重保护
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

/**
 * 从环境变量获取IP白名单
 * 格式: BULL_BOARD_WHITELIST_IPS="127.0.0.1,192.168.1.0/24,10.0.0.0/8"
 */
function getIPWhitelist(): string[] {
  const whitelist = process.env.BULL_BOARD_WHITELIST_IPS || '';
  if (!whitelist) {
    logger.warn('[BullBoard] 未配置IP白名单,将使用Basic Auth保护');
    return [];
  }
  return whitelist.split(',').map((ip) => ip.trim()).filter(Boolean);
}

/**
 * 检查IP是否在白名单中
 * 支持单个IP和CIDR格式
 */
function isIPWhitelisted(clientIP: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) {
    return false; // 无白名单配置,默认拒绝
  }

  for (const allowedIP of whitelist) {
    // 支持单个IP匹配
    if (allowedIP === clientIP) {
      return true;
    }

    // 支持CIDR格式 (简化实现)
    if (allowedIP.includes('/')) {
      const [network, maskBits] = allowedIP.split('/');
      if (isIPInCIDR(clientIP, network, parseInt(maskBits))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检查IP是否在CIDR范围内
 * 简化实现,仅支持IPv4
 */
function isIPInCIDR(ip: string, network: string, maskBits: number): boolean {
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = -1 << (32 - maskBits);
  return (ipNum & mask) === (networkNum & mask);
}

/**
 * 将IP地址转换为数字
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
}

/**
 * 获取客户端真实IP
 * 考虑反向代理场景
 */
function normalizeIPv6Loopback(ip: string | null): string | null {
  if (!ip) return null;
  // Handle ::1 and IPv4-mapped IPv6 ::ffff:127.0.0.1
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  return ip;
}

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const ip = forwarded.split(',')[0].trim();
    return normalizeIPv6Loopback(ip) || ip;
  }

  const realIP = typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : null;
  const socketIP = req.socket.remoteAddress || null;
  const normalized = normalizeIPv6Loopback(realIP || socketIP);

  return normalized || realIP || socketIP || 'unknown';
}

/**
 * Basic Auth认证
 */
function checkBasicAuth(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  const expectedUsername = process.env.BULL_BOARD_USERNAME || 'admin';
  const expectedPassword = process.env.BULL_BOARD_PASSWORD || '';

  if (!expectedPassword) {
    logger.warn('[BullBoard] 未配置密码(BULL_BOARD_PASSWORD),Basic Auth无效');
    return false;
  }

  return username === expectedUsername && password === expectedPassword;
}

/**
 * BullMQ监控面板安全中间件
 */
export function bullBoardAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientIP = getClientIP(req);
  const whitelist = getIPWhitelist();

  // 策略1: IP白名单检查
  if (whitelist.length > 0 && isIPWhitelisted(clientIP, whitelist)) {
    logger.info('[BullBoard] IP白名单验证通过', { clientIP });
    next();
    return;
  }

  // 策略2: Basic Auth检查
  if (checkBasicAuth(req)) {
    logger.info('[BullBoard] Basic Auth验证通过', { clientIP });
    next();
    return;
  }

  // 策略3: 开发环境特殊处理
  if (
    process.env.NODE_ENV === 'development' &&
    (clientIP.startsWith('127.0.0.1') || clientIP === 'localhost')
  ) {
    logger.warn('[BullBoard] 开发环境本地访问,跳过认证');
    next();
    return;
  }

  // 拒绝访问
  logger.warn('[BullBoard] 未授权访问尝试', {
    clientIP,
    userAgent: req.headers['user-agent'],
    hasAuth: !!req.headers.authorization
  });

  // 要求Basic Auth
  res.setHeader('WWW-Authenticate', 'Basic realm="BullMQ Dashboard"');
  res.status(401).json({
    success: false,
    error: {
      code: ERROR_CODES.UNAUTHORIZED,
      message: '需要认证访问'
    }
  });
}

/**
 * BullMQ监控面板只读模式中间件
 * 仅允许GET请求,禁止修改操作
 */
export function bullBoardReadOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    logger.warn('[BullBoard] 只读模式拒绝非GET请求', {
      method: req.method,
      path: req.path,
      clientIP: getClientIP(req)
    });

    throw AppError.create(ERROR_CODES.FORBIDDEN, {
      message: '监控面板处于只读模式,不允许修改操作'
    });
  }

  next();
}

export default bullBoardAuthMiddleware;
