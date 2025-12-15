/**
 * 更新日志仓库层
 */

import { db } from '../config/database.js';

export interface Changelog {
  id: number;
  version: string;
  title: string;
  content?: string;
  summary?: string;
  type: 'major' | 'minor' | 'patch' | 'hotfix';
  features?: string; // JSON array
  improvements?: string; // JSON array
  fixes?: string; // JSON array
  breaking_changes?: string; // JSON array
  status: 'draft' | 'published';
  release_date?: Date;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateChangelogInput {
  version: string;
  title: string;
  content?: string;
  summary?: string;
  type?: 'major' | 'minor' | 'patch' | 'hotfix';
  features?: string[];
  improvements?: string[];
  fixes?: string[];
  breaking_changes?: string[];
  status?: 'draft' | 'published';
  release_date?: Date | string;
  created_by?: number;
}

function serializeChangelog(data: CreateChangelogInput): Record<string, unknown> {
  return {
    ...data,
    features: data.features ? JSON.stringify(data.features) : undefined,
    improvements: data.improvements ? JSON.stringify(data.improvements) : undefined,
    fixes: data.fixes ? JSON.stringify(data.fixes) : undefined,
    breaking_changes: data.breaking_changes ? JSON.stringify(data.breaking_changes) : undefined
  };
}

function deserializeChangelog(row: Changelog): Changelog & {
  featuresList?: string[];
  improvementsList?: string[];
  fixesList?: string[];
  breakingChangesList?: string[];
} {
  return {
    ...row,
    featuresList: row.features ? JSON.parse(row.features) : [],
    improvementsList: row.improvements ? JSON.parse(row.improvements) : [],
    fixesList: row.fixes ? JSON.parse(row.fixes) : [],
    breakingChangesList: row.breaking_changes ? JSON.parse(row.breaking_changes) : []
  };
}

export async function listChangelogs(
  options: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Changelog[]> {
  let query = db<Changelog>('changelogs').orderBy('release_date', 'desc');

  if (options.status) {
    query = query.where('status', options.status);
  }
  if (options.type) {
    query = query.where('type', options.type);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.offset(options.offset);
  }

  const rows = await query;
  return rows.map(deserializeChangelog);
}

export async function getPublishedChangelogs(limit = 20): Promise<Changelog[]> {
  const rows = await db<Changelog>('changelogs')
    .where('status', 'published')
    .orderBy('release_date', 'desc')
    .limit(limit);

  return rows.map(deserializeChangelog);
}

export async function getLatestChangelog(): Promise<Changelog | undefined> {
  const row = await db<Changelog>('changelogs')
    .where('status', 'published')
    .orderBy('release_date', 'desc')
    .first();

  return row ? deserializeChangelog(row) : undefined;
}

export async function getChangelogById(id: number): Promise<Changelog | undefined> {
  const row = await db<Changelog>('changelogs').where('id', id).first();
  return row ? deserializeChangelog(row) : undefined;
}

export async function getChangelogByVersion(version: string): Promise<Changelog | undefined> {
  const row = await db<Changelog>('changelogs').where('version', version).first();
  return row ? deserializeChangelog(row) : undefined;
}

export async function createChangelog(data: CreateChangelogInput): Promise<Changelog> {
  const [id] = await db('changelogs').insert(serializeChangelog(data));
  return getChangelogById(id) as Promise<Changelog>;
}

export async function updateChangelog(
  id: number,
  data: Partial<CreateChangelogInput>
): Promise<Changelog> {
  await db('changelogs')
    .where('id', id)
    .update({ ...serializeChangelog(data as CreateChangelogInput), updated_at: db.fn.now() });
  return getChangelogById(id) as Promise<Changelog>;
}

export async function deleteChangelog(id: number): Promise<boolean> {
  const deleted = await db('changelogs').where('id', id).delete();
  return deleted > 0;
}

export async function publishChangelog(id: number): Promise<Changelog> {
  await db('changelogs').where('id', id).update({
    status: 'published',
    release_date: db.fn.now(),
    updated_at: db.fn.now()
  });
  return getChangelogById(id) as Promise<Changelog>;
}
