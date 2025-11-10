import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import buildingAIAdaptorController from '../controllers/buildingai-adaptor.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/require-permission.middleware.js';
import cacheMiddleware from '../middlewares/cache.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

// BuildingAI Adaptor Controller 方法类型
interface BuildingAIAdaptorControllerType {
  enhanceImage(req: Request, res: Response, next: NextFunction): Promise<void>;
  generateImage(req: Request, res: Response, next: NextFunction): Promise<void>;
  editImage(req: Request, res: Response, next: NextFunction): Promise<void>;
  generateText(req: Request, res: Response, next: NextFunction): Promise<void>;
  translateText(req: Request, res: Response, next: NextFunction): Promise<void>;
  summarizeText(req: Request, res: Response, next: NextFunction): Promise<void>;
  transcribeAudio(req: Request, res: Response, next: NextFunction): Promise<void>;
  analyzeVideo(req: Request, res: Response, next: NextFunction): Promise<void>;
  analyzeData(req: Request, res: Response, next: NextFunction): Promise<void>;
  getSupportedFeatures(req: Request, res: Response, next: NextFunction): Promise<void>;
  getServiceStats(req: Request, res: Response, next: NextFunction): Promise<void>;
  resetStats(req: Request, res: Response, next: NextFunction): Promise<void>;
}

const router = Router();

// 限流器（文本等场景）
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试' }
  }
});

// 公共验证规则
const imageValidationRules = [
  body('imageUrl').optional().isURL().withMessage('imageUrl必须是有效的URL'),
  body('imageBase64').optional().isBase64().withMessage('imageBase64必须是有效的Base64编码')
];

// 图片增强
router.post(
  '/image/enhance',
  authenticate,
  cacheMiddleware.userCache({ ttl: 600 }),
  [
    ...imageValidationRules,
    body().custom((_, { req }) => {
      if (!req.body.imageUrl && !req.body.imageBase64)
        throw new Error('imageUrl和imageBase64必须提供其中一个');
      return true;
    })
  ],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).enhanceImage
);

// 图片生成
router.post(
  '/image/generate',
  authenticate,
  [
    body('prompt')
      .notEmpty()
      .withMessage('prompt不能为空')
      .isLength({ min: 1, max: 1000 })
      .withMessage('prompt长度必须在1-1000字符之间'),
    body('style')
      .optional()
      .isIn(['realistic', 'artistic', 'cartoon', 'abstract'])
      .withMessage('style必须是有效值'),
    body('size')
      .optional()
      .isIn(['512x512', '1024x1024', '1024x1792', '1792x1024'])
      .withMessage('size必须是有效值'),
    body('quality').optional().isIn(['standard', 'hd']).withMessage('quality必须是standard或hd'),
    body('count').optional().isInt({ min: 1, max: 4 }).withMessage('count必须是1-4之间的整数')
  ],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).generateImage
);

// 图片编辑
router.post(
  '/image/edit',
  authenticate,
  [
    ...imageValidationRules,
    body('prompt')
      .notEmpty()
      .withMessage('prompt不能为空')
      .isLength({ min: 1, max: 1000 })
      .withMessage('prompt长度必须在1-1000字符之间'),
    body('count').optional().isInt({ min: 1, max: 4 }).withMessage('count必须是1-4之间的整数')
  ],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).editImage
);

// 文本生成
router.post(
  '/text/generate',
  authenticate,
  apiLimiter,
  [body('prompt').notEmpty().withMessage('prompt不能为空').isLength({ min: 1, max: 1000 })],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).generateText
);

// 文本翻译
router.post(
  '/text/translate',
  authenticate,
  [
    body('text').notEmpty().withMessage('text不能为空').isLength({ min: 1, max: 10000 }),
    body('sourceLanguage').optional().isLength({ min: 2, max: 10 }),
    body('targetLanguage')
      .notEmpty()
      .withMessage('targetLanguage不能为空')
      .isLength({ min: 2, max: 10 }),
    body('format').optional().isIn(['text', 'html', 'markdown'])
  ],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).translateText
);

// 文本摘要
router.post(
  '/text/summarize',
  authenticate,
  [
    body('text').notEmpty().withMessage('text不能为空').isLength({ min: 100, max: 50000 }),
    body('length').optional().isIn(['short', 'medium', 'long']),
    body('style').optional().isIn(['professional', 'casual', 'academic'])
  ],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).summarizeText
);

// 音频转录
router.post(
  '/audio/transcribe',
  authenticate,
  [
    body('audioUrl').optional().isURL(),
    body('audioBase64').optional().isBase64(),
    body('language').optional().isLength({ min: 2, max: 10 }),
    body('outputFormat').optional().isIn(['text', 'srt', 'vtt']),
    body().custom((_, { req }) => {
      if (!req.body.audioUrl && !req.body.audioBase64)
        throw new Error('audioUrl和audioBase64必须提供其中一个');
      return true;
    })
  ],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).transcribeAudio
);

// 视频分析
router.post(
  '/video/analyze',
  authenticate,
  [
    body('videoUrl').optional().isURL(),
    body('videoBase64').optional().isBase64(),
    body('analysisType').optional().isIn(['content', 'scene', 'object', 'audio']),
    body('detailLevel').optional().isIn(['low', 'medium', 'high']),
    body().custom((_, { req }) => {
      if (!req.body.videoUrl && !req.body.videoBase64)
        throw new Error('videoUrl和videoBase64必须提供其中一个');
      return true;
    })
  ],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).analyzeVideo
);

// 数据分析
router.post(
  '/data/analyze',
  authenticate,
  [
    body('data').notEmpty().withMessage('data不能为空').isObject().withMessage('data必须是对象'),
    body('analysisType').optional().isIn(['statistical', 'predictive', 'descriptive']),
    body('outputFormat').optional().isIn(['json', 'csv', 'xml'])
  ],
  validate,
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).analyzeData
);

// 获取支持的功能（带缓存）
router.get(
  '/features',
  authenticate,
  cacheMiddleware.featureCache({ ttl: 3600 }),
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).getSupportedFeatures
);

// 管理端：AI 服务统计/重置
router.get(
  '/stats',
  authenticate,
  requireRole(['admin']),
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).getServiceStats
);
router.post(
  '/reset-stats',
  authenticate,
  requireRole(['admin']),
  (buildingAIAdaptorController as unknown as BuildingAIAdaptorControllerType).resetStats
);

export default router;
