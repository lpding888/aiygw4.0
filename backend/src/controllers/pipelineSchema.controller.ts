import type { Request, Response, NextFunction } from 'express';
import pipelineSchemaService, {
  type ValidationType
} from '../services/pipelineSchema.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

const VALIDATION_TYPE_VALUES: ValidationType[] = [
  'topology',
  'variables',
  'completeness',
  'constraints'
];

const parseBooleanQuery = (value?: string): boolean | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
};

const normalizeValidationTypes = (types?: string[]): ValidationType[] | undefined => {
  if (!types || types.length === 0) return undefined;
  const normalized = types
    .map((type) => type?.toLowerCase())
    .filter((value): value is ValidationType =>
      VALIDATION_TYPE_VALUES.includes(value as ValidationType)
    );
  return normalized.length > 0 ? normalized : undefined;
};

type BatchValidationResult = {
  schema_id: string;
  success: boolean;
  result?: unknown;
  error?: string;
};

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

      const parsedIsValid = parseBooleanQuery(is_valid);
      const parsedSortOrder: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

      const result = await pipelineSchemaService.getSchemas({
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        category,
        status,
        is_valid: parsedIsValid,
        search,
        sortBy,
        sortOrder: parsedSortOrder
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
      const schema = await pipelineSchemaService.getSchemaById(id);
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
      const schema = await pipelineSchemaService.createSchema(schemaData, userId);
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
      const schema = await pipelineSchemaService.updateSchema(id, updateData, userId);
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
      await pipelineSchemaService.deleteSchema(id, userId);
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
      const normalizedTypes = normalizeValidationTypes(validation_types);
      const result = await pipelineSchemaService.validateSchema(id, normalizedTypes, userId);
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
      const result = await pipelineSchemaService.getValidationHistory(id, {
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
      const categories = await pipelineSchemaService.getSchemaCategories();
      res.json({ success: true, data: categories, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineSchemaController] Get categories failed:', error);
      next(error);
    }
  }

  async getSchemaStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await pipelineSchemaService.getSchemaStats();
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
      const results: BatchValidationResult[] = [];
      let success_count = 0;
      let failed_count = 0;
      const normalizedTypes = normalizeValidationTypes(validation_types);

      for (const schemaId of schema_ids) {
        try {
          const result = await pipelineSchemaService.validateSchema(
            schemaId,
            normalizedTypes,
            userId
          );
          results.push({ schema_id: schemaId, success: true, result });
          if (result?.is_valid) success_count++;
          else failed_count++;
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          results.push({ schema_id: schemaId, success: false, error: errorMessage });
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
      const originalSchema = await pipelineSchemaService.getSchemaById(id);
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
      const clonedSchema = await pipelineSchemaService.createSchema(clonedData, userId);
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
