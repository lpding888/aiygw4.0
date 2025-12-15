/**
 * 帮助中心仓库层
 */

import { db } from '../config/database.js';
import { escapeLikePattern } from '../utils/sql-helpers.js';

// ============ 分类相关 ============

export interface HelpCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  parent_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
  parent_id?: number;
}

export async function listCategories(
  options: {
    includeInactive?: boolean;
    parentId?: number | null;
  } = {}
): Promise<HelpCategory[]> {
  let query = db<HelpCategory>('help_categories').orderBy('sort_order');

  if (!options.includeInactive) {
    query = query.where('is_active', true);
  }

  if (options.parentId !== undefined) {
    query =
      options.parentId === null
        ? query.whereNull('parent_id')
        : query.where('parent_id', options.parentId);
  }

  return query;
}

export async function getCategoryById(id: number): Promise<HelpCategory | undefined> {
  return db<HelpCategory>('help_categories').where('id', id).first();
}

export async function getCategoryBySlug(slug: string): Promise<HelpCategory | undefined> {
  return db<HelpCategory>('help_categories').where('slug', slug).first();
}

export async function createCategory(data: CreateCategoryInput): Promise<HelpCategory> {
  const [id] = await db('help_categories').insert(data);
  return getCategoryById(id) as Promise<HelpCategory>;
}

export async function updateCategory(
  id: number,
  data: Partial<CreateCategoryInput>
): Promise<HelpCategory> {
  await db('help_categories')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getCategoryById(id) as Promise<HelpCategory>;
}

export async function deleteCategory(id: number): Promise<boolean> {
  const deleted = await db('help_categories').where('id', id).delete();
  return deleted > 0;
}

// ============ 文章相关 ============

export interface HelpArticle {
  id: number;
  category_id?: number;
  title: string;
  slug: string;
  content?: string;
  summary?: string;
  keywords?: string;
  status: 'draft' | 'published' | 'archived';
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  sort_order: number;
  created_by?: number;
  updated_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateArticleInput {
  category_id?: number;
  title: string;
  slug: string;
  content?: string;
  summary?: string;
  keywords?: string;
  status?: 'draft' | 'published' | 'archived';
  sort_order?: number;
  created_by?: number;
}

export async function listArticles(
  options: {
    categoryId?: number;
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
  } = {}
): Promise<HelpArticle[]> {
  let query = db<HelpArticle>('help_articles').orderBy('sort_order');

  if (options.categoryId) {
    query = query.where('category_id', options.categoryId);
  }
  if (options.status) {
    query = query.where('status', options.status);
  }
  if (options.search) {
    const escaped = escapeLikePattern(options.search);
    query = query.where((builder) => {
      builder
        .where('title', 'like', `%${escaped}%`)
        .orWhere('content', 'like', `%${escaped}%`)
        .orWhere('keywords', 'like', `%${escaped}%`);
    });
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.offset(options.offset);
  }

  return query;
}

export async function getPublishedArticles(categorySlug?: string): Promise<HelpArticle[]> {
  let query = db<HelpArticle>('help_articles').where('status', 'published').orderBy('sort_order');

  if (categorySlug) {
    const category = await getCategoryBySlug(categorySlug);
    if (category) {
      query = query.where('category_id', category.id);
    }
  }

  return query;
}

export async function getArticleById(id: number): Promise<HelpArticle | undefined> {
  return db<HelpArticle>('help_articles').where('id', id).first();
}

export async function getArticleBySlug(slug: string): Promise<HelpArticle | undefined> {
  return db<HelpArticle>('help_articles').where('slug', slug).first();
}

export async function createArticle(data: CreateArticleInput): Promise<HelpArticle> {
  const [id] = await db('help_articles').insert(data);
  return getArticleById(id) as Promise<HelpArticle>;
}

export async function updateArticle(
  id: number,
  data: Partial<CreateArticleInput> & { updated_by?: number }
): Promise<HelpArticle> {
  await db('help_articles')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getArticleById(id) as Promise<HelpArticle>;
}

export async function deleteArticle(id: number): Promise<boolean> {
  const deleted = await db('help_articles').where('id', id).delete();
  return deleted > 0;
}

export async function incrementViewCount(id: number): Promise<void> {
  await db('help_articles').where('id', id).increment('view_count', 1);
}

export async function markHelpful(id: number, helpful: boolean): Promise<void> {
  const field = helpful ? 'helpful_count' : 'not_helpful_count';
  await db('help_articles').where('id', id).increment(field, 1);
}

export async function searchArticles(keyword: string, limit = 10): Promise<HelpArticle[]> {
  const escaped = escapeLikePattern(keyword);
  return db<HelpArticle>('help_articles')
    .where('status', 'published')
    .where((builder) => {
      builder
        .where('title', 'like', `%${escaped}%`)
        .orWhere('content', 'like', `%${escaped}%`)
        .orWhere('keywords', 'like', `%${escaped}%`);
    })
    .orderByRaw('CASE WHEN title LIKE ? THEN 0 ELSE 1 END', [`%${escaped}%`])
    .limit(limit);
}
