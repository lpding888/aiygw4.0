const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');

// 创建Express应用
const app = express();

// 生产环境HTTPS强制跳转
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    // 设置HSTS响应头 (强制HTTPS一年)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));

// 防止NoSQL注入
app.use(mongoSanitize());

// CORS配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://aizhao.icu', 'https://www.aizhao.icu']
    : '*',
  credentials: true
}));

// 请求解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 日志中间件
app.use(morgan('combined', { stream: logger.stream }));

// 根路径 - API文档
app.get('/', (req, res) => {
  res.json({
    message: '欢迎使用AI照片处理后端API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: {
        path: '/health',
        method: 'GET',
        description: '健康检查'
      },
      auth: {
        path: '/api/auth/*',
        description: '用户认证相关接口'
      },
      features: {
        path: '/api/features',
        method: 'GET',
        description: '获取可用功能列表',
        requiresAuth: true
      },
      createTask: {
        path: '/api/task/create-by-feature',
        method: 'POST',
        description: '创建任务',
        requiresAuth: true
      },
      assets: {
        path: '/api/assets',
        method: 'GET',
        description: '获取用户素材库',
        requiresAuth: true
      },
      admin: {
        path: '/api/admin/*',
        description: '管理员接口',
        requiresAuth: true,
        requiresAdmin: true
      },
      pipelineSchemas: {
        path: '/api/pipeline-schemas/*',
        description: 'Pipeline模板管理接口',
        requiresAuth: true
      },
      pipelineExecutions: {
        path: '/api/pipeline-executions/*',
        description: 'Pipeline执行管理接口',
        requiresAuth: true
      },
      mcpEndpoints: {
        path: '/api/mcp-endpoints/*',
        description: 'MCP端点管理接口',
        requiresAuth: true
      },
      promptTemplates: {
        path: '/api/prompt-templates/*',
        description: 'Prompt模板管理接口',
        requiresAuth: true
      }
    },
    documentation: '请使用具体的API端点,根路径仅用于查看可用接口列表'
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// API路由
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/membership', require('./routes/membership.routes'));
app.use('/api/media', require('./routes/media.routes'));
app.use('/api/task', require('./routes/task.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/system-config', require('./routes/systemConfig.routes'));
app.use('/api/features', require('./routes/feature.routes'));
app.use('/api/scf', require('./routes/scfCallback.routes'));
app.use('/api/assets', require('./routes/asset.routes'));
app.use('/api/distribution', require('./routes/distribution.routes')); // 分销代理路由

// CMS系统路由
app.use('/api/ui', require('./routes/ui.routes'));
app.use('/api/cms/features', require('./routes/cmsFeatures.routes'));
app.use('/api/cms/providers', require('./routes/cmsProviders.routes'));
app.use('/api/pipeline-schemas', require('./routes/pipelineSchemas.routes'));
app.use('/api/pipeline-executions', require('./routes/pipelineExecution.routes'));
app.use('/api/mcp-endpoints', require('./routes/mcpEndpoints.routes'));
app.use('/api/prompt-templates', require('./routes/promptTemplates.routes'));

// 404处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

module.exports = app;
