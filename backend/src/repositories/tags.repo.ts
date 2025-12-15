/**
 * 标签系统仓库层
 */

import { db } from '../config/database.js';

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color?: string;
  icon?: string;
  description?: string;
  category?: string;
  use_count: number;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTagInput {
  name: string;
  slug: string;
  color?: string;
  icon?: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  sort_order?: number;
}

export async function listTags(
  options: { category?: string; includeInactive?: boolean; limit?: number } = {}
): Promise<Tag[]> {
  let query = db<Tag>('tags').orderBy('sort_order');
  if (options.category) query = query.where('category', options.category);
  if (!options.includeInactive) query = query.where('is_active', true);
  if (options.limit) query = query.limit(options.limit);
  return query;
}

export async function getPopularTags(limit = 20): Promise<Tag[]> {
  return db<Tag>('tags').where('is_active', true).orderBy('use_count', 'desc').limit(limit);
}

export async function getTagById(id: number): Promise<Tag | undefined> {
  return db<Tag>('tags').where('id', id).first();
}

export async function getTagBySlug(slug: string): Promise<Tag | undefined> {
  return db<Tag>('tags').where('slug', slug).first();
}

export async function createTag(data: CreateTagInput): Promise<Tag> {
  const [id] = await db('tags').insert(data);
  return getTagById(id) as Promise<Tag>;
}

export async function updateTag(id: number, data: Partial<CreateTagInput>): Promise<Tag> {
  await db('tags')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getTagById(id) as Promise<Tag>;
}

export async function deleteTag(id: number): Promise<boolean> {
  await db('taggables').where('tag_id', id).delete();
  return (await db('tags').where('id', id).delete()) > 0;
}

// 标签关联操作
export async function attachTags(
  taggableType: string,
  taggableId: number,
  tagIds: number[]
): Promise<void> {
  await db('taggables').where({ taggable_type: taggableType, taggable_id: taggableId }).delete();
  if (tagIds.length > 0) {
    const records = tagIds.map((tag_id) => ({
      tag_id,
      taggable_type: taggableType,
      taggable_id: taggableId
    }));
    await db('taggables').insert(records);
    await db('tags').whereIn('id', tagIds).increment('use_count', 1);
  }
}

export async function getTagsForEntity(taggableType: string, taggableId: number): Promise<Tag[]> {
  return db<Tag>('tags')
    .join('taggables', 'tags.id', 'taggables.tag_id')
    .where('taggables.taggable_type', taggableType)
    .where('taggables.taggable_id', taggableId)
    .select('tags.*');
}

export async function getEntitiesByTag(taggableType: string, tagSlug: string): Promise<number[]> {
  const tag = await getTagBySlug(tagSlug);
  if (!tag) return [];
  const results = await db('taggables')
    .where({ tag_id: tag.id, taggable_type: taggableType })
    .select('taggable_id');
  return results.map((r) => r.taggable_id);
}
