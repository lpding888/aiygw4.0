import type { Request, Response, NextFunction } from 'express';
import pipelineSchemaService from '../services/pipelineSchema.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

class PipelineSchemaController {
  async getSchemas(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = '1',
        limit = '20',
        category,
        status,
        is_valid,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query as Record<string, string>;

      const result = await (pipelineSchemaService as any).getSchemas({
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        category,
        status,
        is_valid,
        search,
        sortBy,
        sortOrder
      });

      res.json({ success: true, data: result, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineSchemaController] Get schemas failed:', error);
      next(error);
    }
  }

  async getSchemaById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const schema = await (pipelineSchemaService as any).getSchemaById(id);
      res.json({ success: true, data: schema, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineSchemaController] Get schema by ID failed:', error);
      next(error);
    }
  }

  async createSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id as string;
      const schemaData = { ...req.body, created_by: userId };
      const schema = await (pipelineSchemaService as any).createSchema(schemaData, userId);
      res.status(201).json({
        success: true,
        data: schema,
        message: '流程模板创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineSchemaController] Create schema failed:', error);
      next(error);
    }
  }

  async updateSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user?.id as string;
      const updateData = { ...req.body, updated_by: userId };
      const schema = await (pipelineSchemaService as any).updateSchema(id, updateData, userId);
      res.json({
        success: true,
        data: schema,
        message: '流程模板更新成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineSchemaController] Update schema failed:', error);
      next(error);
    }
  }

  async deleteSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user?.id as string;
      await (pipelineSchemaService as any).deleteSchema(id, userId);
      res.json({ success: true, message: '流程模板删除成功', requestId: req.id });
    } catch (error) {
      logger.error('[PipelineSchemaController] Delete schema failed:', error);
      next(error);
    }
  }

  async validateSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { validation_types } = req.body as { validation_types?: string[] };
      const userId = req.user?.id as string;
      const result = await (pipelineSchemaService as any).validateSchema(
        id,
        validation_types,
        userId
      );
      res.json({
        success: true,
        data: result,
        message: result?.is_valid ? '校验通过' : '校验发现问题',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineSchemaController] Validate schema failed:', error);
      next(error);
    }
  }

  async getValidationHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const result = await (pipelineSchemaService as any).getValidationHistory(id, {
        page: parseInt(String(page)),
        limit: parseInt(String(limit))
      });
      res.json({ success: true, data: result, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineSchemaController] Get validation history failed:', error);
      next(error);
    }
  }

  async getSchemaCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await (pipelineSchemaService as any).getSchemaCategories();
      res.json({ success: true, data: categories, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineSchemaController] Get categories failed:', error);
      next(error);
    }
  }

  async getSchemaStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await (pipelineSchemaService as any).getSchemaStats();
      res.json({ success: true, data: stats, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineSchemaController] Get stats failed:', error);
      next(error);
    }
  }

  async batchValidateSchemas(req: Request, res: Response, next: NextFunction) {
    try {
      const { schema_ids, validation_types } = req.body as {
        schema_ids: string[];
        validation_types?: string[];
      };
      const userId = req.user?.id as string;
      if (!schema_ids || !Array.isArray(schema_ids)) {
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '请提供要校验的Schema ID列表');
      }
      const results: any[] = [];
      let success_count = 0;
      let failed_count = 0;
      for (const schemaId of schema_ids) {
        try {
          const result = await (pipelineSchemaService as any).validateSchema(
            schemaId,
            validation_types,
            userId
          );
          results.push({ schema_id: schemaId, success: true, result });
          if (result?.is_valid) success_count++;
          else failed_count++;
        } catch (e: any) {
          results.push({ schema_id: schemaId, success: false, error: e?.message });
          failed_count++;
        }
      }
      res.json({
        success: true,
        data: {
          results,
          summary: { total: schema_ids.length, success: success_count, failed: failed_count }
        },
        message: `批量校验完成: ${success_count} 通过, ${failed_count} 失败`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineSchemaController] Batch validate schemas failed:', error);
      next(error);
    }
  }

  async cloneSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { name, description } = req.body as { name?: string; description?: string };
      const userId = req.user?.id as string;
      const originalSchema = await (pipelineSchemaService as any).getSchemaById(id);
      const clonedData = {
        name: name || `${originalSchema.name} (副本)`,
        description: description || `${originalSchema.description} (克隆)`,
        category: originalSchema.category,
        version: '1.0.0',
        schema_definition: originalSchema.schema_definition,
        node_definitions: originalSchema.node_definitions,
        edge_definitions: originalSchema.edge_definitions,
        input_schema: originalSchema.input_schema,
        output_schema: originalSchema.output_schema,
        variable_mappings: originalSchema.variable_mappings,
        validation_rules: originalSchema.validation_rules,
        constraints: originalSchema.constraints,
        status: 'draft'
      };
      const clonedSchema = await (pipelineSchemaService as any).createSchema(clonedData, userId);
      res.status(201).json({
        success: true,
        data: clonedSchema,
        message: '流程模板克隆成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineSchemaController] Clone schema failed:', error);
      next(error);
    }
  }
}

export default new PipelineSchemaController();
