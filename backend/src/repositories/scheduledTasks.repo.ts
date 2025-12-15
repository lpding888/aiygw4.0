/**
 * 定时发布仓库层
 */
import { db } from '../config/database.js';

export interface ScheduledTask {
  id: number;
  name: string;
  entity_type: string;
  entity_id: number;
  action: 'publish' | 'unpublish' | 'update' | 'delete' | 'notify';
  payload?: string;
  scheduled_at: Date;
  executed_at?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  result?: string;
  retry_count: number;
  max_retries: number;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export async function listScheduledTasks(
  options: { status?: string; entityType?: string; limit?: number; offset?: number } = {}
): Promise<ScheduledTask[]> {
  let query = db<ScheduledTask>('scheduled_tasks').orderBy('scheduled_at');
  if (options.status) query = query.where('status', options.status);
  if (options.entityType) query = query.where('entity_type', options.entityType);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}

export async function getPendingTasks(): Promise<ScheduledTask[]> {
  return db<ScheduledTask>('scheduled_tasks')
    .where('status', 'pending')
    .where('scheduled_at', '<=', new Date())
    .orderBy('scheduled_at');
}

export async function getTaskById(id: number): Promise<ScheduledTask | undefined> {
  return db<ScheduledTask>('scheduled_tasks').where('id', id).first();
}

export async function createTask(data: Partial<ScheduledTask>): Promise<ScheduledTask> {
  const serialized = {
    ...data,
    payload: data.payload
      ? typeof data.payload === 'string'
        ? data.payload
        : JSON.stringify(data.payload)
      : undefined
  };
  const [id] = await db('scheduled_tasks').insert(serialized);
  return getTaskById(id) as Promise<ScheduledTask>;
}

export async function updateTask(id: number, data: Partial<ScheduledTask>): Promise<ScheduledTask> {
  await db('scheduled_tasks')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getTaskById(id) as Promise<ScheduledTask>;
}

export async function deleteTask(id: number): Promise<boolean> {
  return (await db('scheduled_tasks').where('id', id).delete()) > 0;
}

export async function cancelTask(id: number): Promise<ScheduledTask> {
  return updateTask(id, { status: 'cancelled' });
}

export async function markAsProcessing(id: number): Promise<ScheduledTask> {
  return updateTask(id, { status: 'processing' });
}

export async function markAsCompleted(id: number, result?: string): Promise<ScheduledTask> {
  return updateTask(id, {
    status: 'completed',
    executed_at: new Date() as unknown as Date,
    result
  });
}

export async function markAsFailed(id: number, error: string): Promise<ScheduledTask> {
  const task = await getTaskById(id);
  if (!task) throw new Error('任务不存在');
  const newRetryCount = task.retry_count + 1;
  const status = newRetryCount >= task.max_retries ? 'failed' : 'pending';
  return updateTask(id, { status, retry_count: newRetryCount, result: error });
}
