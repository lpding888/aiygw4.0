/**
 * Import/Export Service
 * 艹，通用批量导入导出服务！
 * 支持CSV和JSON格式
 */

import * as textRepo from '../repositories/contentTexts.repo.js';
import * as announcementRepo from '../repositories/announcements.repo.js';
import * as bannerRepo from '../repositories/banners.repo.js';
import * as planRepo from '../repositories/membershipPlans.repo.js';
import * as benefitRepo from '../repositories/membershipBenefits.repo.js';

/**
 * 内容文案导出对象
 */
export interface ContentTextExport {
  page: string;
  section: string;
  key: string;
  language: string;
  value: string;
  description?: string;
  status: string;
}

/**
 * 公告导出对象
 */
interface AnnouncementExport {
  title: string;
  content: string;
  type: string;
  position: string;
  priority: number;
  status: string;
  publish_at?: string | null;
  expire_at?: string | null;
  target_audience?: string;
}

/**
 * 轮播图导出对象
 */
interface BannerExport {
  title: string;
  image_url: string;
  link_url: string;
  description?: string;
  sort_order: number;
  status: string;
  publish_at?: string | null;
  expire_at?: string | null;
  target_audience?: string;
}

/**
 * 套餐导出对象
 */
interface PlanExport {
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  duration_days: number;
  quota_uploads: number;
  quota_storage: number;
  quota_features: number;
  status: string;
  sort_order: number;
  is_default: boolean;
  is_popular: boolean;
}

/**
 * 权益导出对象
 */
interface BenefitExport {
  name: string;
  key: string;
  description?: string;
  type: string;
  value: unknown;
  icon?: string;
  color?: string;
  status: string;
}

/**
 * 导入错误对象
 */
interface ImportError {
  error: string;
  [key: string]: unknown;
}

/**
 * 导入结果
 */
interface ImportResult {
  created: number;
  updated: number;
  errors: ImportError[];
}

/**
 * 导出选项
 */
interface ExportOptions {
  page?: string;
  language?: string;
  [key: string]: unknown;
}

/**
 * CSV行对象
 */
interface CSVRow {
  [key: string]: unknown;
}

/**
 * 导出文案为JSON
 */
export async function exportContentTextsJSON(
  options?: ExportOptions
): Promise<ContentTextExport[]> {
  const texts = await textRepo.listTexts({
    page: options?.page,
    language: options?.language,
    limit: 10000 // 艹，大批量导出
  });

  return texts.map((t) => ({
    page: t.page,
    section: t.section,
    key: t.key,
    language: t.language,
    value: t.value,
    description: t.description,
    status: t.status
  }));
}

/**
 * 导出文案为CSV
 */
export function convertToCSV(data: CSVRow[], fields: string[]): string {
  // 艹，CSV头部
  const header = fields.join(',');

  // 艹，CSV行
  const rows = data.map((item) =>
    fields
      .map((field) => {
        const value = item[field] || '';
        // 转义双引号和换行符
        return `"${String(value).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      })
      .join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * 导出文案为CSV格式
 */
export async function exportContentTextsCSV(options?: {
  page?: string;
  language?: string;
}): Promise<string> {
  const data = await exportContentTextsJSON(options);
  const fields = ['page', 'section', 'key', 'language', 'value', 'description', 'status'];
  return convertToCSV(data, fields);
}

/**
 * 导入文案JSON
 */
export async function importContentTextsJSON(
  data: ContentTextExport[],
  updated_by?: number
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let created = 0;
  let updated = 0;

  try {
    const result = await textRepo.batchUpsertTexts(data, updated_by);
    created = result.created;
    updated = result.updated;
  } catch (error: unknown) {
    const err = error as Error;
    errors.push({ error: err.message });
  }

  return { created, updated, errors };
}

/**
 * 解析CSV为JSON
 */
export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  // 艹，解析头部
  const header = lines[0].split(',').map((h) => h.trim());

  // 艹，解析数据行
  const data: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // 简单CSV解析（不处理复杂的引号转义）
    const values = line.split(',').map((v) => v.trim().replace(/^"(.*)"$/, '$1'));

    const obj: CSVRow = {};
    header.forEach((key, index) => {
      obj[key] = values[index] || null;
    });

    data.push(obj);
  }

  return data;
}

/**
 * 导出公告为JSON
 */
export async function exportAnnouncementsJSON(): Promise<AnnouncementExport[]> {
  const announcements = await announcementRepo.listAnnouncements({
    limit: 10000
  });

  return announcements.map((a) => ({
    title: a.title,
    content: a.content,
    type: a.type,
    position: a.position,
    priority: a.priority,
    status: a.status,
    publish_at: a.publish_at,
    expire_at: a.expire_at,
    target_audience: a.target_audience
  }));
}

/**
 * 导出轮播图为JSON
 */
export async function exportBannersJSON(): Promise<BannerExport[]> {
  const banners = await bannerRepo.listBanners({
    limit: 10000
  });

  return banners.map((b) => ({
    title: b.title,
    image_url: b.image_url,
    link_url: b.link_url,
    description: b.description,
    sort_order: b.sort_order,
    status: b.status,
    publish_at: b.publish_at,
    expire_at: b.expire_at,
    target_audience: b.target_audience
  }));
}

/**
 * 导出套餐为JSON
 */
export async function exportPlansJSON(): Promise<PlanExport[]> {
  const plans = await planRepo.listPlans({
    limit: 10000
  });

  return plans.map((p) => ({
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    currency: p.currency,
    duration_days: p.duration_days,
    quota_uploads: p.quota_uploads,
    quota_storage: p.quota_storage,
    quota_features: p.quota_features,
    status: p.status,
    sort_order: p.sort_order,
    is_default: p.is_default,
    is_popular: p.is_popular
  }));
}

/**
 * 导出权益为JSON
 */
export async function exportBenefitsJSON(): Promise<BenefitExport[]> {
  const benefits = await benefitRepo.listBenefits({
    limit: 10000
  });

  return benefits.map((b) => ({
    name: b.name,
    key: b.key,
    description: b.description,
    type: b.type,
    value: b.value,
    icon: b.icon,
    color: b.color,
    status: b.status
  }));
}

/**
 * 通用导出函数
 */
export async function exportEntity(
  entityType: string,
  format: 'json' | 'csv' = 'json',
  options?: ExportOptions
): Promise<
  | ContentTextExport[]
  | AnnouncementExport[]
  | BannerExport[]
  | PlanExport[]
  | BenefitExport[]
  | string
> {
  let data: CSVRow[];

  switch (entityType) {
    case 'content_texts':
      data = await exportContentTextsJSON(options);
      break;
    case 'announcements':
      data = await exportAnnouncementsJSON();
      break;
    case 'banners':
      data = await exportBannersJSON();
      break;
    case 'plans':
      data = await exportPlansJSON();
      break;
    case 'benefits':
      data = await exportBenefitsJSON();
      break;
    default:
      throw new Error(`不支持的实体类型: ${entityType}`);
  }

  if (format === 'csv') {
    const fields = Object.keys(data[0] || {});
    return convertToCSV(data, fields);
  }

  return data;
}
