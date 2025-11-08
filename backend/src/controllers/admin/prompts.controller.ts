import type { NextFunction, Request, Response } from 'express';
import {
  renderTemplate,
  validateTemplate,
  extractVariables,
  SAFE_HELPERS
} from '../../services/prompt.service.js';
import logger from '../../utils/logger.js';

type PreviewRequestBody = {
  template?: unknown;
  variables?: unknown;
};

type ValidateRequestBody = {
  template?: unknown;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const badRequest = (res: Response, message: string) =>
  res.status(400).json({
    success: false,
    error: {
      code: 4001,
      message
    }
  });

const handleError = (next: NextFunction, context: string, error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`[PromptsController] ${context}`, err);
  next(err);
};

export const previewPrompt = async (
  req: Request<unknown, unknown, PreviewRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { template, variables = {} } = req.body ?? {};

    if (typeof template !== 'string' || template.trim().length === 0) {
      badRequest(res, '缺少必要参数: template (字符串)');
      return;
    }

    if (!isPlainObject(variables)) {
      badRequest(res, 'variables 必须是对象');
      return;
    }

    const result = renderTemplate(template, variables);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 4002,
          message: `模板渲染失败: ${result.error ?? '未知错误'}`
        }
      });
      return;
    }

    logger.info('[PromptsController] 模板预览成功', {
      templateLength: template.length,
      missingVars: result.missingVars?.length ?? 0
    });

    res.json({
      success: true,
      data: {
        result: result.result ?? '',
        missingVars: result.missingVars ?? [],
        availableHelpers: Object.keys(SAFE_HELPERS)
      }
    });
  } catch (error) {
    handleError(next, '预览失败', error);
  }
};

export const validatePrompt = async (
  req: Request<unknown, unknown, ValidateRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { template } = req.body ?? {};

    if (typeof template !== 'string' || template.trim().length === 0) {
      badRequest(res, '缺少必要参数: template');
      return;
    }

    const validation = validateTemplate(template);
    if (!validation.valid) {
      res.json({
        success: true,
        data: {
          valid: false,
          error: validation.error
        }
      });
      return;
    }

    const variables = extractVariables(template);

    res.json({
      success: true,
      data: {
        valid: true,
        variables
      }
    });
  } catch (error) {
    handleError(next, '校验失败', error);
  }
};

const helperDescriptions: Record<string, string> = {
  eq: '相等判断: {{#if (eq a b)}}',
  neq: '不等判断: {{#if (neq a b)}}',
  lt: '小于: {{#if (lt a b)}}',
  gt: '大于: {{#if (gt a b)}}',
  lte: '小于等于: {{#if (lte a b)}}',
  gte: '大于等于: {{#if (gte a b)}}',
  and: '逻辑与: {{#if (and a b c)}}',
  or: '逻辑或: {{#if (or a b c)}}',
  not: '逻辑非: {{#if (not a)}}',
  uppercase: '转大写: {{uppercase str}}',
  lowercase: '转小写: {{lowercase str}}',
  capitalize: '首字母大写: {{capitalize str}}',
  trim: '去空格: {{trim str}}',
  truncate: '截断: {{truncate str 100}}',
  join: '数组连接: {{join arr ","}}',
  length: '长度: {{length arr}}',
  first: '首元素: {{first arr}}',
  last: '尾元素: {{last arr}}',
  json: 'JSON化: {{json obj}}',
  jsonPretty: 'JSON美化: {{jsonPretty obj}}',
  formatDate: '格式化日期: {{formatDate date "YYYY-MM-DD"}}',
  add: '加法: {{add a b}}',
  subtract: '减法: {{subtract a b}}',
  multiply: '乘法: {{multiply a b}}',
  divide: '除法: {{divide a b}}',
  default: '默认值: {{default value "默认"}}'
};

const helperCategories: Record<string, string[]> = {
  logic: ['eq', 'neq', 'lt', 'gt', 'lte', 'gte', 'and', 'or', 'not'],
  string: ['uppercase', 'lowercase', 'capitalize', 'trim', 'truncate'],
  array: ['join', 'length', 'first', 'last'],
  json: ['json', 'jsonPretty'],
  date: ['formatDate'],
  math: ['add', 'subtract', 'multiply', 'divide'],
  utility: ['default']
};

const getCategoryByHelper = (name: string): string => {
  for (const [category, helpers] of Object.entries(helperCategories)) {
    if (helpers.includes(name)) {
      return category;
    }
  }
  return 'other';
};

export const getHelpers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const helpers = Object.keys(SAFE_HELPERS).map((name) => ({
      name,
      description: helperDescriptions[name] ?? name,
      category: getCategoryByHelper(name)
    }));

    res.json({
      success: true,
      data: {
        helpers,
        total: helpers.length
      }
    });
  } catch (error) {
    handleError(next, '获取helpers失败', error);
  }
};

const promptsController = {
  previewPrompt,
  validatePrompt,
  getHelpers
};

export default promptsController;
