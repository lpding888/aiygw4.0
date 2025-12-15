/**
 * 活动页仓库层
 */

import { db } from '../config/database.js';

export interface Campaign {
  id: number;
  name: string;
  slug: string;
  title?: string;
  description?: string;
  content?: string;
  cover_image?: string;
  background_image?: string;
  background_color?: string;
  custom_css?: string;
  custom_js?: string;
  type: 'promotion' | 'holiday' | 'launch' | 'event' | 'other';
  cta_buttons?: string;
  countdown?: string;
  prizes?: string;
  rules?: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended' | 'archived';
  start_time?: Date;
  end_time?: Date;
  view_count: number;
  participation_count: number;
  seo_config?: string;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCampaignInput {
  name: string;
  slug: string;
  title?: string;
  description?: string;
  content?: string;
  cover_image?: string;
  type?: 'promotion' | 'holiday' | 'launch' | 'event' | 'other';
  cta_buttons?: object[];
  status?: string;
  start_time?: Date | string;
  end_time?: Date | string;
  created_by?: number;
}

export async function listCampaigns(
  options: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Campaign[]> {
  let query = db<Campaign>('campaigns').orderBy('created_at', 'desc');
  if (options.status) query = query.where('status', options.status);
  if (options.type) query = query.where('type', options.type);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}

export async function getActiveCampaigns(): Promise<Campaign[]> {
  const now = new Date();
  return db<Campaign>('campaigns')
    .where('status', 'active')
    .where('start_time', '<=', now)
    .where((builder) => {
      builder.whereNull('end_time').orWhere('end_time', '>=', now);
    })
    .orderBy('created_at', 'desc');
}

export async function getCampaignById(id: number): Promise<Campaign | undefined> {
  return db<Campaign>('campaigns').where('id', id).first();
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | undefined> {
  return db<Campaign>('campaigns').where('slug', slug).first();
}

export async function createCampaign(data: CreateCampaignInput): Promise<Campaign> {
  const serialized = {
    ...data,
    cta_buttons: data.cta_buttons ? JSON.stringify(data.cta_buttons) : undefined
  };
  const [id] = await db('campaigns').insert(serialized);
  return getCampaignById(id) as Promise<Campaign>;
}

export async function updateCampaign(
  id: number,
  data: Partial<CreateCampaignInput>
): Promise<Campaign> {
  const serialized = {
    ...data,
    cta_buttons: data.cta_buttons ? JSON.stringify(data.cta_buttons) : undefined,
    updated_at: db.fn.now()
  };
  await db('campaigns').where('id', id).update(serialized);
  return getCampaignById(id) as Promise<Campaign>;
}

export async function deleteCampaign(id: number): Promise<boolean> {
  const deleted = await db('campaigns').where('id', id).delete();
  return deleted > 0;
}

export async function incrementViewCount(id: number): Promise<void> {
  await db('campaigns').where('id', id).increment('view_count', 1);
}
