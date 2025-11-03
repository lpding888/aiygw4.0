const pipelineSchemaService = require('../services/pipelineSchema.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Pipeline Schema 控制器
 */
class PipelineSchemaController {
  /**
   * 获取Schema列表
   */
  async getSchemas(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        status,
        is_valid,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const result = await pipelineSchemaService.getSchemas({
        page: parseInt(page),
        limit: parseInt(limit),
        category,
        status,
        is_valid,
        search,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineSchemaController] Get schemas failed:', error);
      next(error);
    }
  }

  /**
   * 获取Schema详情
   */
  async getSchemaById(req, res, next) {
    try {
      const { id } = req.params;
      const schema = await pipelineSchemaService.getSchemaById(id);

      res.json({
        success: true,
        data: schema,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineSchemaController] Get schema by ID failed:', error);
      next(error);
    }
  }

  /**
   * 创建Schema
   */
  async createSchema(req, res, next) {
    try {
      const userId = req.user.id;
      const schemaData = {
        ...req.body,
        created_by: userId
      };

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

  /**
   * 更新Schema
   */
  async updateSchema(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = {
        ...req.body,
        updated_by: userId
      };

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

  /**
   * 删除Schema
   */
  async deleteSchema(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await pipelineSchemaService.deleteSchema(id, userId);

      res.json({
        success: true,
        message: '流程模板删除成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineSchemaController] Delete schema failed:', error);
      next(error);
    }
  }

  /**
   * 校验Schema
   */
  async validateSchema(req, res, next) {
    try {
      const { id } = req.params;
      const { validation_types } = req.body;
      const userId = req.user.id;

      const result = await pipelineSchemaService.validateSchema(id, validation_types, userId);

      res.json({
        success: true,
        data: result,
        message: result.is_valid ? '校验通过' : '校验发现问题',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineSchemaController] Validate schema failed:', error);
      next(error);
    }
  }

  /**
   * 获取校验历史
   */
  async getValidationHistory(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await pipelineSchemaService.getValidationHistory(id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineSchemaController] Get validation history failed:', error);
      next(error);
    }
  }

  /**
   * 获取Schema分类列表
   */
  async getSchemaCategories(req, res, next) {
    try {
      const categories = await pipelineSchemaService.getSchemaCategories();

      res.json({
        success: true,
        data: categories,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineSchemaController] Get categories failed:', error);
      next(error);
    }
  }

  /**
   * 获取Schema统计
   */
  async getSchemaStats(req, res, next) {
    try {
      const stats = await pipelineSchemaService.getSchemaStats();

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineSchemaController] Get stats failed:', error);
      next(error);
    }
  }

  /**
   * 批量校验Schema
   */
  async batchValidateSchemas(req, res, next) {
    try {
      const { schema_ids, validation_types } = req.body;
      const userId = req.user.id;

      if (!schema_ids || !Array.isArray(schema_ids)) {
        throw new AppError('请提供要校验的Schema ID列表', 400);
      }

      const results = [];
      let success_count = 0;
      let failed_count = 0;

      for (const schemaId of schema_ids) {
        try {
          const result = await pipelineSchemaService.validateSchema(schemaId, validation_types, userId);
          results.push({
            schema_id: schemaId,
            success: true,
            result: result
          });
          if (result.is_valid) {
            success_count++;
          } else {
            failed_count++;
          }
        } catch (error) {
          results.push({
            schema_id: schemaId,
            success: false,
            error: error.message
          });
          failed_count++;
        }
      }

      res.json({
        success: true,
        data: {
          results: results,
          summary: {
            total: schema_ids.length,
            success: success_count,
            failed: failed_count
          }
        },
        message: `批量校验完成: ${success_count} 通过, ${failed_count} 失败`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineSchemaController] Batch validate schemas failed:', error);
      next(error);
    }
  }

  /**
   * 克隆Schema
   */
  async cloneSchema(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user.id;

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

module.exports = new PipelineSchemaController();