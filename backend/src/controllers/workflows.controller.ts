/**
 * 工作流审批控制器
 */
import { Request, Response, NextFunction } from 'express';
import * as workflowsRepo from '../repositories/workflows.repo.js';

class WorkflowsController {
  async listWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive } = req.query;
      const workflows = await workflowsRepo.listWorkflows(includeInactive === 'true');
      res.json({ success: true, data: workflows });
    } catch (error) {
      next(error);
    }
  }

  async getWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflow = await workflowsRepo.getWorkflowById(parseInt(req.params.id));
      if (!workflow) {
        res.status(404).json({ success: false, error: { message: '工作流不存在' } });
        return;
      }
      const steps = await workflowsRepo.getWorkflowSteps(workflow.id);
      res.json({ success: true, data: { ...workflow, steps } });
    } catch (error) {
      next(error);
    }
  }

  async createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflow = await workflowsRepo.createWorkflow({
        ...req.body,
        created_by: req.user?.id
      });
      res.status(201).json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }

  async updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflow = await workflowsRepo.updateWorkflow(parseInt(req.params.id), req.body);
      res.json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }

  async deleteWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await workflowsRepo.deleteWorkflow(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async createStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const step = await workflowsRepo.createWorkflowStep({
        ...req.body,
        workflow_id: parseInt(req.params.workflowId)
      });
      res.status(201).json({ success: true, data: step });
    } catch (error) {
      next(error);
    }
  }

  async updateStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const step = await workflowsRepo.updateWorkflowStep(parseInt(req.params.id), req.body);
      res.json({ success: true, data: step });
    } catch (error) {
      next(error);
    }
  }

  async deleteStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await workflowsRepo.deleteWorkflowStep(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async listInstances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityType, entityId, status, limit = 50 } = req.query;
      const instances = await workflowsRepo.listWorkflowInstances({
        entityType: entityType as string,
        entityId: entityId ? parseInt(entityId as string) : undefined,
        status: status as string,
        limit: parseInt(limit as string)
      });
      res.json({ success: true, data: instances });
    } catch (error) {
      next(error);
    }
  }

  async startWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workflowCode, entityType, entityId } = req.body;
      const workflow = await workflowsRepo.getWorkflowByCode(workflowCode);
      if (!workflow) {
        res.status(404).json({ success: false, error: { message: '工作流不存在' } });
        return;
      }
      const instance = await workflowsRepo.createWorkflowInstance({
        workflow_id: workflow.id,
        entity_type: entityType,
        entity_id: entityId,
        initiated_by: req.user?.id,
        status: 'in_progress'
      });
      res.json({ success: true, data: instance });
    } catch (error) {
      next(error);
    }
  }

  async approveStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { comment } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: '未登录' } });
        return;
      }
      const instance = await workflowsRepo.approveStep(
        parseInt(req.params.id),
        userId,
        comment
      );
      res.json({ success: true, data: instance });
    } catch (error) {
      next(error);
    }
  }

  async rejectStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { comment } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: '未登录' } });
        return;
      }
      const instance = await workflowsRepo.rejectStep(
        parseInt(req.params.id),
        userId,
        comment
      );
      res.json({ success: true, data: instance });
    } catch (error) {
      next(error);
    }
  }
}

export default new WorkflowsController();
