/**
 * SEO管理控制器
 */
import { Request, Response, NextFunction } from 'express';
import * as seoConfigsRepo from '../repositories/seoConfigs.repo.js';

class SeoConfigsController {
  async listConfigs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configs = await seoConfigsRepo.listSeoConfigs();
      res.json({ success: true, data: configs });
    } catch (error) {
      next(error);
    }
  }

  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await seoConfigsRepo.getSeoConfigById(parseInt(req.params.id));
      if (!config) {
        res.status(404).json({ success: false, error: { message: '配置不存在' } });
        return;
      }
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async createConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await seoConfigsRepo.createSeoConfig({
        ...req.body,
        updated_by: req.user?.id
      });
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await seoConfigsRepo.updateSeoConfig(parseInt(req.params.id), {
        ...req.body,
        updated_by: req.user?.id
      });
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async deleteConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await seoConfigsRepo.deleteSeoConfig(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getByPath(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { path } = req.query;
      const config = await seoConfigsRepo.getSeoConfigByPath(path as string);
      res.json({ success: true, data: config || null });
    } catch (error) {
      next(error);
    }
  }

  async getSitemap(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const urls = await seoConfigsRepo.generateSitemap();
      res.json({ success: true, data: urls });
    } catch (error) {
      next(error);
    }
  }

  async getSitemapXml(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const urls = await seoConfigsRepo.generateSitemap();
      const baseUrl = process.env.FRONTEND_URL || 'https://example.com';
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
      res.type('application/xml').send(xml);
    } catch (error) {
      next(error);
    }
  }
}

export default new SeoConfigsController();
