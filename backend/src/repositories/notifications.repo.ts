/**
 * 通知中心仓库层
 */
import { db } from '../config/database.js';

export interface Notification {
  id: number;
  user_id?: string;
  title: string;
  content?: string;
  type: string;
  priority: string;
  link_url?: string;
  icon?: string;
  metadata?: string;
  is_read: boolean;
  read_at?: Date;
  expires_at?: Date;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationInput {
  user_id?: string;
  title: string;
  content?: string;
  type?: string;
  priority?: string;
  link_url?: string;
  icon?: string;
  metadata?: object;
  expires_at?: Date | string;
  created_by?: string;
}

export async function listNotifications(
  options: {
    userId?: string;
    type?: string;
    isRead?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Notification[]> {
  let query = db<Notification>('notifications').orderBy('created_at', 'desc');
  if (options.userId)
    query = query.where((b) => b.where('user_id', options.userId).orWhereNull('user_id'));
  if (options.type) query = query.where('type', options.type);
  if (options.isRead !== undefined) query = query.where('is_read', options.isRead);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db('notifications')
    .where((b) => b.where('user_id', userId).orWhereNull('user_id'))
    .where('is_read', false)
    .count('id as count')
    .first();
  return parseInt((result?.count as string) || '0');
}

export async function getNotificationById(id: number): Promise<Notification | undefined> {
  return db<Notification>('notifications').where('id', id).first();
}

export async function createNotification(data: CreateNotificationInput): Promise<Notification> {
  const serialized = {
    ...data,
    metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
  };
  const [id] = await db('notifications').insert(serialized);
  return getNotificationById(id) as Promise<Notification>;
}

export async function createBulkNotifications(
  userIds: string[],
  data: Omit<CreateNotificationInput, 'user_id'>
): Promise<number> {
  const records = userIds.map((user_id) => ({
    ...data,
    user_id,
    metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
  }));
  await db('notifications').insert(records);
  return records.length;
}

export async function markAsRead(id: number): Promise<void> {
  await db('notifications').where('id', id).update({ is_read: true, read_at: db.fn.now() });
}

export async function markAllAsRead(userId: string): Promise<number> {
  return db('notifications')
    .where((b) => b.where('user_id', userId).orWhereNull('user_id'))
    .where('is_read', false)
    .update({ is_read: true, read_at: db.fn.now() });
}

export async function deleteNotification(id: number): Promise<boolean> {
  return (await db('notifications').where('id', id).delete()) > 0;
}

export async function deleteOldNotifications(days: number = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return db('notifications').where('created_at', '<', cutoff).delete();
}
