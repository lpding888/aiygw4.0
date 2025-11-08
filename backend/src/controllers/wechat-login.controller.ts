import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { ValidationError, Result } from 'express-validator';
import logger from '../utils/logger.js';
import wechatLoginService from '../services/wechat-login.service.js';
import { ERROR_CODES } from '../config/error-codes.js';

type MiniProgramLoginBody = {
  code?: string;
  userInfo?: Record<string, unknown>;
};

type UpdateProfileBody = {
  userInfo?: Record<string, unknown>;
};

type BindWechatPayBody = {
  openid?: string;
  unionid?: string;
};

const VALIDATION_ERROR_MESSAGE = '请求参数验证失败';

const respondValidationError = (res: Response, errors: Result<ValidationError>): void => {
  res.status(400).json({
    success: false,
    error: {
      code: ERROR_CODES.INVALID_PARAMETERS,
      message: VALIDATION_ERROR_MESSAGE,
      details: errors.array()
    },
    timestamp: new Date().toISOString()
  });
};

const respondError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
): void => {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    },
    timestamp: new Date().toISOString()
  });
};

const respondSuccess = (res: Response, data?: unknown, message?: string): void => {
  res.json({
    success: true,
    ...(data !== undefined ? { data } : {}),
    ...(message ? { message } : {}),
    timestamp: new Date().toISOString()
  });
};

const toStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
};

const ensureAuthenticatedUserId = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    respondError(res, 401, 'UNAUTHORIZED', '用户未登录');
    return null;
  }
  return userId;
};

const hasValidationError = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return false;
  }
  respondValidationError(res, errors);
  return true;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

class WechatLoginController {
  async generateOfficialOAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      if (hasValidationError(req, res)) {
        return;
      }

      const redirectUri = toStringOrUndefined(req.query.redirectUri);
      const scope = toStringOrUndefined(req.query.scope);
      const state = toStringOrUndefined(req.query.state);

      if (!redirectUri) {
        respondError(res, 400, 'MISSING_REDIRECT_URI', '缺少回调地址');
        return;
      }

      const result = wechatLoginService.generateOfficialOAuthUrl(redirectUri, scope, state ?? null);

