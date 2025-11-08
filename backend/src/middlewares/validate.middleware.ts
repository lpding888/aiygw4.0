/**
 * 数据验证中间件
 * 艹，真正的TypeScript版本，使用Joi进行数据验证！
 */

// @ts-ignore - 艹，@hapi/joi这个憨批库没有类型定义！
import * as Joi from '@hapi/joi';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { createErrorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Express-validator的通用验证中间件
 * 艹，这个是处理express-validator验证结果的！
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('数据验证失败:', errors.array());
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_ERROR',
        '数据验证失败',
        errors.array().map((err: any) => ({
          field: err.path || err.param,
          message: err.msg
        }))
      )
    );
    return;
  }
  next();
};

/**
 * 验证MCP终端数据
 */
export const validateMcpEndpoint = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'string.empty': '终端名称不能为空',
      'string.max': '终端名称不能超过100个字符',
      'any.required': '终端名称是必填项'
    }),
    description: Joi.string().max(500).optional().allow('').messages({
      'string.max': '描述不能超过500个字符'
    }),
    provider: Joi.string().min(1).max(50).required().messages({
      'string.empty': '供应商不能为空',
      'string.max': '供应商名称不能超过50个字符',
      'any.required': '供应商是必填项'
    }),
    endpoint_url: Joi.string().uri().required().messages({
      'string.uri': '终端URL格式不正确',
      'any.required': '终端URL是必填项'
    }),
    protocol_version: Joi.string().default('2024-11-05').optional(),
    capabilities: Joi.object().default({}).optional(),
    auth_type: Joi.string().valid('none', 'bearer', 'api_key').default('none').messages({
      'any.only': '认证类型必须是 none、bearer 或 api_key'
    }),
    auth_secret: Joi.string().when('auth_type', {
      is: Joi.string().valid('bearer', 'api_key'),
      then: Joi.required().messages({
        'any.required': '使用bearer或api_key认证时，认证密钥是必填项'
      }),
      otherwise: Joi.optional().allow('')
    }),
    metadata: Joi.object().default({}).optional(),
    enabled: Joi.boolean().default(true).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    logger.warn('MCP终端数据验证失败:', error.details);
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_ERROR',
        '数据验证失败',
        error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      )
    );
    return;
  }

  next();
};

/**
 * 验证Provider数据
 */
export const validateProvider = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'string.empty': '供应商名称不能为空',
      'string.max': '供应商名称不能超过100个字符',
      'any.required': '供应商名称是必填项'
    }),
    description: Joi.string().max(500).optional().allow('').messages({
      'string.max': '描述不能超过500个字符'
    }),
    type: Joi.string().valid('ai', 'database', 'storage', 'payment', 'other').required().messages({
      'any.only': '供应商类型必须是 ai、database、storage、payment 或 other',
      'any.required': '供应商类型是必填项'
    }),
    config: Joi.object().default({}).optional(),
    enabled: Joi.boolean().default(true).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    logger.warn('Provider数据验证失败:', error.details);
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_ERROR',
        '数据验证失败',
        error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      )
    );
    return;
  }

  next();
};

/**
 * 验证Feature数据
 */
export const validateFeature = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    key: Joi.string()
      .min(1)
      .max(50)
      .pattern(/^[a-z0-9_-]+$/)
      .required()
      .messages({
        'string.empty': '功能键不能为空',
        'string.max': '功能键不能超过50个字符',
        'string.pattern.base': '功能键只能包含小写字母、数字、下划线和连字符',
        'any.required': '功能键是必填项'
      }),
    name: Joi.string().min(1).max(100).required().messages({
      'string.empty': '功能名称不能为空',
      'string.max': '功能名称不能超过100个字符',
      'any.required': '功能名称是必填项'
    }),
    description: Joi.string().max(500).optional().allow('').messages({
      'string.max': '描述不能超过500个字符'
    }),
    category: Joi.string().min(1).max(50).required().messages({
      'string.empty': '功能分类不能为空',
      'string.max': '功能分类不能超过50个字符',
      'any.required': '功能分类是必填项'
    }),
    config: Joi.object().default({}).optional(),
    enabled: Joi.boolean().default(true).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    logger.warn('Feature数据验证失败:', error.details);
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_ERROR',
        '数据验证失败',
        error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      )
    );
    return;
  }

  next();
};

/**
 * 验证Pipeline数据
 */
export const validatePipeline = (req: Request, res: Response, next: NextFunction): void => {
  const nodeSchema = Joi.object({
    id: Joi.string().required(),
    type: Joi.string().required(),
    name: Joi.string().required(),
    config: Joi.object().default({}),
    position: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required()
    }).required()
  });

  const edgeSchema = Joi.object({
    id: Joi.string().required(),
    source: Joi.string().required(),
    target: Joi.string().required(),
    condition: Joi.object().default({})
  });

  const schema = Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'string.empty': '流程名称不能为空',
      'string.max': '流程名称不能超过100个字符',
      'any.required': '流程名称是必填项'
    }),
    description: Joi.string().max(500).optional().allow('').messages({
      'string.max': '描述不能超过500个字符'
    }),
    nodes: Joi.array().items(nodeSchema).min(1).required().messages({
      'array.min': '流程至少需要包含1个节点',
      'any.required': '流程节点是必填项'
    }),
    edges: Joi.array().items(edgeSchema).default([]).optional(),
    variables: Joi.object().pattern(Joi.string(), Joi.any()).default({}).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    logger.warn('Pipeline数据验证失败:', error.details);
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_ERROR',
        '数据验证失败',
        error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      )
    );
    return;
  }

  next();
};

/**
 * 验证Prompt模板数据
 */
export const validatePromptTemplate = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'string.empty': '模板名称不能为空',
      'string.max': '模板名称不能超过100个字符',
      'any.required': '模板名称是必填项'
    }),
    description: Joi.string().max(500).optional().allow('').messages({
      'string.max': '描述不能超过500个字符'
    }),
    category: Joi.string().min(1).max(50).required().messages({
      'string.empty': '模板分类不能为空',
      'string.max': '模板分类不能超过50个字符',
      'any.required': '模板分类是必填项'
    }),
    template: Joi.string().min(1).required().messages({
      'string.empty': '模板内容不能为空',
      'any.required': '模板内容是必填项'
    }),
    variables: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required(),
          type: Joi.string()
            .valid('string', 'number', 'boolean', 'object', 'array')
            .default('string'),
          description: Joi.string().optional().allow(''),
          required: Joi.boolean().default(false),
          default: Joi.any().optional()
        })
      )
      .default([])
      .optional(),
    tags: Joi.array().items(Joi.string()).default([]).optional(),
    enabled: Joi.boolean().default(true).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    logger.warn('Prompt模板数据验证失败:', error.details);
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_ERROR',
        '数据验证失败',
        error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      )
    );
    return;
  }

  next();
};
