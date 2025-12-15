/**
 * 媒体库仓库层
 */
import { db } from '../config/database.js';
import { escapeLikePattern } from '../utils/sql-helpers.js';

export interface MediaFolder {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  path?: string;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface MediaFile {
  id: number;
  folder_id?: number;
  name: string;
  original_name?: string;
  file_path: string;
  url: string;
  thumbnail_url?: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  mime_type?: string;
  extension?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  alt_text?: string;
  description?: string;
  metadata?: string;
  tags?: string;
  use_count: number;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

// 文件夹操作
export async function listFolders(parentId?: number | null): Promise<MediaFolder[]> {
  let query = db<MediaFolder>('media_folders').orderBy('name');
  if (parentId === null) query = query.whereNull('parent_id');
  else if (parentId !== undefined) query = query.where('parent_id', parentId);
  return query;
}

export async function getFolderById(id: number): Promise<MediaFolder | undefined> {
  return db<MediaFolder>('media_folders').where('id', id).first();
}

export async function createFolder(data: Partial<MediaFolder>): Promise<MediaFolder> {
  const [id] = await db('media_folders').insert(data);
  return getFolderById(id) as Promise<MediaFolder>;
}

export async function updateFolder(id: number, data: Partial<MediaFolder>): Promise<MediaFolder> {
  await db('media_folders')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getFolderById(id) as Promise<MediaFolder>;
}

export async function deleteFolder(id: number): Promise<boolean> {
  return (await db('media_folders').where('id', id).delete()) > 0;
}

// 文件操作
export async function listFiles(
  options: {
    folderId?: number | null;
    type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<MediaFile[]> {
  let query = db<MediaFile>('media_files').orderBy('created_at', 'desc');
  if (options.folderId === null) query = query.whereNull('folder_id');
  else if (options.folderId !== undefined) query = query.where('folder_id', options.folderId);
  if (options.type) query = query.where('type', options.type);
  if (options.search) query = query.where('name', 'like', `%${escapeLikePattern(options.search)}%`);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}

export async function getFileById(id: number): Promise<MediaFile | undefined> {
  return db<MediaFile>('media_files').where('id', id).first();
}

export async function createFile(data: Partial<MediaFile>): Promise<MediaFile> {
  const [id] = await db('media_files').insert(data);
  return getFileById(id) as Promise<MediaFile>;
}

export async function updateFile(id: number, data: Partial<MediaFile>): Promise<MediaFile> {
  await db('media_files')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getFileById(id) as Promise<MediaFile>;
}

export async function deleteFile(id: number): Promise<boolean> {
  return (await db('media_files').where('id', id).delete()) > 0;
}

export async function incrementUseCount(id: number): Promise<void> {
  await db('media_files').where('id', id).increment('use_count', 1);
}

export async function getStorageStats(): Promise<{
  total_files: number;
  total_size: number;
  by_type: Record<string, number>;
}> {
  const total = await db('media_files').count('id as count').sum('size as size').first();
  const byType = (await db('media_files')
    .select('type')
    .count('id as count')
    .groupBy('type')) as Array<{ type: string; count: string | number | bigint | null }>;

  const byTypeMap = byType.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = parseInt(String(row.count ?? 0), 10) || 0;
    return acc;
  }, {});
  return {
    total_files: parseInt((total?.count as string) || '0'),
    total_size: parseInt((total?.size as string) || '0'),
    by_type: byTypeMap
  };
}