      respondSuccess(res, result, '授权URL生成成功');
    } catch (error) {
      logger.error('[WechatLoginController] 生成微信公众号授权URL失败:', error);
      respondError(res, 500, 'GENERATE_OAUTH_URL_ERROR', getErrorMessage(error, '生成授权URL失败'));
    }
  }

  async handleOfficialOAuthCallback(req: Request, res: Response): Promise<void> {
    try {
      const code = toStringOrUndefined(req.query.code);
      const state = toStringOrUndefined(req.query.state);

      if (!code || !state) {
        respondError(res, 400, 'MISSING_PARAMETERS', '缺少必要参数: code 或 state');
        return;
      }

      const result = await wechatLoginService.handleOfficialOAuthCallback(code, state);
      respondSuccess(res, result, '微信登录成功');
    } catch (error) {
      logger.error('[WechatLoginController] 处理微信公众号OAuth回调失败:', error);
      respondError(res, 500, 'OAUTH_CALLBACK_ERROR', getErrorMessage(error, 'OAuth回调处理失败'));
    }
  }

  async handleMiniProgramLogin(req: Request, res: Response): Promise<void> {
    try {
      if (hasValidationError(req, res)) {
        return;
      }

      const { code, userInfo } = req.body as MiniProgramLoginBody;
      if (!code) {
        respondError(res, 400, 'MISSING_CODE', '缺少登录凭证');
        return;
      }

      const result = await wechatLoginService.handleMiniProgramLogin(code, userInfo);
      respondSuccess(res, result, '小程序登录成功');
    } catch (error) {
      logger.error('[WechatLoginController] 处理微信小程序登录失败:', error);
      respondError(res, 500, 'MINIPROGRAM_LOGIN_ERROR', getErrorMessage(error, '小程序登录失败'));
    }
  }

  async generateOpenPlatformOAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      if (hasValidationError(req, res)) {
        return;
      }

      const redirectUri = toStringOrUndefined(req.query.redirectUri);
      const state = toStringOrUndefined(req.query.state);

      if (!redirectUri) {
        respondError(res, 400, 'MISSING_REDIRECT_URI', '缺少回调地址');
        return;
      }

      const result = wechatLoginService.generateOpenPlatformOAuthUrl(redirectUri, state ?? null);
      respondSuccess(res, result, '开放平台授权URL生成成功');
    } catch (error) {
      logger.error('[WechatLoginController] 生成开放平台授权URL失败:', error);
      respondError(
        res,
        500,
        'GENERATE_OPEN_PLATFORM_URL_ERROR',
        getErrorMessage(error, '生成开放平台授权URL失败')
      );
    }
  }

  async handleOpenPlatformCallback(req: Request, res: Response): Promise<void> {
    try {
      const code = toStringOrUndefined(req.query.code);
      const state = toStringOrUndefined(req.query.state);

      if (!code || !state) {
        respondError(res, 400, 'MISSING_PARAMETERS', '缺少必要参数: code 或 state');
        return;
      }

      const result = await wechatLoginService.handleOpenPlatformCallback(code, state);
      respondSuccess(res, result, '微信扫码登录成功');
    } catch (error) {
      logger.error('[WechatLoginController] 处理开放平台OAuth回调失败:', error);
      respondError(
        res,
        500,
        'OPEN_PLATFORM_CALLBACK_ERROR',
        getErrorMessage(error, '开放平台OAuth回调失败')
      );
    }
  }

  async getUserWechatBindings(req: Request, res: Response): Promise<void> {
    try {
      const userId = ensureAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }

      const bindings = await wechatLoginService.getUserWechatBindings(userId);
      respondSuccess(res, bindings);
    } catch (error) {
      logger.error('[WechatLoginController] 获取用户微信绑定信息失败:', error);
      respondError(res, 500, 'GET_BINDINGS_ERROR', getErrorMessage(error, '获取微信绑定信息失败'));
    }
  }

  async unbindWechat(req: Request, res: Response): Promise<void> {
    try {
      const userId = ensureAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }

      await wechatLoginService.unbindWechat(userId);
      respondSuccess(res, undefined, '微信绑定已解除');
    } catch (error) {
      logger.error('[WechatLoginController] 解除微信绑定失败:', error);
      respondError(res, 500, 'UNBIND_ERROR', getErrorMessage(error, '解除微信绑定失败'));
    }
  }

  async getWechatLoginStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = wechatLoginService.getStats();
      respondSuccess(res, stats);
    } catch (error) {
      logger.error('[WechatLoginController] 获取微信登录统计失败:', error);
      respondError(res, 500, 'GET_STATS_ERROR', '获取统计信息失败');
    }
  }

  async verifyOfficialServer(req: Request, res: Response): Promise<void> {
    try {
      const signature = toStringOrUndefined(req.query.signature);
      const timestamp = toStringOrUndefined(req.query.timestamp);
      const nonce = toStringOrUndefined(req.query.nonce);
      const echostr = toStringOrUndefined(req.query.echostr);

      if (!signature || !timestamp || !nonce || !echostr) {
        res.status(400).send('缺少必要参数');
        return;
      }

      // TODO: 补充微信公众号服务器签名验证逻辑
      res.send(echostr);
    } catch (error) {
      logger.error('[WechatLoginController] 微信公众号服务器验证失败:', error);
      res.status(500).send('验证失败');
    }
  }

  async handleOfficialMessage(req: Request, res: Response): Promise<void> {
    try {
      const signature = toStringOrUndefined(req.query.signature);
      const timestamp = toStringOrUndefined(req.query.timestamp);
      const nonce = toStringOrUndefined(req.query.nonce);

      if (!signature || !timestamp || !nonce) {
        res.status(400).send('缺少必要参数');
        return;
      }

      // TODO: 完成微信公众号消息解析与处理逻辑
      logger.info('[WechatLoginController] 收到微信公众号消息:', req.body);
      res.send('success');
    } catch (error) {
      logger.error('[WechatLoginController] 处理微信公众号消息失败:', error);
      res.status(500).send('处理失败');
    }
  }

  async updateMiniProgramProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = ensureAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }

      const { userInfo } = req.body as UpdateProfileBody;

      if (!userInfo) {
        respondError(res, 400, 'MISSING_USER_INFO', '缺少用户信息');
        return;
      }

      // TODO: 实现用户信息更新逻辑
      logger.info(`[WechatLoginController] 更新小程序用户信息: userId=${userId}`);
      respondSuccess(res, undefined, '用户信息更新成功');
    } catch (error) {
      logger.error('[WechatLoginController] 更新小程序用户信息失败:', error);
      respondError(res, 500, 'UPDATE_PROFILE_ERROR', getErrorMessage(error, '更新用户信息失败'));
    }
  }

  async bindWechatPay(req: Request, res: Response): Promise<void> {
    try {
      const userId = ensureAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }

      const { openid, unionid } = req.body as BindWechatPayBody;

      if (!openid) {
        respondError(res, 400, 'MISSING_OPENID', '缺少openid参数');
        return;
      }

      // TODO: 实现微信支付绑定逻辑
      logger.info(
        `[WechatLoginController] 绑定微信支付: userId=${userId}, openid=${openid}, unionid=${unionid}`
      );
      respondSuccess(res, undefined, '微信支付绑定成功');
    } catch (error) {
      logger.error('[WechatLoginController] 微信支付绑定失败:', error);
      respondError(res, 500, 'BIND_PAY_ERROR', getErrorMessage(error, '微信支付绑定失败'));
    }
  }
}

const wechatLoginController = new WechatLoginController();
export default wechatLoginController;
