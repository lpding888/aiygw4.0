/**
 * 多语言管理仓库层
 */
import { db } from '../config/database.js';

export interface Locale {
  id: number;
  code: string;
  name: string;
  native_name?: string;
  flag_icon?: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface Translation {
  id: number;
  locale_code: string;
  namespace: string;
  key: string;
  value?: string;
  description?: string;
  is_verified: boolean;
  updated_by?: number;
  created_at: Date;
  updated_at: Date;
}

export async function listLocales(includeInactive = false): Promise<Locale[]> {
  let query = db<Locale>('locales').orderBy('sort_order');
  if (!includeInactive) query = query.where('is_active', true);
  return query;
}

export async function getDefaultLocale(): Promise<Locale | undefined> {
  return db<Locale>('locales').where('is_default', true).first();
}

export async function getLocaleByCode(code: string): Promise<Locale | undefined> {
  return db<Locale>('locales').where('code', code).first();
}

export async function createLocale(data: Partial<Locale>): Promise<Locale> {
  const [id] = await db('locales').insert(data);
  return db<Locale>('locales').where('id', id).first() as Promise<Locale>;
}

export async function updateLocale(id: number, data: Partial<Locale>): Promise<Locale> {
  await db('locales')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return db<Locale>('locales').where('id', id).first() as Promise<Locale>;
}

export async function deleteLocale(id: number): Promise<boolean> {
  const locale = await db<Locale>('locales').where('id', id).first();
  if (locale?.is_default) throw new Error('不能删除默认语言');
  await db('translations').where('locale_code', locale?.code).delete();
  return (await db('locales').where('id', id).delete()) > 0;
}

// 翻译相关
export async function getTranslations(
  localeCode: string,
  namespace?: string
): Promise<Record<string, string>> {
  let query = db<Translation>('translations').where('locale_code', localeCode);
  if (namespace) query = query.where('namespace', namespace);
  const rows = await query;
  return rows.reduce(
    (acc, t) => {
      acc[`${t.namespace}.${t.key}`] = t.value || '';
      return acc;
    },
    {} as Record<string, string>
  );
}

export async function setTranslation(
  localeCode: string,
  namespace: string,
  key: string,
  value: string,
  updatedBy?: number
): Promise<Translation> {
  const existing = await db<Translation>('translations')
    .where({ locale_code: localeCode, namespace, key })
    .first();
  if (existing) {
    await db('translations')
      .where('id', existing.id)
      .update({ value, updated_by: updatedBy, updated_at: db.fn.now() });
    return { ...existing, value };
  }
  const [id] = await db('translations').insert({
    locale_code: localeCode,
    namespace,
    key,
    value,
    updated_by: updatedBy
  });
  return db<Translation>('translations').where('id', id).first() as Promise<Translation>;
}

export async function batchSetTranslations(
  localeCode: string,
  translations: { namespace: string; key: string; value: string }[],
  updatedBy?: number
): Promise<number> {
  for (const t of translations) {
    await setTranslation(localeCode, t.namespace, t.key, t.value, updatedBy);
  }
  return translations.length;
}

export async function deleteTranslation(
  localeCode: string,
  namespace: string,
  key: string
): Promise<boolean> {
  return (await db('translations').where({ locale_code: localeCode, namespace, key }).delete()) > 0;
}

export async function getTranslationStats(): Promise<
  { locale_code: string; count: number; verified: number }[]
> {
  return db('translations')
    .select('locale_code')
    .count('id as count')
    .sum(db.raw('CASE WHEN is_verified THEN 1 ELSE 0 END as verified'))
    .groupBy('locale_code');
}
