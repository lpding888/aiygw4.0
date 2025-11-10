/**
 * Prompt模板中心服务
 *
 * 管理提示词模板，支持预览、变量校验、版本控制和分类管理
 */

import { db as knex } from '../db/index.js';
const logger = require('../utils/logger');
const configCacheService = require('../cache/config-cache');
const { v4: uuidv4 } = require('uuid');

// Knex transaction type - flexible type to handle Knex transaction objects
type KnexTransaction = unknown;

// Database row type
interface DbTemplateRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string;
  template: string;
  variables: string;
  version: string;
  status: string;
  published_at?: Date;
  metadata: string;
  examples: string;
  config: string;
  usage_stats: string;
  created_by: string;
  updated_by: string;
  created_at: Date;
  updated_at: Date;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  template: string;
  variables: TemplateVariable[];
  version: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  metadata: {
    author?: string;
    usage?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    estimatedTokens?: number;
    language?: string;
    modelCompatibility?: string[];
  };
  examples: TemplateExample[];
  config: {
    allowCustomVariables: boolean;
    requireAllVariables: boolean;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  };
  usageStats: {
    usedCount: number;
    lastUsedAt?: Date;
    avgRating: number;
    ratingCount: number;
  };
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
    minLength?: number;
    maxLength?: number;
  };
  options?: string[];
}

interface TemplateExample {
  id: string;
  name: string;
  description: string;
  variables: Record<string, unknown>;
  output: string;
  rating?: number;
}

interface TemplateValidation {
  valid: boolean;
  errors: Array<{
    type: 'syntax' | 'variable' | 'logic' | 'security';
    message: string;
    line?: number;
    column?: number;
    variable?: string;
  }>;
  warnings: Array<{
    type: 'performance' | 'style' | 'suggestion';
    message: string;
  }>;
  extractedVariables: string[];
  estimatedTokens: number;
  complexity: 'simple' | 'medium' | 'complex';
}

interface TemplatePreview {
  rendered: string;
  variables: Record<string, unknown>;
  estimatedTokens: number;
  renderingTime: number;
}

interface TemplateSnapshot {
  id: string;
  templateId: string;
  version: string;
  template: PromptTemplate;
  action: 'create' | 'update' | 'delete' | 'publish' | 'rollback';
  description: string;
  createdBy: string;
  createdAt: Date;
}

class PromptTemplateService {
  private readonly CACHE_SCOPE = 'prompt_templates';
  private readonly DEFAULT_VERSION = '1.0.0';

