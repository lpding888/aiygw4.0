/**
 * 弹窗管理仓库层
 */

import { db } from '../config/database.js';

export interface Popup {
  id: number;
  name: string;
  title?: string;
  content?: string;
  image_url?: string;
  link_url?: string;
  button_text?: string;
  type: string;
  position: string;
  size: string;
  trigger_rules?: string;
  delay_seconds: number;
  display_frequency: number;
  target_pages?: string;
  target_audience?: string;
  show_close_button: boolean;
  close_on_backdrop: boolean;
  custom_style?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  start_time?: Date;
  end_time?: Date;
  impression_count: number;
  click_count: number;
  close_count: number;
  priority: number;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePopupInput {
  name: string;
  title?: string;
  content?: string;
  image_url?: string;
  link_url?: string;
  button_text?: string;
  type?: string;
  position?: string;
  size?: string;
  delay_seconds?: number;
  display_frequency?: number;
  status?: string;
  priority?: number;
  created_by?: number;
}

export async function listPopups(
  options: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Popup[]> {
  let query = db<Popup>('popups').orderBy('priority', 'desc');
  if (options.status) query = query.where('status', options.status);
  if (options.type) query = query.where('type', options.type);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}

export async function getActivePopups(page?: string): Promise<Popup[]> {
  const now = new Date();
  let query = db<Popup>('popups')
    .where('status', 'active')
    .where((builder) => {
      builder.whereNull('start_time').orWhere('start_time', '<=', now);
    })
    .where((builder) => {
      builder.whereNull('end_time').orWhere('end_time', '>=', now);
    })
    .orderBy('priority', 'desc');

  // 如果指定页面，过滤目标页面
  if (page) {
    query = query.where((builder) => {
      builder.whereNull('target_pages').orWhere('target_pages', 'like', `%"${page}"%`);
    });
  }

  return query;
}

export async function getPopupById(id: number): Promise<Popup | undefined> {
  return db<Popup>('popups').where('id', id).first();
}

export async function createPopup(data: CreatePopupInput): Promise<Popup> {
  const [id] = await db('popups').insert(data);
  return getPopupById(id) as Promise<Popup>;
}

export async function updatePopup(id: number, data: Partial<CreatePopupInput>): Promise<Popup> {
  await db('popups')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getPopupById(id) as Promise<Popup>;
}

export async function deletePopup(id: number): Promise<boolean> {
  const deleted = await db('popups').where('id', id).delete();
  return deleted > 0;
}

export async function recordImpression(id: number): Promise<void> {
  await db('popups').where('id', id).increment('impression_count', 1);
}

export async function recordClick(id: number): Promise<void> {
  await db('popups').where('id', id).increment('click_count', 1);
}

export async function recordClose(id: number): Promise<void> {
  await db('popups').where('id', id).increment('close_count', 1);
}
