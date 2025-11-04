/**
 * Canvas相关类型定义
 * 艹，类型定义必须完整准确，不能有半点马虎！
 *
 * @author 老王
 */

// 画布模式
export type CanvasMode = 'inpaint' | 'recolor' | 'dewrinkle';

// 画布状态接口
export interface CanvasState {
  isDrawing: boolean;
  backgroundImage: string | null;
  masks: CanvasMask[];
  currentMask: CanvasMask | null;
  zoom: number;
  pan: { x: number; y: number };
}

// 遮罩接口
export interface CanvasMask {
  id: string;
  path: any; // Fabric.js Path对象
  type: CanvasMode;
  prompt: string;
  createdAt: string;
}

// 处理参数接口
export interface ProcessingParameters {
  mode: CanvasMode;
  prompt: string;
  strength: number;
  guidance: number;
  steps: number;
  seed: number;
  mask: string; // Base64格式的mask图片
}

// 处理结果接口
export interface ProcessingResult {
  id: string;
  imageUrl: string;
  maskUrl?: string;
  mode: CanvasMode;
  parameters: Omit<ProcessingParameters, 'mask'>;
  createdAt: string;
  processingTime?: number;
  quality?: number;
}

// 处理模式配置接口
export interface ProcessingModeConfig {
  key: CanvasMode;
  name: string;
  description: string;
  promptRequired: boolean;
  icon: string;
  defaultParameters: {
    strength: number;
    guidance: number;
    steps: number;
  };
}

// Canvas任务请求接口
export interface CanvasTaskRequest {
  parameters: ProcessingParameters;
  files: string[];
  toolKey: string;
}

// Canvas任务响应接口
export interface CanvasTaskResponse {
  taskId: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
  message: string;
}

// 画笔设置接口
export interface BrushSettings {
  width: number;
  color: string;
  opacity: number;
  hardness: number;
}

// 图像处理选项接口
export interface ImageProcessingOptions {
  quality: number;
  format: 'png' | 'jpeg' | 'webp';
  multiplier: number;
}

// 错误类型
export type CanvasErrorType =
  | 'NO_BACKGROUND_IMAGE'
  | 'NO_MASKS'
  | 'INVALID_MASK'
  | 'PROCESSING_FAILED'
  | 'UPLOAD_FAILED'
  | 'NETWORK_ERROR'
  | 'CANVAS_INIT_FAILED';

// Canvas错误接口
export interface CanvasError {
  type: CanvasErrorType;
  message: string;
  details?: any;
  timestamp: string;
}

// 导出选项接口
export interface ExportOptions {
  format: 'png' | 'jpeg' | 'webp';
  quality: number;
  includeMask: boolean;
  includeBackground: boolean;
  scale: number;
}

// 处理进度接口
export interface ProcessingProgress {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
  result?: {
    images: string[];
    metadata: any;
  };
}

// 默认处理模式配置
export const DEFAULT_PROCESSING_MODES: ProcessingModeConfig[] = [
  {
    key: 'inpaint',
    name: '智能补全',
    description: 'AI智能填充圈选区域',
    promptRequired: true,
    icon: '🎨',
    defaultParameters: {
      strength: 0.8,
      guidance: 7.5,
      steps: 20
    }
  },
  {
    key: 'recolor',
    name: '智能换色',
    description: 'AI为圈选区域更换颜色',
    promptRequired: true,
    icon: '🎨',
    defaultParameters: {
      strength: 0.9,
      guidance: 7.0,
      steps: 25
    }
  },
  {
    key: 'dewrinkle',
    name: '智能去皱',
    description: 'AI去除圈选区域褶皱',
    promptRequired: false,
    icon: '✨',
    defaultParameters: {
      strength: 0.7,
      guidance: 8.0,
      steps: 30
    }
  }
];

// 默认画笔设置
export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  width: 20,
  color: 'rgba(255, 0, 0, 0.5)',
  opacity: 0.5,
  hardness: 0.8
};

// 默认导出选项
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'png',
  quality: 1,
  includeMask: true,
  includeBackground: true,
  scale: 2
};