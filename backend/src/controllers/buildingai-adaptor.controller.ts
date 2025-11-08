import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { Result, ValidationError } from 'express-validator';
import logger from '../utils/logger.js';
import buildingAIAdaptorService from '../services/buildingai-adaptor.service.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES, type ErrorCode } from '../config/error-codes.js';
import type { SupportedLanguageCode } from '../config/i18n-messages.js';

type ImageEnhancePayload = {
  imageUrl?: string;
  imageBase64?: string;
  level?: string;
  outputFormat?: string;
};

type ImageGeneratePayload = {
  prompt?: string;
  style?: string;
  size?: string;
  quality?: string;
  count?: number;
};

type ImageEditPayload = {
  imageUrl?: string;
  imageBase64?: string;
  maskUrl?: string;
  maskBase64?: string;
  prompt?: string;
  count?: number;
};

type TextGeneratePayload = {
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

type TextTranslatePayload = {
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  format?: string;
};

type TextSummarizePayload = {
  text?: string;
  length?: string;
  style?: string;
};

type AudioTranscribePayload = {
  audioUrl?: string;
  audioBase64?: string;
  language?: string;
  outputFormat?: string;
};

type VideoAnalyzePayload = {
  videoUrl?: string;
  videoBase64?: string;
  analysisType?: string;
  detailLevel?: string;
};

type DataAnalyzePayload = {
  data?: unknown;
  analysisType?: string;
  outputFormat?: string;
};

class BuildingAIAdaptorController {
  async enhanceImage(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const {
        imageUrl,
        imageBase64,
        level = 'medium',
        outputFormat = 'png'
      } = req.body as ImageEnhancePayload;

      const result = await buildingAIAdaptorService.callAPI('image_enhance', {
        imageUrl,
        imageBase64,
        level,
        outputFormat
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(req, 'ai.image_enhanced', 'Image enhanced successfully'),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('enhance image', error, req, res, ERROR_CODES.AI_PROCESSING_FAILED);
    }
  }

  async generateImage(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const {
        prompt,
        style = 'realistic',
        size = '1024x1024',
        quality = 'standard',
        count = 1
      } = req.body as ImageGeneratePayload;

      const result = await buildingAIAdaptorService.callAPI('image_generate', {
        prompt,
        style,
        size,
        quality,
        count
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(
          req,
          'ai.image_generated',
          'Image generated successfully'
        ),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('generate image', error, req, res, ERROR_CODES.AI_PROCESSING_FAILED);
    }
  }

  async editImage(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const {
        imageUrl,
        imageBase64,
        maskUrl,
        maskBase64,
        prompt,
        count = 1
      } = req.body as ImageEditPayload;

      const result = await buildingAIAdaptorService.callAPI('image_edit', {
        imageUrl,
        imageBase64,
        maskUrl,
        maskBase64,
        prompt,
        count
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(req, 'ai.image_edited', 'Image edited successfully'),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('edit image', error, req, res, ERROR_CODES.AI_PROCESSING_FAILED);
    }
  }

  async generateText(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const {
        prompt,
        maxTokens = 500,
        temperature = 0.7,
        model = 'gpt-3.5-turbo'
      } = req.body as TextGeneratePayload;

      const result = await buildingAIAdaptorService.callAPI('text_generate', {
        prompt,
        maxTokens,
        temperature,
        model
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(req, 'ai.text_generated', 'Text generated successfully'),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('generate text', error, req, res, ERROR_CODES.AI_PROCESSING_FAILED);
    }
  }

  async translateText(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const {
        text,
        sourceLanguage = 'auto',
        targetLanguage,
        format = 'text'
      } = req.body as TextTranslatePayload;

      const result = await buildingAIAdaptorService.callAPI('text_translate', {
        text,
        sourceLanguage,
        targetLanguage,
        format
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(
          req,
          'ai.text_translated',
          'Text translated successfully'
        ),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('translate text', error, req, res, ERROR_CODES.AI_PROCESSING_FAILED);
    }
  }

  async summarizeText(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const { text, length = 'medium', style = 'professional' } = req.body as TextSummarizePayload;

      const result = await buildingAIAdaptorService.callAPI('text_summarize', {
        text,
        length,
        style
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(
          req,
          'ai.text_summarized',
          'Text summarized successfully'
        ),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('summarize text', error, req, res, ERROR_CODES.AI_PROCESSING_FAILED);
    }
  }

  async transcribeAudio(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const {
        audioUrl,
        audioBase64,
        language = 'auto',
        outputFormat = 'text'
      } = req.body as AudioTranscribePayload;

      const result = await buildingAIAdaptorService.callAPI('audio_transcribe', {
        audioUrl,
        audioBase64,
        language,
        outputFormat
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(
          req,
          'ai.audio_transcribed',
          'Audio transcribed successfully'
        ),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError(
        'transcribe audio',
        error,
        req,
        res,
        ERROR_CODES.AI_PROCESSING_FAILED
      );
    }
  }

  async analyzeVideo(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const {
        videoUrl,
        videoBase64,
        analysisType = 'content',
        detailLevel = 'medium'
      } = req.body as VideoAnalyzePayload;

      const result = await buildingAIAdaptorService.callAPI('video_analyze', {
        videoUrl,
        videoBase64,
        analysisType,
        detailLevel
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(req, 'ai.video_analyzed', 'Video analyzed successfully'),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('analyze video', error, req, res, ERROR_CODES.AI_PROCESSING_FAILED);
    }
  }

  async analyzeData(req: Request, res: Response): Promise<void> {
    try {
      if (this.hasValidationError(req, res)) {
        return;
      }

      const {
        data,
        analysisType = 'statistical',
        outputFormat = 'json'
      } = req.body as DataAnalyzePayload;

      const result = await buildingAIAdaptorService.callAPI('data_analyze', {
        data,
        analysisType,
        outputFormat
      });

      res.json({
        success: true,
        data: result,
        message: this.getLocalizedMessage(req, 'ai.data_analyzed', 'Data analyzed successfully'),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('analyze data', error, req, res, ERROR_CODES.AI_PROCESSING_FAILED);
    }
  }

  async getSupportedFeatures(req: Request, res: Response): Promise<void> {
    try {
      const features = buildingAIAdaptorService.getSupportedFeatures() as string[];
      const timestamp = this.getTimestamp();

      res.json({
        success: true,
        data: {
          features: features.map((feature) => ({
            key: feature,
            name: BuildingAIAdaptorController.FEATURE_DISPLAY_NAMES[feature] ?? feature,
            description: BuildingAIAdaptorController.FEATURE_DESCRIPTIONS[feature] ?? '',
            category: BuildingAIAdaptorController.FEATURE_CATEGORIES[feature] ?? 'other'
          })),
          count: features.length
        },
        timestamp
      });
    } catch (error) {
      this.handleServiceError(
        'get supported features',
        error,
        req,
        res,
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getServiceStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = buildingAIAdaptorService.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError(
        'get service stats',
        error,
        req,
        res,
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }
  }

  async resetStats(req: Request, res: Response): Promise<void> {
    try {
      buildingAIAdaptorService.resetStats();

      res.json({
        success: true,
        message: this.getLocalizedMessage(
          req,
          'ai.stats_reset',
          'AI service statistics reset successfully'
        ),
        timestamp: this.getTimestamp()
      });
    } catch (error) {
      this.handleServiceError('reset stats', error, req, res, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  private static readonly FEATURE_DISPLAY_NAMES: Record<string, string> = {
    image_enhance: '图片增强',
    image_generate: '图片生成',
    image_edit: '图片编辑',
    text_generate: '文本生成',
    text_translate: '文本翻译',
    text_summarize: '文本摘要',
    audio_transcribe: '音频转录',
    video_analyze: '视频分析',
    data_analyze: '数据分析'
  };

  private static readonly FEATURE_DESCRIPTIONS: Record<string, string> = {
    image_enhance: '增强图片质量，提高清晰度和细节',
    image_generate: '根据文本描述生成高质量图片',
    image_edit: '编辑和修改现有图片',
    text_generate: '生成各种类型的文本内容',
    text_translate: '翻译文本到多种语言',
    text_summarize: '生成长文本的摘要和要点',
    audio_transcribe: '将音频转换为文本',
    video_analyze: '分析视频内容和特征',
    data_analyze: '对数据进行分析和处理'
  };

  private static readonly FEATURE_CATEGORIES: Record<string, string> = {
    image_enhance: 'image_processing',
    image_generate: 'ai_generation',
    image_edit: 'image_processing',
    text_generate: 'ai_generation',
    text_translate: 'text_processing',
    text_summarize: 'text_processing',
    audio_transcribe: 'audio_processing',
    video_analyze: 'video_processing',
    data_analyze: 'data_analysis'
  };

  private hasValidationError(req: Request, res: Response): boolean {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return false;
    }

    this.respondValidationError(req, res, errors);
    return true;
  }

  private respondValidationError(
    req: Request,
    res: Response,
    errors: Result<ValidationError>
  ): void {
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.DATA_VALIDATION_FAILED,
        message:
          req.i18n?.getErrorMessage?.(ERROR_CODES.DATA_VALIDATION_FAILED) ?? 'Validation failed',
        details: errors.array()
      },
      timestamp: this.getTimestamp()
    });
  }

  private handleServiceError(
    context: string,
    error: unknown,
    req: Request,
    res: Response,
    defaultCode: ErrorCode
  ): void {
    logger.error(`[BuildingAIAdaptorController] Failed to ${context}:`, error);
    const appError = AppError.fromError(error, defaultCode);
    const locale = this.getLocale(req);
    res.status(appError.statusCode).json(appError.toJSON(locale));
  }

  private getLocalizedMessage(req: Request, key: string, fallback: string): string {
    return req.i18n?.getMessage?.(key) ?? fallback;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private getLocale(req: Request): SupportedLanguageCode | undefined {
    const locale = req.i18n?.locale;
    if (!locale) {
      return undefined;
    }
    return locale as SupportedLanguageCode;
  }
}

const buildingAIAdaptorController = new BuildingAIAdaptorController();
export default buildingAIAdaptorController;
