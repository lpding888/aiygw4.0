/**
 * 案例展示仓库层
 */

import { db } from '../config/database.js';

export interface Showcase {
  id: number;
  title: string;
  slug: string;
  description?: string;
  highlights?: string; // JSON array
  cover_image?: string;
  images?: string; // JSON array
  before_image?: string;
  after_image?: string;
  category?: string;
  style?: string;
  customer_name?: string;
  customer_avatar?: string;
  customer_quote?: string;
  status: 'draft' | 'published' | 'archived';
  view_count: number;
  like_count: number;
  is_featured: boolean;
  sort_order: number;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateShowcaseInput {
  title: string;
  slug: string;
  description?: string;
  highlights?: string[];
  cover_image?: string;
  images?: string[];
  before_image?: string;
  after_image?: string;
  category?: string;
  style?: string;
  customer_name?: string;
  customer_avatar?: string;
  customer_quote?: string;
  status?: 'draft' | 'published' | 'archived';
  is_featured?: boolean;
  sort_order?: number;
  created_by?: number;
}

function serializeShowcase(data: CreateShowcaseInput): Record<string, unknown> {
  return {
    ...data,
    highlights: data.highlights ? JSON.stringify(data.highlights) : undefined,
    images: data.images ? JSON.stringify(data.images) : undefined
  };
}

function deserializeShowcase(
  row: Showcase
): Showcase & { highlightsList?: string[]; imagesList?: string[] } {
  return {
    ...row,
    highlightsList: row.highlights ? JSON.parse(row.highlights) : [],
    imagesList: row.images ? JSON.parse(row.images) : []
  };
}

export async function listShowcases(
  options: {
    status?: string;
    category?: string;
    style?: string;
    isFeatured?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Showcase[]> {
  let query = db<Showcase>('showcases').orderBy('sort_order');

  if (options.status) {
    query = query.where('status', options.status);
  }
  if (options.category) {
    query = query.where('category', options.category);
  }
  if (options.style) {
    query = query.where('style', options.style);
  }
  if (options.isFeatured !== undefined) {
    query = query.where('is_featured', options.isFeatured);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.offset(options.offset);
  }

  const rows = await query;
  return rows.map(deserializeShowcase);
}

export async function getPublishedShowcases(
  options: {
    category?: string;
    limit?: number;
  } = {}
): Promise<Showcase[]> {
  let query = db<Showcase>('showcases')
    .where('status', 'published')
    .orderByRaw('is_featured DESC, sort_order ASC');

  if (options.category) {
    query = query.where('category', options.category);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const rows = await query;
  return rows.map(deserializeShowcase);
}

export async function getFeaturedShowcases(limit = 6): Promise<Showcase[]> {
  const rows = await db<Showcase>('showcases')
    .where('status', 'published')
    .where('is_featured', true)
    .orderBy('sort_order')
    .limit(limit);

  return rows.map(deserializeShowcase);
}

export async function getShowcaseById(id: number): Promise<Showcase | undefined> {
  const row = await db<Showcase>('showcases').where('id', id).first();
  return row ? deserializeShowcase(row) : undefined;
}

export async function getShowcaseBySlug(slug: string): Promise<Showcase | undefined> {
  const row = await db<Showcase>('showcases').where('slug', slug).first();
  return row ? deserializeShowcase(row) : undefined;
}

export async function createShowcase(data: CreateShowcaseInput): Promise<Showcase> {
  const [id] = await db('showcases').insert(serializeShowcase(data));
  return getShowcaseById(id) as Promise<Showcase>;
}

export async function updateShowcase(
  id: number,
  data: Partial<CreateShowcaseInput>
): Promise<Showcase> {
  await db('showcases')
    .where('id', id)
    .update({ ...serializeShowcase(data as CreateShowcaseInput), updated_at: db.fn.now() });
  return getShowcaseById(id) as Promise<Showcase>;
}

export async function deleteShowcase(id: number): Promise<boolean> {
  const deleted = await db('showcases').where('id', id).delete();
  return deleted > 0;
}

export async function incrementViewCount(id: number): Promise<void> {
  await db('showcases').where('id', id).increment('view_count', 1);
}

export async function incrementLikeCount(id: number): Promise<void> {
  await db('showcases').where('id', id).increment('like_count', 1);
}
