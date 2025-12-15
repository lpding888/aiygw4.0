/**
 * 表单生成器控制器
 */
import { Request, Response, NextFunction } from 'express';
import * as formsRepo from '../repositories/forms.repo.js';

class FormsController {
  async listForms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const forms = await formsRepo.listForms({
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: forms } });
    } catch (error) {
      next(error);
    }
  }

  async getForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const form = await formsRepo.getFormById(parseInt(req.params.id));
      if (!form) {
        res.status(404).json({ success: false, error: { message: '表单不存在' } });
        return;
      }
      const fields = await formsRepo.getFormFields(form.id);
      res.json({ success: true, data: { ...form, fields } });
    } catch (error) {
      next(error);
    }
  }

  async createForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const form = await formsRepo.createForm({ ...req.body, created_by: req.user?.id });
      res.status(201).json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  async updateForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const form = await formsRepo.updateForm(parseInt(req.params.id), req.body);
      res.json({ success: true, data: form });
    } catch (error) {
      next(error);
    }
  }

  async deleteForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await formsRepo.deleteForm(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async createField(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const field = await formsRepo.createFormField({
        ...req.body,
        form_id: parseInt(req.params.formId)
      });
      res.status(201).json({ success: true, data: field });
    } catch (error) {
      next(error);
    }
  }

  async updateField(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const field = await formsRepo.updateFormField(parseInt(req.params.id), req.body);
      res.json({ success: true, data: field });
    } catch (error) {
      next(error);
    }
  }

  async deleteField(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await formsRepo.deleteFormField(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async listSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const submissions = await formsRepo.listSubmissions(parseInt(req.params.formId), {
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: submissions } });
    } catch (error) {
      next(error);
    }
  }

  async submitForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const form = await formsRepo.getFormBySlug(req.params.slug);
      if (!form || form.status !== 'active') {
        res.status(404).json({ success: false, error: { message: '表单不存在或已关闭' } });
        return;
      }
      const submission = await formsRepo.createSubmission({
        form_id: form.id,
        user_id: req.user?.id,
        data: JSON.stringify(req.body),
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });
      res.json({ success: true, data: submission, message: form.success_message || '提交成功' });
    } catch (error) {
      next(error);
    }
  }
}

export default new FormsController();
