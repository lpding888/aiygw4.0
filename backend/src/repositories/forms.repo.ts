/**
 * 表单生成器仓库层
 */
import { db } from '../config/database.js';

export interface Form {
  id: number;
  name: string;
  slug: string;
  description?: string;
  type: string;
  settings?: string;
  success_message?: string;
  redirect_url?: string;
  notify_admin: boolean;
  notify_email?: string;
  status: string;
  start_time?: Date;
  end_time?: Date;
  max_submissions?: number;
  submission_count: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}
export interface FormField {
  id: number;
  form_id: number;
  name: string;
  label: string;
  type: string;
  options?: string;
  placeholder?: string;
  default_value?: string;
  validation?: string;
  required: boolean;
  sort_order: number;
  is_active: boolean;
}
export interface FormSubmission {
  id: number;
  form_id: number;
  user_id?: string;
  data?: string;
  ip_address?: string;
  user_agent?: string;
  status: string;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: Date;
  created_at: Date;
}

export async function listForms(
  options: { status?: string; limit?: number; offset?: number } = {}
): Promise<Form[]> {
  let query = db<Form>('forms').orderBy('created_at', 'desc');
  if (options.status) query = query.where('status', options.status);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}
export async function getFormById(id: number): Promise<Form | undefined> {
  return db<Form>('forms').where('id', id).first();
}
export async function getFormBySlug(slug: string): Promise<Form | undefined> {
  return db<Form>('forms').where('slug', slug).first();
}
export async function createForm(data: Partial<Form>): Promise<Form> {
  const [id] = await db('forms').insert(data);
  return getFormById(id) as Promise<Form>;
}
export async function updateForm(id: number, data: Partial<Form>): Promise<Form> {
  await db('forms')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getFormById(id) as Promise<Form>;
}
export async function deleteForm(id: number): Promise<boolean> {
  return (await db('forms').where('id', id).delete()) > 0;
}

export async function getFormFields(formId: number): Promise<FormField[]> {
  return db<FormField>('form_fields').where('form_id', formId).orderBy('sort_order');
}
export async function createFormField(data: Partial<FormField>): Promise<FormField> {
  const [id] = await db('form_fields').insert(data);
  return db<FormField>('form_fields').where('id', id).first() as Promise<FormField>;
}
export async function updateFormField(id: number, data: Partial<FormField>): Promise<FormField> {
  await db('form_fields')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return db<FormField>('form_fields').where('id', id).first() as Promise<FormField>;
}
export async function deleteFormField(id: number): Promise<boolean> {
  return (await db('form_fields').where('id', id).delete()) > 0;
}

export async function listSubmissions(
  formId: number,
  options: { status?: string; limit?: number; offset?: number } = {}
): Promise<FormSubmission[]> {
  let query = db<FormSubmission>('form_submissions')
    .where('form_id', formId)
    .orderBy('created_at', 'desc');
  if (options.status) query = query.where('status', options.status);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}
export async function createSubmission(data: Partial<FormSubmission>): Promise<FormSubmission> {
  const [id] = await db('form_submissions').insert(data);
  await db('forms').where('id', data.form_id).increment('submission_count', 1);
  return db<FormSubmission>('form_submissions').where('id', id).first() as Promise<FormSubmission>;
}
export async function updateSubmission(
  id: number,
  data: Partial<FormSubmission>
): Promise<FormSubmission> {
  await db('form_submissions')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return db<FormSubmission>('form_submissions').where('id', id).first() as Promise<FormSubmission>;
}
