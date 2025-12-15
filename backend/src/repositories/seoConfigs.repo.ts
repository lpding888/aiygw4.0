/**
 * SEO管理仓库层
 */
import { db } from '../config/database.js';

export interface SeoConfig {
  id: number;
  page_path: string;
  page_name?: string;
  title?: string;
  description?: string;
  keywords?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_type?: string;
  twitter_card?: string;
  canonical_url?: string;
  structured_data?: string;
  no_index: boolean;
  no_follow: boolean;
  priority: number;
  change_freq?: string;
  updated_by?: number;
  created_at: Date;
  updated_at: Date;
}

export async function listSeoConfigs(): Promise<SeoConfig[]> {
  return db<SeoConfig>('seo_configs').orderBy('page_path');
}

export async function getSeoConfigByPath(pagePath: string): Promise<SeoConfig | undefined> {
  return db<SeoConfig>('seo_configs').where('page_path', pagePath).first();
}

export async function getSeoConfigById(id: number): Promise<SeoConfig | undefined> {
  return db<SeoConfig>('seo_configs').where('id', id).first();
}

export async function createSeoConfig(data: Partial<SeoConfig>): Promise<SeoConfig> {
  const [id] = await db('seo_configs').insert(data);
  return getSeoConfigById(id) as Promise<SeoConfig>;
}

export async function updateSeoConfig(id: number, data: Partial<SeoConfig>): Promise<SeoConfig> {
  await db('seo_configs')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getSeoConfigById(id) as Promise<SeoConfig>;
}

export async function upsertSeoConfig(
  pagePath: string,
  data: Partial<SeoConfig>
): Promise<SeoConfig> {
  const existing = await getSeoConfigByPath(pagePath);
  if (existing) return updateSeoConfig(existing.id, data);
  return createSeoConfig({ ...data, page_path: pagePath });
}

export async function deleteSeoConfig(id: number): Promise<boolean> {
  return (await db('seo_configs').where('id', id).delete()) > 0;
}

export async function generateSitemap(): Promise<
  { loc: string; lastmod: string; priority: number; changefreq: string }[]
> {
  const configs = await db<SeoConfig>('seo_configs')
    .where('no_index', false)
    .orderBy('priority', 'desc');
  return configs.map((c) => ({
    loc: c.page_path,
    lastmod: c.updated_at.toISOString().split('T')[0],
    priority: c.priority / 100,
    changefreq: c.change_freq || 'weekly'
  }));
}
