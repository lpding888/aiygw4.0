/**
 * 页脚链接仓库层
 */

import { db } from '../config/database.js';

export interface FooterLink {
  id: number;
  group_name: string;
  group_key: string;
  title: string;
  url?: string;
  icon?: string;
  is_external: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateFooterLinkInput {
  group_name: string;
  group_key: string;
  title: string;
  url?: string;
  icon?: string;
  is_external?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export async function listFooterLinks(
  options: { groupKey?: string; includeInactive?: boolean } = {}
): Promise<FooterLink[]> {
  let query = db<FooterLink>('footer_links').orderBy('group_key').orderBy('sort_order');
  if (options.groupKey) query = query.where('group_key', options.groupKey);
  if (!options.includeInactive) query = query.where('is_active', true);
  return query;
}

export async function getGroupedFooterLinks(): Promise<Record<string, FooterLink[]>> {
  const links = await listFooterLinks();
  return links.reduce(
    (acc, link) => {
      if (!acc[link.group_key]) acc[link.group_key] = [];
      acc[link.group_key].push(link);
      return acc;
    },
    {} as Record<string, FooterLink[]>
  );
}

export async function getFooterLinkById(id: number): Promise<FooterLink | undefined> {
  return db<FooterLink>('footer_links').where('id', id).first();
}

export async function createFooterLink(data: CreateFooterLinkInput): Promise<FooterLink> {
  const [id] = await db('footer_links').insert(data);
  return getFooterLinkById(id) as Promise<FooterLink>;
}

export async function updateFooterLink(
  id: number,
  data: Partial<CreateFooterLinkInput>
): Promise<FooterLink> {
  await db('footer_links')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getFooterLinkById(id) as Promise<FooterLink>;
}

export async function deleteFooterLink(id: number): Promise<boolean> {
  return (await db('footer_links').where('id', id).delete()) > 0;
}

export async function batchUpdateSortOrder(
  items: { id: number; sort_order: number }[]
): Promise<void> {
  for (const item of items) {
    await db('footer_links').where('id', item.id).update({ sort_order: item.sort_order });
  }
}
