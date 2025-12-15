/**
 * CMS模块Zod验证Schema
 *
 * 统一定义所有CMS模块的输入验证规则
 */

import { z } from 'zod';

// ============ 公告模块 ============

export const announcementStatusSchema = z.enum(['draft', 'published', 'expired']);
export const announcementPositionSchema = z.enum(['top', 'bottom', 'sidebar', 'modal']);
export const announcementTypeSchema = z.enum(['info', 'warning', 'success', 'error']);
export const targetAudienceSchema = z.enum(['all', 'member', 'vip']);

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200字'),
  content: z.string().min(1, '内容不能为空').max(10000, '内容最多10000字'),
  status: announcementStatusSchema.default('draft'),
  position: announcementPositionSchema.default('top'),
  type: announcementTypeSchema.default('info'),
  target_audience: targetAudienceSchema.default('all'),
  priority: z.number().int().min(0).max(1000).default(0),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  is_dismissible: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

// ============ 轮播图模块 ============

export const bannerStatusSchema = z.enum(['draft', 'published', 'expired']);
export const bannerPositionSchema = z.enum(['home', 'workspace', 'pricing']);

export const createBannerSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100, '标题最多100字'),
  image_url: z.string().url('请输入有效的图片URL'),
  link_url: z.string().url('请输入有效的链接URL').optional().or(z.literal('')),
  alt_text: z.string().max(200, 'Alt文本最多200字').optional(),
  description: z.string().max(500, '描述最多500字').optional(),
  status: bannerStatusSchema.default('draft'),
  position: bannerPositionSchema.default('home'),
  sort_order: z.number().int().min(0).default(0),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const updateBannerSchema = createBannerSchema.partial();

export const batchUpdateSortOrderSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      sort_order: z.number().int().min(0)
    })
  )
});

// ============ 会员套餐模块 ============

export const planStatusSchema = z.enum(['active', 'inactive', 'archived']);

export const createPlanSchema = z.object({
  name: z.string().min(1, '套餐名称不能为空').max(50, '套餐名称最多50字'),
  slug: z
    .string()
    .min(1, 'Slug不能为空')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug只能包含小写字母、数字和短横线'),
  description: z.string().max(500, '描述最多500字').optional(),
  price: z.number().min(0, '价格不能为负数'),
  original_price: z.number().min(0).optional(),
  duration_days: z.number().int().min(1, '有效期至少1天'),
  quota: z.number().int().min(0, '配额不能为负数'),
  status: planStatusSchema.default('active'),
  features: z.array(z.string()).optional(),
  is_recommended: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const updatePlanSchema = createPlanSchema.partial();

// ============ 会员权益模块 ============

export const benefitTypeSchema = z.enum(['feature', 'quota', 'service', 'discount']);

export const createBenefitSchema = z.object({
  name: z.string().min(1, '权益名称不能为空').max(100, '权益名称最多100字'),
  key: z
    .string()
    .min(1, 'Key不能为空')
    .max(50)
    .regex(/^[a-z_]+$/, 'Key只能包含小写字母和下划线'),
  description: z.string().max(500, '描述最多500字').optional(),
  type: benefitTypeSchema.default('feature'),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  icon: z.string().max(50).optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0)
});

export const updateBenefitSchema = createBenefitSchema.partial();

// ============ 文案配置模块 ============

export const createContentTextSchema = z.object({
  page: z.string().min(1, '页面标识不能为空').max(50),
  section: z.string().max(50).optional(),
  key: z.string().min(1, 'Key不能为空').max(100),
  language: z.string().min(2).max(10).default('zh-CN'),
  value: z.string().min(1, '文案内容不能为空'),
  description: z.string().max(200).optional()
});

export const updateContentTextSchema = createContentTextSchema.partial();

export const batchImportContentTextsSchema = z.object({
  data: z.array(createContentTextSchema),
  format: z.enum(['json', 'csv']).default('json')
});

// ============ AI内容生成模块 ============

export const aiGenerateTextSchema = z.object({
  key: z.string().min(1, 'Key不能为空'),
  description: z.string().min(1, '描述不能为空').max(500),
  languages: z.array(z.string()).min(1, '至少选择一种语言').default(['zh-CN']),
  style: z.enum(['formal', 'casual', 'marketing']).default('formal'),
  maxLength: z.number().int().min(10).max(1000).default(100)
});

export const aiPolishTextSchema = z.object({
  text: z.string().min(1, '文本不能为空').max(5000),
  style: z.enum(['formal', 'casual', 'marketing']).default('formal')
});

export const aiTranslateTextSchema = z.object({
  text: z.string().min(1, '文本不能为空').max(5000),
  fromLang: z.string().min(2).max(10).default('zh-CN'),
  toLangs: z.array(z.string()).min(1, '至少选择一种目标语言')
});

export const aiSummarySchema = z.object({
  content: z.string().min(10, '内容至少10个字符').max(10000),
  maxLength: z.number().int().min(20).max(200).default(50)
});

export const aiSeoAnalyzeSchema = z.object({
  content: z.string().min(50, '内容至少50个字符').max(20000),
  pageType: z.enum(['home', 'product', 'article', 'landing']).default('home')
});

// 导出类型
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateBenefitInput = z.infer<typeof createBenefitSchema>;
export type UpdateBenefitInput = z.infer<typeof updateBenefitSchema>;
export type CreateContentTextInput = z.infer<typeof createContentTextSchema>;
export type UpdateContentTextInput = z.infer<typeof updateContentTextSchema>;
export type AiGenerateTextInput = z.infer<typeof aiGenerateTextSchema>;
export type AiPolishTextInput = z.infer<typeof aiPolishTextSchema>;
export type AiTranslateTextInput = z.infer<typeof aiTranslateTextSchema>;
export type AiSummaryInput = z.infer<typeof aiSummarySchema>;
export type AiSeoAnalyzeInput = z.infer<typeof aiSeoAnalyzeSchema>;