  /**
   * 创建Prompt模板
   */
  async createTemplate(
    templateData: Partial<PromptTemplate>,
    createdBy: string
  ): Promise<PromptTemplate> {
    const templateId = this.generateId();

    // 验证模板
    const validation = await this.validateTemplate(
      templateData.template || '',
      templateData.variables || []
    );
    if (!validation.valid) {
      throw new Error(`模板验证失败: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const template: PromptTemplate = {
      id: templateId,
      name: templateData.name!,
      description: templateData.description || '',
      category: templateData.category || 'general',
      tags: templateData.tags || [],
      template: templateData.template!,
      variables: templateData.variables || [],
      version: '1.0.0',
      status: 'draft',
      metadata: {
        author: templateData.metadata?.author || createdBy,
        usage: templateData.metadata?.usage || '',
        complexity: validation.complexity,
        estimatedTokens: validation.estimatedTokens,
        language: templateData.metadata?.language || 'zh-CN',
        modelCompatibility: templateData.metadata?.modelCompatibility || ['gpt-3.5-turbo', 'gpt-4']
      },
      examples: templateData.examples || [],
      config: {
        allowCustomVariables: templateData.config?.allowCustomVariables !== false,
        requireAllVariables: templateData.config?.requireAllVariables !== false,
        maxTokens: templateData.config?.maxTokens,
        temperature: templateData.config?.temperature,
        topP: templateData.config?.topP
      },
      usageStats: {
        usedCount: 0,
        avgRating: 0,
        ratingCount: 0
      },
      createdBy,
      updatedBy: createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await knex.transaction(async (trx) => {
        // 插入模板
        await trx('prompt_templates').insert({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          tags: JSON.stringify(template.tags),
          template: template.template,
          variables: JSON.stringify(template.variables),
          version: template.version,
          status: template.status,
          metadata: JSON.stringify(template.metadata),
          examples: JSON.stringify(template.examples),
          config: JSON.stringify(template.config),
          usage_stats: JSON.stringify(template.usageStats),
          created_by: template.createdBy,
          updated_by: template.updatedBy,
          created_at: template.createdAt,
          updated_at: template.updatedAt
        });

        // 创建快照
        await this.createSnapshot(trx, template, 'create', '创建Prompt模板', createdBy);
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('Prompt模板已创建', { templateId, name: template.name, createdBy });
      return template;
    } catch (error) {
      logger.error('创建Prompt模板失败:', error);
      throw error;
    }
  }

  /**
   * 更新Prompt模板
   */
  async updateTemplate(
    templateId: string,
    updateData: Partial<PromptTemplate>,
    updatedBy: string
  ): Promise<PromptTemplate> {
    const existingTemplate = await this.getTemplate(templateId);
    if (!existingTemplate) {
      throw new Error('Prompt模板不存在');
    }

    // 如果更新了模板内容，需要重新验证
    if (updateData.template) {
      const variables = updateData.variables || existingTemplate.variables;
      const validation = await this.validateTemplate(updateData.template, variables);
      if (!validation.valid) {
        throw new Error(`模板验证失败: ${validation.errors.map((e) => e.message).join(', ')}`);
      }
    }

    try {
      await knex.transaction(async (trx) => {
        const newVersion = this.incrementVersion(existingTemplate.version);
        const now = new Date();

        const updateFields: Record<string, unknown> = {
          version: newVersion,
          updated_by: updatedBy,
          updated_at: now
        };

        const updatedTemplate = { ...existingTemplate };

        const applyUpdate = (
          property: keyof PromptTemplate,
          column: string,
          transformDb?: (value: unknown) => unknown,
          transformSnapshot?: (value: unknown) => unknown
        ) => {
          if (!Object.prototype.hasOwnProperty.call(updateData, property)) {
            return;
          }

          const rawValue = (updateData as Record<string, unknown>)[property];
          updateFields[column] = transformDb ? transformDb(rawValue) : rawValue;
          (updatedTemplate as Record<string, unknown>)[property] = transformSnapshot
            ? transformSnapshot(rawValue)
            : rawValue;
        };

        applyUpdate('name', 'name');
        applyUpdate('description', 'description');
        applyUpdate('category', 'category');
        applyUpdate('template', 'template');
        applyUpdate(
          'tags',
          'tags',
          (value) => JSON.stringify(value || []),
          (value) => value || []
        );
        applyUpdate(
          'variables',
          'variables',
          (value) => JSON.stringify(value || []),
          (value) => value || []
        );
        applyUpdate(
          'metadata',
          'metadata',
          (value) => JSON.stringify(value || {}),
          (value) => value || {}
        );
        applyUpdate(
          'examples',
          'examples',
          (value) => JSON.stringify(value || []),
          (value) => value || []
        );
        applyUpdate(
          'config',
          'config',
          (value) => JSON.stringify(value || {}),
          (value) => value || {}
        );
        applyUpdate(
          'usageStats',
          'usage_stats',
          (value) =>
            JSON.stringify(
              value || {
                usedCount: 0,
                avgRating: 0,
                ratingCount: 0
              }
            ),
          (value) => value || existingTemplate.usageStats
        );
        applyUpdate(
          'status',
          'status',
          (value) => {
            if (value === 'published' || value === 'archived') {
              return value;
            }
            return 'draft';
          },
          (value) => (value === 'published' || value === 'archived' ? value : 'draft')
        );

        // 状态默认回到草稿（除非显式传入允许的状态）
        if (!Object.prototype.hasOwnProperty.call(updateData, 'status')) {
          updateFields.status = 'draft';
          (updatedTemplate as Record<string, unknown>).status = 'draft';
        }

        await trx('prompt_templates').where('id', templateId).update(updateFields);

        updatedTemplate.version = newVersion;
        updatedTemplate.updatedBy = updatedBy;
        updatedTemplate.updatedAt = now;

        await this.createSnapshot(trx, updatedTemplate, 'update', '更新Prompt模板', updatedBy);
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('Prompt模板已更新', { templateId, updatedBy });
      const updatedResult = await this.getTemplate(templateId);
      if (!updatedResult) {
        throw new Error('更新Prompt模板后无法读取');
      }
      return updatedResult;
    } catch (error) {
      logger.error('更新Prompt模板失败:', error);
      throw error;
    }
  }

  /**
   * 发布Prompt模板
   */
  async publishTemplate(templateId: string, publishedBy: string): Promise<boolean> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Prompt模板不存在');
    }

    if (template.status === 'published') {
      logger.warn('Prompt模板已经是发布状态', { templateId });
      return true;
    }

    // 最终验证
    const validation = await this.validateTemplate(template.template, template.variables);
    if (!validation.valid) {
      throw new Error(
        `模板验证失败，无法发布: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    try {
      await knex.transaction(async (trx) => {
        // 更新为发布状态
        await trx('prompt_templates').where('id', templateId).update({
          status: 'published',
          published_at: new Date(),
          updated_by: publishedBy,
          updated_at: new Date()
        });

        // 创建发布快照
        const publishedTemplate: PromptTemplate = {
          ...template,
          status: 'published'
        };
        await this.createSnapshot(trx, publishedTemplate, 'publish', '发布Prompt模板', publishedBy);
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('Prompt模板已发布', { templateId, name: template.name, publishedBy });
      return true;
    } catch (error) {
      logger.error('发布Prompt模板失败:', error);
      throw error;
    }
  }

  /**
   * 回滚Prompt模板
   */
  async rollbackTemplate(
    templateId: string,
    targetVersion: string,
    rolledBy: string,
    reason?: string
  ): Promise<boolean> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Prompt模板不存在');
    }

    // 获取目标版本的快照
    const snapshot = await knex('prompt_template_snapshots')
      .where('template_id', templateId)
      .where('version', targetVersion)
      .where('action', 'in', ['create', 'update', 'publish'])
      .orderBy('created_at', 'desc')
      .first();

    if (!snapshot) {
      throw new Error(`版本 ${targetVersion} 的快照不存在`);
    }

    try {
      await knex.transaction(async (trx) => {
        // 恢复模板配置
        const rollbackTemplate = JSON.parse(snapshot.template);

        await trx('prompt_templates')
          .where('id', templateId)
          .update({
            name: rollbackTemplate.name,
            description: rollbackTemplate.description,
            category: rollbackTemplate.category,
            tags: JSON.stringify(rollbackTemplate.tags),
            template: rollbackTemplate.template,
            variables: JSON.stringify(rollbackTemplate.variables),
            version: this.incrementVersion(targetVersion),
            status: 'published',
            metadata: JSON.stringify(rollbackTemplate.metadata),
            examples: JSON.stringify(rollbackTemplate.examples),
            config: JSON.stringify(rollbackTemplate.config),
            updated_by: rolledBy,
            updated_at: new Date()
          });

        // 创建回滚快照
        const rolledBackTemplate = {
          ...rollbackTemplate,
          id: templateId,
          version: this.incrementVersion(targetVersion)
        };
        await this.createSnapshot(
          trx,
          rolledBackTemplate,
          'rollback',
          `回滚到版本 ${targetVersion}: ${reason || ''}`,
          rolledBy
        );
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('Prompt模板已回滚', { templateId, targetVersion, rolledBy, reason });
      return true;
    } catch (error) {
      logger.error('回滚Prompt模板失败:', error);
      throw error;
    }
  }

  /**
   * 删除Prompt模板
   */
  async deleteTemplate(templateId: string, deletedBy: string): Promise<boolean> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Prompt模板不存在');
    }

    if (template.status === 'published') {
      throw new Error('已发布的Prompt模板不能直接删除，请先回滚或归档');
    }

    try {
      await knex.transaction(async (trx) => {
        // 创建删除快照
        await this.createSnapshot(trx, template, 'delete', '删除Prompt模板', deletedBy);

        // 软删除模板
        await trx('prompt_templates').where('id', templateId).update({
          status: 'archived',
          updated_by: deletedBy,
          updated_at: new Date()
        });
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('Prompt模板已删除', { templateId, deletedBy });
      return true;
    } catch (error) {
      logger.error('删除Prompt模板失败:', error);
      throw error;
    }
  }

  /**
   * 获取Prompt模板
   */
  async getTemplate(templateId: string): Promise<PromptTemplate | null> {
    try {
      const cacheKey = `template:${templateId}`;

      return await configCacheService.getOrSet(
        {
          scope: this.CACHE_SCOPE,
          key: cacheKey,
          version: this.DEFAULT_VERSION
        },
        async () => {
          const template = await knex('prompt_templates').where('id', templateId).first();

          if (template) {
            return this.mapDbRowToTemplate(template);
          }

          return null;
        }
      );
    } catch (error) {
      logger.error(`获取Prompt模板失败: ${templateId}`, error);
      return null;
    }
  }

  /**
   * 根据名称获取Prompt模板
   */
  async getTemplateByName(name: string): Promise<PromptTemplate | null> {
    try {
      const template = await knex('prompt_templates')
        .where('name', name)
        .where('status', 'published')
        .first();

      return template ? this.mapDbRowToTemplate(template) : null;
    } catch (error) {
      logger.error(`根据名称获取Prompt模板失败: ${name}`, error);
      return null;
    }
  }

  /**
   * 获取Prompt模板列表
   */
  async getTemplates(
    filters: {
      status?: string;
      category?: string;
      tags?: string[];
      author?: string;
      complexity?: string;
      page?: number;
      limit?: number;
      sortBy?: 'created_at' | 'updated_at' | 'used_count' | 'avg_rating';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ templates: PromptTemplate[]; total: number }> {
    const {
      status,
      category,
      tags,
      author,
      complexity,
      page = 1,
      limit = 20,
      sortBy = 'updated_at',
      sortOrder = 'desc'
    } = filters;

    try {
      let query = knex('prompt_templates').select('*');

      // 应用过滤条件
      if (status) {
        query = query.where('status', status);
      }
      if (category) {
        query = query.where('category', category);
      }
      if (author) {
        query = query.whereRaw("JSON_EXTRACT(metadata, '$.author') = ?", [author]);
      }
      if (complexity) {
        query = query.whereRaw("JSON_EXTRACT(metadata, '$.complexity') = ?", [complexity]);
      }
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          query = query.whereRaw('JSON_CONTAINS(tags, ?)', [JSON.stringify(tag)]);
        }
      }

      // 获取总数
      const totalQuery = query.clone().clearSelect().count('* as count');
      const [{ count }] = await totalQuery;
      const total = parseInt(String(count));

      // 排序和分页
      const offset = (page - 1) * limit;

      interface TemplateRow extends Record<string, unknown> {
        id?: string;
        name?: string;
        description?: string;
        category?: string;
        tags?: string;
        template?: string;
        variables?: string;
        version?: string;
        status?: string;
        metadata?: string;
        examples?: string;
        config?: string;
        usage_stats?: string;
        created_by?: string;
        updated_by?: string;
        created_at?: Date;
        updated_at?: Date;
      }

      let sortedQuery = query;
      if (sortBy === 'used_count') {
        sortedQuery = query.orderByRaw(
          "JSON_EXTRACT(usage_stats, '$.usedCount') " + (sortOrder === 'asc' ? 'ASC' : 'DESC')
        ) as unknown as typeof query;
      } else if (sortBy === 'avg_rating') {
        sortedQuery = query.orderByRaw(
          "JSON_EXTRACT(usage_stats, '$.avgRating') " + (sortOrder === 'asc' ? 'ASC' : 'DESC')
        ) as unknown as typeof query;
      } else {
        sortedQuery = query.orderBy(sortBy, sortOrder);
      }

      const templates = (await sortedQuery.limit(limit).offset(offset)) as TemplateRow[];

      const mappedTemplates = templates.map((template) => {
        const dbRow: DbTemplateRow = {
          id: String(template.id),
          name: String(template.name),
          description: String(template.description),
          category: String(template.category),
          tags: String(template.tags),
          template: String(template.template),
          variables: String(template.variables),
          version: String(template.version),
          status: String(template.status),
          published_at: template.published_at as Date | undefined,
          metadata: String(template.metadata),
          examples: String(template.examples),
          config: String(template.config),
          usage_stats: String(template.usage_stats),
          created_by: String(template.created_by),
          updated_by: String(template.updated_by),
          created_at: template.created_at as Date,
          updated_at: template.updated_at as Date
        };
        return this.mapDbRowToTemplate(dbRow);
      });

      return { templates: mappedTemplates, total };
    } catch (error) {
      logger.error('获取Prompt模板列表失败:', error);
      return { templates: [], total: 0 };
    }
  }

  /**
   * 搜索Prompt模板
   */
  async searchTemplates(
    query: string,
    filters: {
      category?: string;
      tags?: string[];
      limit?: number;
    } = {}
  ): Promise<PromptTemplate[]> {
    const { category, tags, limit = 10 } = filters;

    try {
      let dbQuery = knex('prompt_templates')
        .where('status', 'published')
        .where(function () {
          this.where('name', 'like', `%${query}%`)
            .orWhere('description', 'like', `%${query}%`)
            .orWhere('template', 'like', `%${query}%`);
        });

      if (category) {
        dbQuery = dbQuery.where('category', category);
      }
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          dbQuery = dbQuery.whereRaw('JSON_CONTAINS(tags, ?)', [JSON.stringify(tag)]);
        }
      }

      const templates = await dbQuery
        .orderByRaw("JSON_EXTRACT(usage_stats, '$.usedCount') DESC")
        .limit(limit);

      return templates.map((template) => this.mapDbRowToTemplate(template));
    } catch (error) {
      logger.error('搜索Prompt模板失败:', error);
      return [];
    }
  }

  /**
   * 验证Prompt模板
   */
  async validateTemplate(
    template: string,
    variables: TemplateVariable[] = []
  ): Promise<TemplateValidation> {
    const errors: TemplateValidation['errors'] = [];
    const warnings: TemplateValidation['warnings'] = [];

    try {
      // 提取变量
      const extractedVariables = this.extractVariables(template);

      // 语法检查
      if (!template.trim()) {
        errors.push({
          type: 'syntax',
          message: '模板内容不能为空'
        });
      }

      // 变量检查
      const definedVariables = new Set(variables.map((v) => v.name));

      // 检查未定义的变量
      for (const variable of extractedVariables) {
        if (!definedVariables.has(variable) && variable !== 'user' && variable !== 'system') {
          errors.push({
            type: 'variable',
            message: `使用了未定义的变量: ${variable}`,
            variable
          });
        }
      }

      // 检查未使用的变量
      for (const variable of variables) {
        if (variable.required && !extractedVariables.includes(variable.name)) {
          warnings.push({
            type: 'suggestion',
            message: `必需变量未在模板中使用: ${variable.name}`
          });
        }
      }

      // 安全性检查
      const securityPatterns = [
        /system\s*\(/gi,
        /exec\s*\(/gi,
        /eval\s*\(/gi,
        /require\s*\(/gi,
        /import\s+.*\s+from/gi
      ];

      for (const pattern of securityPatterns) {
        if (pattern.test(template)) {
          errors.push({
            type: 'security',
            message: '模板包含潜在的不安全代码'
          });
          break;
        }
      }

      // 复杂度和Token估算
      const complexity = this.calculateComplexity(template);
      const estimatedTokens = this.estimateTokens(template);

      // 性能警告
      if (estimatedTokens > 4000) {
        warnings.push({
          type: 'performance',
          message: '模板较长，可能影响响应速度'
        });
      }

      if (extractedVariables.length > 20) {
        warnings.push({
          type: 'performance',
          message: '变量过多，可能影响模板维护性'
        });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        extractedVariables,
        estimatedTokens,
        complexity
      };
    } catch (error) {
      logger.error('验证Prompt模板失败:', error);
      return {
        valid: false,
        errors: [
          {
            type: 'syntax',
            message: '模板验证过程中发生错误'
          }
        ],
        warnings: [],
        extractedVariables: [],
        estimatedTokens: 0,
        complexity: 'simple'
      };
    }
  }

  /**
   * 预览Prompt模板
   */
  async previewTemplate(
    templateId: string,
    variables: Record<string, unknown>
  ): Promise<TemplatePreview> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Prompt模板不存在');
    }

    const startTime = Date.now();

    try {
      // 验证必需变量
      for (const templateVar of template.variables) {
        if (templateVar.required && !variables.hasOwnProperty(templateVar.name)) {
          throw new Error(`缺少必需变量: ${templateVar.name}`);
        }
      }

      // 应用默认值
      const mergedVariables = { ...variables };
      for (const templateVar of template.variables) {
        if (
          !mergedVariables.hasOwnProperty(templateVar.name) &&
          templateVar.defaultValue !== undefined
        ) {
          mergedVariables[templateVar.name] = templateVar.defaultValue;
        }
      }

      // 渲染模板
      const rendered = this.renderTemplate(template.template, mergedVariables);
      const renderingTime = Date.now() - startTime;

      // 更新使用统计
      await this.updateUsageStats(templateId);

      return {
        rendered,
        variables: mergedVariables,
        estimatedTokens: this.estimateTokens(rendered),
        renderingTime
      };
    } catch (error) {
      logger.error(`预览Prompt模板失败: ${templateId}`, error);
      throw error;
    }
  }

  /**
   * 评价Prompt模板
   */
  async rateTemplate(templateId: string, userId: string, rating: number): Promise<boolean> {
    if (rating < 1 || rating > 5) {
      throw new Error('评分必须在1-5之间');
    }

    try {
      // 检查是否已经评价过
      const existingRating = await knex('prompt_template_ratings')
        .where('template_id', templateId)
        .where('user_id', userId)
        .first();

      await knex.transaction(async (trx) => {
        if (existingRating) {
          // 更新评价
          await trx('prompt_template_ratings').where('id', existingRating.id).update({
            rating,
            updated_at: new Date()
          });
        } else {
          // 新增评价
          await trx('prompt_template_ratings').insert({
            id: this.generateId(),
            template_id: templateId,
            user_id: userId,
            rating,
            created_at: new Date()
          });
        }

        // 重新计算平均评分
        await this.recalculateRating(templateId, trx);
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('Prompt模板评价已更新', { templateId, userId, rating });
      return true;
    } catch (error) {
      logger.error('评价Prompt模板失败:', error);
      throw error;
    }
  }

  /**
   * 获取模板历史
   */
  async getTemplateHistory(templateId: string): Promise<TemplateSnapshot[]> {
    try {
      const snapshots = await knex('prompt_template_snapshots')
        .where('template_id', templateId)
        .orderBy('created_at', 'desc');

      return snapshots.map((snapshot) => ({
        id: snapshot.id,
        templateId: snapshot.template_id,
        version: snapshot.version,
        template: JSON.parse(snapshot.template),
        action: snapshot.action,
        description: snapshot.description,
        createdBy: snapshot.created_by,
        createdAt: snapshot.created_at
      }));
    } catch (error) {
      logger.error(`获取Prompt模板历史失败: ${templateId}`, error);
      return [];
    }
  }

  /**
   * 获取热门标签
   */
  async getPopularTags(limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    try {
      const templates = await knex('prompt_templates').where('status', 'published').select('tags');

      const tagCounts = new Map<string, number>();

      for (const template of templates) {
        const tags = JSON.parse(template.tags || '[]');
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      logger.error('获取热门标签失败:', error);
      return [];
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byComplexity: Record<string, number>;
  }> {
    try {
      interface CountResult extends Record<string, unknown> {
        count?: number | string;
        status?: string;
        category?: string;
        complexity?: string;
      }

      interface TotalResult extends Record<string, unknown> {
        total?: number | string;
      }

      const [statusStats, categoryStats, complexityStats, totalTemplates] = await Promise.all([
        knex('prompt_templates').select('status').count('* as count').groupBy('status') as Promise<
          CountResult[]
        >,
        knex('prompt_templates')
          .select('category')
          .count('* as count')
          .groupBy('category') as Promise<CountResult[]>,
        knex('prompt_templates')
          .select(knex.raw("JSON_EXTRACT(metadata, '$.complexity') as complexity"))
          .count('* as count')
          .groupBy(knex.raw("JSON_EXTRACT(metadata, '$.complexity'")) as Promise<CountResult[]>,
        knex('prompt_templates').count('* as total').first() as Promise<TotalResult | undefined>
      ]);

      const totalValue =
        totalTemplates && typeof totalTemplates.total === 'string'
          ? parseInt(totalTemplates.total)
          : typeof totalTemplates?.total === 'number'
            ? totalTemplates.total
            : 0;

      return {
        total: totalValue,
        byStatus: statusStats.reduce((acc: Record<string, number>, row: CountResult) => {
          const status = row.status ?? '';
          const count = typeof row.count === 'string' ? parseInt(row.count) : (row.count ?? 0);
          acc[status] = count;
          return acc;
        }, {}),
        byCategory: categoryStats.reduce((acc: Record<string, number>, row: CountResult) => {
          const category = row.category ?? '';
          const count = typeof row.count === 'string' ? parseInt(row.count) : (row.count ?? 0);
          acc[category] = count;
          return acc;
        }, {}),
        byComplexity: complexityStats.reduce((acc: Record<string, number>, row: CountResult) => {
          if (row.complexity) {
            const count = typeof row.count === 'string' ? parseInt(row.count) : (row.count ?? 0);
            acc[row.complexity] = count;
          }
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('获取Prompt模板统计失败:', error);
      return {
        total: 0,
        byStatus: {},
        byCategory: {},
        byComplexity: {}
      };
    }
  }

  /**
   * 创建快照
   */
  private async createSnapshot(
    trx: KnexTransaction,
    template: PromptTemplate,
    action: string,
    description: string,
    createdBy: string
  ): Promise<void> {
    try {
      const trxAsFunction = trx as (table: string) => {
        insert: (data: object) => Promise<unknown>;
      };
      const tableQuery = trxAsFunction('prompt_template_snapshots');
      await tableQuery.insert({
        id: this.generateId(),
        template_id: template.id,
        version: template.version,
        template: JSON.stringify(template),
        action,
        description,
        created_by: createdBy,
        created_at: new Date()
      });
    } catch (error) {
      logger.error('创建快照失败:', error);
      throw error;
    }
  }

  /**
   * 提取模板变量
   */
  private extractVariables(template: string): string[] {
    const variables = new Set<string>();

    // 匹配 {{variable}} 格式
    const matches = template.match(/\{\{([^}]+)\}\}/g);
    if (matches) {
      for (const match of matches) {
        const variable = match.slice(2, -2).trim();
        variables.add(variable);
      }
    }

    return Array.from(variables);
  }

  /**
   * 计算模板复杂度
   */
  private calculateComplexity(template: string): 'simple' | 'medium' | 'complex' {
    const lines = template.split('\n').length;
    const variables = this.extractVariables(template).length;
    const words = template.split(/\s+/).length;

    if (lines < 10 && variables < 5 && words < 100) {
      return 'simple';
    } else if (lines < 30 && variables < 15 && words < 500) {
      return 'medium';
    } else {
      return 'complex';
    }
  }

  /**
   * 估算Token数量
   */
  private estimateTokens(text: string): number {
    // 简单的Token估算：中文按字符算，英文按单词数
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;

    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
  }

  /**
   * 渲染模板
   */
  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    // 处理未替换的变量
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '[未定义]');

    return rendered;
  }

  /**
   * 更新使用统计
   */
  private async updateUsageStats(templateId: string): Promise<void> {
    try {
      await knex('prompt_templates')
        .where('id', templateId)
        .update({
          usage_stats: knex.raw(
            `JSON_SET(
            JSON_SET(
              JSON_SET(usage_stats, '$.usedCount', JSON_EXTRACT(usage_stats, '$.usedCount') + 1),
              '$.lastUsedAt',
              ?
            ),
            '$.updated_at',
            ?
          )`,
            [new Date().toISOString(), new Date().toISOString()]
          ),
          updated_at: new Date()
        });
    } catch (error) {
      logger.error('更新使用统计失败:', error);
    }
  }

  /**
   * 重新计算评分
   */
  private async recalculateRating(templateId: string, trx: KnexTransaction): Promise<void> {
    interface RatingResult extends Record<string, unknown> {
      avgRating?: number | string;
      count?: number | string;
    }

    try {
      const trxAsFunction = trx as (table: string) => {
        where: (
          column: string,
          value: string
        ) => {
          avg: (expr: string) => {
            count: (expr: string) => {
              first: () => Promise<RatingResult>;
            };
          };
        };
      };

      const ratingTableQuery = trxAsFunction('prompt_template_ratings');
      const ratingChain = ratingTableQuery.where('template_id', templateId);
      const countChain = ratingChain.avg('rating as avgRating');
      const firstChain = countChain.count('* as count');
      const ratingResult = await firstChain.first();

      const avgRating = parseFloat(String(ratingResult?.avgRating)) || 0;
      const ratingCount = parseInt(String(ratingResult?.count)) || 0;

      const templateTableQuery = trxAsFunction('prompt_templates');
      const updateChain = templateTableQuery.where('id', templateId) as unknown as {
        update: (data: object) => Promise<unknown>;
      };

      await updateChain.update({
        usage_stats: knex.raw(
          `JSON_SET(
            JSON_SET(usage_stats, '$.avgRating', ?),
            '$.ratingCount',
            ?
          )`,
          [avgRating, ratingCount]
        )
      });
    } catch (error) {
      logger.error('重新计算评分失败:', error);
    }
  }

  /**
   * 将数据库行映射为PromptTemplate对象
   */
  private mapDbRowToTemplate(row: DbTemplateRow): PromptTemplate {
    const parseJson = (jsonStr: unknown, defaultValue: unknown = {}): unknown => {
      if (!jsonStr || typeof jsonStr !== 'string') {
        return defaultValue;
      }
      try {
        return JSON.parse(jsonStr);
      } catch {
        return defaultValue;
      }
    };

    const toStringValue = (value: unknown, defaultValue: string = ''): string => {
      return typeof value === 'string' ? value : defaultValue;
    };

    const toDateValue = (value: unknown, defaultValue: Date = new Date()): Date => {
      return value instanceof Date ? value : defaultValue;
    };

    const tags = parseJson(row.tags, []) as string[];
    const variables = parseJson(row.variables, []) as TemplateVariable[];
    const metadata = parseJson(row.metadata, {}) as PromptTemplate['metadata'];
    const examples = parseJson(row.examples, []) as TemplateExample[];
    const config = parseJson(row.config, {}) as PromptTemplate['config'];
    const usageStats = parseJson(row.usage_stats, {
      usedCount: 0,
      avgRating: 0,
      ratingCount: 0
    }) as PromptTemplate['usageStats'];

    return {
      id: toStringValue(row.id),
      name: toStringValue(row.name),
      description: toStringValue(row.description),
      category: toStringValue(row.category),
      tags,
      template: toStringValue(row.template),
      variables,
      version: toStringValue(row.version),
      status: (toStringValue(row.status) as 'draft' | 'published' | 'archived') || 'draft',
      publishedAt: row.published_at ? toDateValue(row.published_at) : undefined,
      metadata,
      examples,
      config,
      usageStats,
      createdBy: toStringValue(row.created_by),
      updatedBy: toStringValue(row.updated_by),
      createdAt: toDateValue(row.created_at),
      updatedAt: toDateValue(row.updated_at)
    };
  }

  /**
   * 递增版本号
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 失效缓存
   */
  private async invalidateCache(): Promise<void> {
    await configCacheService.invalidate(this.CACHE_SCOPE);
  }
}

const promptTemplateService = new PromptTemplateService();

// 导出类实例的所有方法
export const getTemplates = promptTemplateService.getTemplates.bind(promptTemplateService);
export const searchTemplates = promptTemplateService.searchTemplates.bind(promptTemplateService);
export const getPopularTags = promptTemplateService.getPopularTags.bind(promptTemplateService);
export const getTemplate = promptTemplateService.getTemplate.bind(promptTemplateService);
export const getTemplateHistory =
  promptTemplateService.getTemplateHistory.bind(promptTemplateService);
export const validateTemplate = promptTemplateService.validateTemplate.bind(promptTemplateService);
export const getStats = promptTemplateService.getStats.bind(promptTemplateService);
export const createTemplate = promptTemplateService.createTemplate.bind(promptTemplateService);
export const updateTemplate = promptTemplateService.updateTemplate.bind(promptTemplateService);
export const publishTemplate = promptTemplateService.publishTemplate.bind(promptTemplateService);
export const rollbackTemplate = promptTemplateService.rollbackTemplate.bind(promptTemplateService);
export const previewTemplate = promptTemplateService.previewTemplate.bind(promptTemplateService);
export const rateTemplate = promptTemplateService.rateTemplate.bind(promptTemplateService);
export const deleteTemplate = promptTemplateService.deleteTemplate.bind(promptTemplateService);

export default promptTemplateService;
