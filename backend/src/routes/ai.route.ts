/**
 * AI路由 - 统一推理API端点
 * 艹，这个憨批路由提供统一的Chat/Completions API，支持SSE流式输出！
 *
 * 端点：
 * - POST /ai/chat - Chat Completions（支持SSE流式）
 * - POST /ai/completions - 文本Completions
 */

import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import aiGateway, { ChatRequest } from '../services/ai-gateway.service';
import { authenticateToken } from '../middlewares/auth.middleware';
import logger from '../utils/logger';

const router = express.Router();

/**
 * 验证中间件
 */
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
      requestId: (req as any).id,
    });
  }
  next();
};

/**
 * Chat Completions API
 *
 * POST /ai/chat
 *
 * Body:
 * - model: string (required)
 * - messages: ChatMessage[] (required)
 * - temperature: number (optional, 0-2, default 1)
 * - max_tokens: number (optional)
 * - top_p: number (optional, 0-1, default 1)
 * - stream: boolean (optional, default false)
 * - tools: any[] (optional)
 * - tool_choice: string | object (optional)
 * - provider: string (optional, Provider引用)
 */
router.post(
  '/chat',
  authenticateToken,
  [
    body('model')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('model is required'),
    body('messages')
      .isArray({ min: 1 })
      .withMessage('messages must be a non-empty array'),
    body('messages.*.role')
      .isIn(['system', 'user', 'assistant', 'tool'])
      .withMessage('message role must be system, user, assistant or tool'),
    body('messages.*.content')
      .isString()
      .withMessage('message content must be a string'),
    body('temperature')
      .optional()
      .isFloat({ min: 0, max: 2 })
      .withMessage('temperature must be between 0 and 2'),
    body('max_tokens')
      .optional()
      .isInt({ min: 1 })
      .withMessage('max_tokens must be a positive integer'),
    body('top_p')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('top_p must be between 0 and 1'),
    body('stream')
      .optional()
      .isBoolean()
      .withMessage('stream must be a boolean'),
    body('provider')
      .optional()
      .isString()
      .trim()
      .withMessage('provider must be a string'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;
      const chatRequest: ChatRequest = req.body;
      const { provider } = req.body;

      logger.info(
        `[AIRoute] Chat请求: userId=${userId} model=${chatRequest.model} ` +
        `stream=${chatRequest.stream || false}`
      );

      // 流式响应
      if (chatRequest.stream) {
        // 设置SSE响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

        // 获取流式EventEmitter
        const emitter = await aiGateway.chatStream(chatRequest, provider);

        // 监听data事件
        emitter.on('data', (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        });

        // 监听end事件
        emitter.on('end', () => {
          res.write('data: [DONE]\n\n');
          res.end();
        });

        // 监听error事件
        emitter.on('error', (error: Error) => {
          logger.error('[AIRoute] Chat流式响应错误:', error);

          // 发送错误尾帧
          res.write(
            `data: ${JSON.stringify({
              error: {
                message: error.message,
                type: 'stream_error',
              },
            })}\n\n`
          );
          res.end();
        });

        // 客户端断开连接
        req.on('close', () => {
          logger.info('[AIRoute] 客户端断开连接');
          emitter.removeAllListeners();
        });

      } else {
        // 非流式响应
        const response = await aiGateway.chat(chatRequest, provider);

        res.json({
          success: true,
          data: response,
          requestId: (req as any).id,
        });
      }

    } catch (error: any) {
      logger.error('[AIRoute] Chat请求失败:', error);
      next(error);
    }
  }
);

/**
 * Text Completions API（兼容性端点）
 *
 * POST /ai/completions
 *
 * Body:
 * - model: string (required)
 * - prompt: string (required)
 * - temperature: number (optional)
 * - max_tokens: number (optional)
 * - stream: boolean (optional)
 */
router.post(
  '/completions',
  authenticateToken,
  [
    body('model')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('model is required'),
    body('prompt')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('prompt is required'),
    body('temperature')
      .optional()
      .isFloat({ min: 0, max: 2 })
      .withMessage('temperature must be between 0 and 2'),
    body('max_tokens')
      .optional()
      .isInt({ min: 1 })
      .withMessage('max_tokens must be a positive integer'),
    body('stream')
      .optional()
      .isBoolean()
      .withMessage('stream must be a boolean'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;
      const { model, prompt, temperature, max_tokens, stream, provider } = req.body;

      logger.info(
        `[AIRoute] Completions请求: userId=${userId} model=${model} ` +
        `stream=${stream || false}`
      );

      // 转换为Chat格式
      const chatRequest: ChatRequest = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens,
        stream,
      };

      // 流式响应
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const emitter = await aiGateway.chatStream(chatRequest, provider);

        emitter.on('data', (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        });

        emitter.on('end', () => {
          res.write('data: [DONE]\n\n');
          res.end();
        });

        emitter.on('error', (error: Error) => {
          logger.error('[AIRoute] Completions流式响应错误:', error);
          res.write(
            `data: ${JSON.stringify({
              error: {
                message: error.message,
                type: 'stream_error',
              },
            })}\n\n`
          );
          res.end();
        });

        req.on('close', () => {
          emitter.removeAllListeners();
        });

      } else {
        // 非流式响应
        const response = await aiGateway.chat(chatRequest, provider);

        res.json({
          success: true,
          data: response,
          requestId: (req as any).id,
        });
      }

    } catch (error: any) {
      logger.error('[AIRoute] Completions请求失败:', error);
      next(error);
    }
  }
);

/**
 * 健康检查
 *
 * GET /ai/health
 */
router.get(
  '/health',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: {
          service: 'ai-gateway',
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        requestId: (req as any).id,
      });

    } catch (error: any) {
      logger.error('[AIRoute] 健康检查失败:', error);
      next(error);
    }
  }
);

export default router;
