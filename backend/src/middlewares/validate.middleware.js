const Joi = require('joi');
const { createErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 验证MCP终端数据
 */
const validateMcpEndpoint = (req, res, next) => {
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
    return res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', '数据验证失败', error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })))
    );
  }

  next();
};

/**
 * 验证Provider数据
 */
const validateProvider = (req, res, next) => {
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
    return res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', '数据验证失败', error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })))
    );
  }

  next();
};

/**
 * 验证Feature数据
 */
const validateFeature = (req, res, next) => {
  const schema = Joi.object({
    key: Joi.string().min(1).max(50).pattern(/^[a-z0-9_-]+$/).required().messages({
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
    return res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', '数据验证失败', error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })))
    );
  }

  next();
};

/**
 * 验证Pipeline数据
 */
const validatePipeline = (req, res, next) => {
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
    return res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', '数据验证失败', error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })))
    );
  }

  next();
};

/**
 * 验证Prompt模板数据
 */
const validatePromptTemplate = (req, res, next) => {
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
    variables: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('string', 'number', 'boolean', 'object', 'array').default('string'),
      description: Joi.string().optional().allow(''),
      required: Joi.boolean().default(false),
      default: Joi.any().optional()
    })).default([]).optional(),
    tags: Joi.array().items(Joi.string()).default([]).optional(),
    enabled: Joi.boolean().default(true).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    logger.warn('Prompt模板数据验证失败:', error.details);
    return res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', '数据验证失败', error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })))
    );
  }

  next();
};

module.exports = {
  validateMcpEndpoint,
  validateProvider,
  validateFeature,
  validatePipeline,
  validatePromptTemplate
};