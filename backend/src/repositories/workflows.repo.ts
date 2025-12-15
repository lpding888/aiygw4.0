/**
 * 工作流审批仓库层
 */
import { db } from '../config/database.js';

export interface Workflow {
  id: number;
  name: string;
  code: string;
  description?: string;
  entity_type?: string;
  is_active: boolean;
  created_by?: string;
  created_at: Date;
}
export interface WorkflowStep {
  id: number;
  workflow_id: number;
  name: string;
  step_order: number;
  type: string;
  config?: string;
  approver_role?: string;
  approver_user_id?: string;
  timeout_hours?: number;
  timeout_action?: string;
}
export interface WorkflowInstance {
  id: number;
  workflow_id: number;
  entity_type: string;
  entity_id: number;
  current_step: number;
  status: string;
  history?: string;
  initiated_by?: string;
  started_at?: Date;
  completed_at?: Date;
}

export async function listWorkflows(includeInactive = false): Promise<Workflow[]> {
  let query = db<Workflow>('workflows').orderBy('name');
  if (!includeInactive) query = query.where('is_active', true);
  return query;
}
export async function getWorkflowById(id: number): Promise<Workflow | undefined> {
  return db<Workflow>('workflows').where('id', id).first();
}
export async function getWorkflowByCode(code: string): Promise<Workflow | undefined> {
  return db<Workflow>('workflows').where('code', code).first();
}
export async function createWorkflow(data: Partial<Workflow>): Promise<Workflow> {
  const [id] = await db('workflows').insert(data);
  return getWorkflowById(id) as Promise<Workflow>;
}
export async function updateWorkflow(id: number, data: Partial<Workflow>): Promise<Workflow> {
  await db('workflows')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getWorkflowById(id) as Promise<Workflow>;
}
export async function deleteWorkflow(id: number): Promise<boolean> {
  return (await db('workflows').where('id', id).delete()) > 0;
}

export async function getWorkflowSteps(workflowId: number): Promise<WorkflowStep[]> {
  return db<WorkflowStep>('workflow_steps').where('workflow_id', workflowId).orderBy('step_order');
}
export async function createWorkflowStep(data: Partial<WorkflowStep>): Promise<WorkflowStep> {
  const [id] = await db('workflow_steps').insert(data);
  return db<WorkflowStep>('workflow_steps').where('id', id).first() as Promise<WorkflowStep>;
}
export async function updateWorkflowStep(
  id: number,
  data: Partial<WorkflowStep>
): Promise<WorkflowStep> {
  await db('workflow_steps')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return db<WorkflowStep>('workflow_steps').where('id', id).first() as Promise<WorkflowStep>;
}
export async function deleteWorkflowStep(id: number): Promise<boolean> {
  return (await db('workflow_steps').where('id', id).delete()) > 0;
}

export async function listWorkflowInstances(
  options: { entityType?: string; entityId?: number; status?: string; limit?: number } = {}
): Promise<WorkflowInstance[]> {
  let query = db<WorkflowInstance>('workflow_instances').orderBy('created_at', 'desc');
  if (options.entityType) query = query.where('entity_type', options.entityType);
  if (options.entityId) query = query.where('entity_id', options.entityId);
  if (options.status) query = query.where('status', options.status);
  if (options.limit) query = query.limit(options.limit);
  return query;
}
export async function getWorkflowInstanceById(id: number): Promise<WorkflowInstance | undefined> {
  return db<WorkflowInstance>('workflow_instances').where('id', id).first();
}
export async function createWorkflowInstance(
  data: Partial<WorkflowInstance>
): Promise<WorkflowInstance> {
  const [id] = await db('workflow_instances').insert({ ...data, started_at: db.fn.now() });
  return getWorkflowInstanceById(id) as Promise<WorkflowInstance>;
}
export async function updateWorkflowInstance(
  id: number,
  data: Partial<WorkflowInstance>
): Promise<WorkflowInstance> {
  await db('workflow_instances')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getWorkflowInstanceById(id) as Promise<WorkflowInstance>;
}

export async function approveStep(
  instanceId: number,
  userId: string,
  comment?: string
): Promise<WorkflowInstance> {
  const instance = await getWorkflowInstanceById(instanceId);
  if (!instance) throw new Error('实例不存在');
  const steps = await getWorkflowSteps(instance.workflow_id);
  const history = instance.history ? JSON.parse(instance.history) : [];
  history.push({
    step: instance.current_step,
    action: 'approve',
    user_id: userId,
    comment,
    at: new Date()
  });
  const isLast = instance.current_step >= steps.length;
  await db('workflow_instances')
    .where('id', instanceId)
    .update({
      current_step: isLast ? instance.current_step : instance.current_step + 1,
      status: isLast ? 'approved' : 'in_progress',
      history: JSON.stringify(history),
      completed_at: isLast ? db.fn.now() : undefined
    });
  return getWorkflowInstanceById(instanceId) as Promise<WorkflowInstance>;
}

export async function rejectStep(
  instanceId: number,
  userId: string,
  comment?: string
): Promise<WorkflowInstance> {
  const instance = await getWorkflowInstanceById(instanceId);
  if (!instance) throw new Error('实例不存在');
  const history = instance.history ? JSON.parse(instance.history) : [];
  history.push({
    step: instance.current_step,
    action: 'reject',
    user_id: userId,
    comment,
    at: new Date()
  });
  await db('workflow_instances')
    .where('id', instanceId)
    .update({ status: 'rejected', history: JSON.stringify(history), completed_at: db.fn.now() });
  return getWorkflowInstanceById(instanceId) as Promise<WorkflowInstance>;
}
