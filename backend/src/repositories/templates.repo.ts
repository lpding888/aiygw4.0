/**
 * 模板库仓库层
 */

import { db } from '../config/database.js';

export interface Template {
  id: number;
  name: string;
  slug: string;
  description?: string;
  cover_image?: string;
  preview_images?: string;
  category?: string;
  style?: string;
  tags?: string;
  config?: string;
  prompt_template?: string;
  type: 'pose' | 'background' | 'style' | 'composite';
  is_premium: boolean;
  price_quota: number;
  status: 'draft' | 'published' | 'archived';
  use_count: number;
  like_count: number;
  is_featured: boolean;
  sort_order: number;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTemplateInput {
  name: string;
  slug: string;
  description?: string;
  cover_image?: string;
  category?: string;
  style?: string;
  type?: string;
  is_premium?: boolean;
  status?: string;
  created_by?: number;
}

export async function listTemplates(
  options: {
    status?: string;
    type?: string;
    category?: string;
    isFeatured?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Template[]> {
  let query = db<Template>('templates').orderBy('sort_order');
  if (options.status) query = query.where('status', options.status);
  if (options.type) query = query.where('type', options.type);
  if (options.category) query = query.where('category', options.category);
  if (options.isFeatured !== undefined) query = query.where('is_featured', options.isFeatured);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}

export async function getPublishedTemplates(
  options: { category?: string; type?: string; limit?: number } = {}
): Promise<Template[]> {
  let query = db<Template>('templates')
    .where('status', 'published')
    .orderByRaw('is_featured DESC, sort_order ASC');
  if (options.category) query = query.where('category', options.category);
  if (options.type) query = query.where('type', options.type);
  if (options.limit) query = query.limit(options.limit);
  return query;
}

export async function getTemplateById(id: number): Promise<Template | undefined> {
  return db<Template>('templates').where('id', id).first();
}

export async function getTemplateBySlug(slug: string): Promise<Template | undefined> {
  return db<Template>('templates').where('slug', slug).first();
}

export async function createTemplate(data: CreateTemplateInput): Promise<Template> {
  const [id] = await db('templates').insert(data);
  return getTemplateById(id) as Promise<Template>;
}

export async function updateTemplate(
  id: number,
  data: Partial<CreateTemplateInput>
): Promise<Template> {
  await db('templates')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getTemplateById(id) as Promise<Template>;
}

export async function deleteTemplate(id: number): Promise<boolean> {
  return (await db('templates').where('id', id).delete()) > 0;
}

export async function incrementUseCount(id: number): Promise<void> {
  await db('templates').where('id', id).increment('use_count', 1);
}
