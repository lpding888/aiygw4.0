import type { Request, Response, NextFunction } from 'express';
import uiSchemaService from '../services/ui-schema.service.js';
import logger from '../utils/logger.js';

class UiSchemaController {
  async getMenus(req: Request, res: Response, next: NextFunction) {
    try {
      const userRole = (req as any).userRole || req.user?.role || 'viewer';
      const menus = await (uiSchemaService as any).getMenus(userRole);
      res.json({ success: true, data: menus, requestId: req.id });
    } catch (error) {
      logger.error('[UiSchemaController] Get menus failed:', error);
      next(error);
    }
  }

  async getUiSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const userRole = (req as any).userRole || req.user?.role || 'viewer';
      const schema = await (uiSchemaService as any).getUISchema(userRole);
      res.json({ success: true, data: schema, requestId: req.id });
    } catch (error) {
      logger.error('[UiSchemaController] Get UI schema failed:', error);
      next(error);
    }
  }

  async getFeatureUiConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { featureKey } = req.params as { featureKey: string };
      const userRole = (req as any).userRole || req.user?.role || 'viewer';
      const config = await (uiSchemaService as any).getFeatureUiConfig(featureKey, userRole);
      res.json({ success: true, data: config, requestId: req.id });
    } catch (error) {
      logger.error('[UiSchemaController] Get feature UI config failed:', error);
      next(error);
    }
  }

  async invalidateCache(_req: Request, res: Response, next: NextFunction) {
    try {
      await (uiSchemaService as any).invalidateCache();
      res.json({
        success: true,
        message: 'UI缓存已失效',
        requestId: res.locals?.requestId ?? null
      });
    } catch (error) {
      logger.error('[UiSchemaController] Invalidate cache failed:', error);
      next(error);
    }
  }

  async getUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.user?.role || (req as any).userRole || 'viewer';
      res.json({
        success: true,
        data: { role, permissions: (req as any).userPermissions || {} },
        requestId: req.id
      });
    } catch (error) {
      logger.error('[UiSchemaController] Get user role failed:', error);
      next(error);
    }
  }

  async healthCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: { uiSchema: 'ok', cache: 'ok', rbac: 'ok' }
      };
      res.json({ success: true, data: stats, requestId: req.id });
    } catch (error) {
      logger.error('[UiSchemaController] Health check failed:', error);
      next(error);
    }
  }
}

export default new UiSchemaController();
