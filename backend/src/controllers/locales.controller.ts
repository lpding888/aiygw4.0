/**
 * 多语言管理控制器
 */
import { Request, Response, NextFunction } from 'express';
import * as localesRepo from '../repositories/locales.repo.js';

const toNumericUserId = (value?: string): number | undefined => {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

class LocalesController {
  async listLocales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive } = req.query;
      const locales = await localesRepo.listLocales(includeInactive === 'true');
      res.json({ success: true, data: locales });
    } catch (error) {
      next(error);
    }
  }

  async createLocale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const locale = await localesRepo.createLocale(req.body);
      res.status(201).json({ success: true, data: locale });
    } catch (error) {
      next(error);
    }
  }

  async updateLocale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const locale = await localesRepo.updateLocale(parseInt(req.params.id), req.body);
      res.json({ success: true, data: locale });
    } catch (error) {
      next(error);
    }
  }

  async deleteLocale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await localesRepo.deleteLocale(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getTranslations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const { namespace } = req.query;
      const translations = await localesRepo.getTranslations(code, namespace as string);
      res.json({ success: true, data: translations });
    } catch (error) {
      next(error);
    }
  }

  async setTranslation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const { namespace, key, value } = req.body;
      const translation = await localesRepo.setTranslation(
        code,
        namespace,
        key,
        value,
        toNumericUserId(req.user?.id)
      );
      res.json({ success: true, data: translation });
    } catch (error) {
      next(error);
    }
  }

  async batchSetTranslations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const { translations } = req.body;
      const count = await localesRepo.batchSetTranslations(
        code,
        translations,
        toNumericUserId(req.user?.id)
      );
      res.json({ success: true, data: { updated: count } });
    } catch (error) {
      next(error);
    }
  }

  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await localesRepo.getTranslationStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export default new LocalesController();
