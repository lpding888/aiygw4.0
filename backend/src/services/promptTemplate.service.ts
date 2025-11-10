import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import cmsCacheService from './cmsCache.service.js';
import type {
  PromptTemplate,
  TemplateQueryOptions,
  TemplateListResponse,
  VersionQueryOptions,
  VersionListResponse,
  PreviewResult,
  ValidationResult,
  TemplateStats,
  BatchPreviewItem,
  Variables,
  TemplateMetadata,
  TemplateStatus,
  TemplateCategory
} from '../types/prompt-template.types.js';

// 艹！PromptTemplate Service - 已消除所有any类型
interface CmsCache {
  generateVersion(scope: string, key: string): Promise<number>;
  createSnapshot(
    scope: string,
    key: string,
    data: unknown,
    action: string,
    description: string,
    userId: string
  ): Promise<void>;
  invalidate(scope: string, key: string): Promise<void>;
}

class PromptTemplateService {
  private readonly CACHE_SCOPE = 'prompt_templates';
  private readonly VARIABLE_PATTERN = /\{\{(\w+)\}\}/g; // {{variable}}
  private readonly VALID_CATEGORIES: TemplateCategory[] = ['system', 'user', 'assistant', 'function'];
  private readonly VALID_STATUSES: TemplateStatus[] = ['draft', 'published', 'archived'];

  async getTemplates(options: TemplateQueryOptions = {}): Promise<TemplateListResponse> {
    const {
      page = 1,
      limit = 20,
      category,
      status = 'published',
      search,
      sortBy = 'updated_at',
      sortOrder = 'desc',
      created_by
    } = options;
    const offset = (parseInt(String(page)) - 1) * parseInt(String(limit));

    let query = db('prompt_templates')
      .select([
        'prompt_templates.*',
        'creator.username as created_by_username',
        'updater.username as updated_by_username'
      ])
      .leftJoin('users as creator', 'prompt_templates.created_by', 'creator.id')
      .leftJoin('users as updater', 'prompt_templates.updated_by', 'updater.id');

    if (category) query = query.where('prompt_templates.category', category);
    if (status) {
      if (Array.isArray(status)) query = query.whereIn('prompt_templates.status', status);
      else query = query.where('prompt_templates.status', status);
    }
    if (created_by) query = query.where('prompt_templates.created_by', created_by);
    if (search) {
      query = query.where(function () {
        this.where('prompt_templates.name', 'like', `%${search}%`)
          .orWhere('prompt_templates.description', 'like', `%${search}%`)
          .orWhere('prompt_templates.content', 'like', `%${search}%`);
      });
    }

    const validSortFields = ['name', 'category', 'status', 'version', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updated_at';
    const sortDirection = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(`prompt_templates.${sortField}`, sortDirection);

    const rawTemplates = await query.limit(parseInt(String(limit))).offset(offset);

    let countQuery = db('prompt_templates');
    if (category) countQuery = countQuery.where('category', category);
    if (status) {
      if (Array.isArray(status)) countQuery = countQuery.whereIn('status', status);
      else countQuery = countQuery.where('status', status);
    }
    if (created_by) countQuery = countQuery.where('created_by', created_by);
    if (search) {
      countQuery = countQuery.where(function () {
        this.where('name', 'like', `%${search}%`)
          .orWhere('description', 'like', `%${search}%`)
          .orWhere('content', 'like', `%${search}%`);
      });
    }

    const totalResult = (await countQuery.count('* as count').first()) as { count: number };

    return {
      templates: rawTemplates.map((t) => this.parseTemplate(t)),
      pagination: {
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / parseInt(String(limit)))
      }
    };
  }

  async getTemplateById(id: string): Promise<PromptTemplate> {
    const template = await db('prompt_templates')
      .select([
        'prompt_templates.*',
        'creator.username as created_by_username',
        'updater.username as updated_by_username'
      ])
      .leftJoin('users as creator', 'prompt_templates.created_by', 'creator.id')
      .leftJoin('users as updater', 'prompt_templates.updated_by', 'updater.id')
      .where('prompt_templates.id', id)
      .first();
    if (!template) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '模板不存在');
    return this.parseTemplate(template);
  }

  async getTemplateByKey(key: string, version: number | null = null): Promise<PromptTemplate> {
    let query = db('prompt_templates').where('key', key);
    if (version !== null && version !== undefined) {
      query = query.where('version', version);
    } else {
      query = query.where('status', 'published').orderBy('version', 'desc');
    }
    const template = await query.first();
    if (!template) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '模板不存在');
    return this.parseTemplate(template);
  }

  async createTemplate(
    templateData: Partial<PromptTemplate> & {
      key: string;
      name: string;
      content: string;
      category: TemplateCategory;
    },
    userId: string
  ): Promise<PromptTemplate> {
    const {
      key,
      name,
      description,
      content,
      category,
      variables = {},
      metadata = {},
      status = 'draft'
    } = templateData;

    if (!this.VALID_CATEGORIES.includes(category)) {
      throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS, '无效的模板分类');
    }
    if (!this.VALID_STATUSES.includes(status as TemplateStatus)) {
      throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS, '无效的模板状态');
    }

    const version = await (cmsCacheService as unknown as CmsCache).generateVersion(
      this.CACHE_SCOPE,
      key
    );
    const [template] = await db('prompt_templates')
      .insert({
        key,
        name,
        description,
        content,
        category,
        variables: variables ? JSON.stringify(variables) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        status,
        version,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    await (cmsCacheService as unknown as CmsCache).createSnapshot(
      this.CACHE_SCOPE,
      key,
      template,
      'create',
      '创建模板',
      userId
    );
    await (cmsCacheService as unknown as CmsCache).invalidate(this.CACHE_SCOPE, key);
    logger.info('[PromptTemplateService] Template created', { key, userId });

    return this.parseTemplate(template);
  }

  async updateTemplate(
    id: string,
    updateData: Partial<PromptTemplate>,
    userId: string
  ): Promise<PromptTemplate> {
    const existing = await db('prompt_templates').where('id', id).first();
    if (!existing) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '模板不存在');

    const payload: Record<string, unknown> = {
      ...updateData,
      updated_by: userId,
      updated_at: new Date()
    };
    if (updateData.variables !== undefined) {
      payload.variables = JSON.stringify(updateData.variables);
    }
    if (updateData.metadata !== undefined) {
      payload.metadata = JSON.stringify(updateData.metadata);
    }

    const [updated] = await db('prompt_templates').where('id', id).update(payload).returning('*');

    await (cmsCacheService as unknown as CmsCache).createSnapshot(
      this.CACHE_SCOPE,
      existing.key as string,
      updated,
      'update',
      '更新模板',
      userId
    );
    await (cmsCacheService as unknown as CmsCache).invalidate(
      this.CACHE_SCOPE,
      existing.key as string
    );

    return this.parseTemplate(updated);
  }

  async deleteTemplate(id: string, userId: string): Promise<void> {
    const template = await this.getTemplateById(id);
    await db('prompt_templates').where('id', id).del();

    await (cmsCacheService as unknown as CmsCache).createSnapshot(
      this.CACHE_SCOPE,
      template.key,
      template,
      'delete',
      '删除模板',
      userId
    );
    await (cmsCacheService as unknown as CmsCache).invalidate(this.CACHE_SCOPE, template.key);
  }

  async publishTemplate(id: string, userId: string): Promise<PromptTemplate> {
    const template = await this.getTemplateById(id);
    if (template.status === 'published') {
      throw AppError.custom(ERROR_CODES.INVALID_REQUEST, '模板已发布');
    }

    const [published] = await db('prompt_templates')
      .where('id', id)
      .update({ status: 'published', updated_by: userId, updated_at: new Date() })
      .returning('*');

    await (cmsCacheService as unknown as CmsCache).createSnapshot(
      this.CACHE_SCOPE,
      template.key,
      published,
      'publish',
      '发布模板',
      userId
    );
    await (cmsCacheService as unknown as CmsCache).invalidate(this.CACHE_SCOPE, template.key);

    return this.parseTemplate(published);
  }

  async archiveTemplate(id: string, userId: string): Promise<PromptTemplate> {
    const template = await this.getTemplateById(id);
    const [archived] = await db('prompt_templates')
      .where('id', id)
      .update({ status: 'archived', updated_by: userId, updated_at: new Date() })
      .returning('*');

    await (cmsCacheService as unknown as CmsCache).createSnapshot(
      this.CACHE_SCOPE,
      template.key,
      archived,
      'archive',
      '归档模板',
      userId
    );
    await (cmsCacheService as unknown as CmsCache).invalidate(this.CACHE_SCOPE, template.key);

    return this.parseTemplate(archived);
  }

  async getTemplateVersions(
    templateId: string,
    options: VersionQueryOptions = {}
  ): Promise<VersionListResponse> {
    const { page = 1, limit = 20 } = options;
    const template = await this.getTemplateById(templateId);
    const offset = (page - 1) * limit;

    const totalResult = (await db('prompt_template_versions')
      .where({ template_id: templateId })
      .count('* as count')
      .first()) as { count: number };

    const versions = await db('prompt_template_versions')
      .where({ template_id: templateId })
      .select(['version', 'status', 'change_log', 'created_by', 'created_at'])
      .orderBy('version', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      template: { id: templateId, key: template.key, name: template.name },
      versions: versions.map((v) => ({
        version: v.version as number,
        status: v.status as TemplateStatus,
        change_log: v.change_log as string | null,
        created_by: v.created_by as string | number,
        created_at: v.created_at as string
      })),
      pagination: {
        current: page,
        pageSize: limit,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limit)
      }
    };
  }

  async rollbackToVersion(
    templateId: string,
    version: number,
    userId: string
  ): Promise<PromptTemplate> {
    const template = await this.getTemplateById(templateId);
    const latest = await db('prompt_templates').where('id', templateId).first();
    const versionRecord = await db('prompt_template_versions')
      .where({ template_id: templateId, version })
      .orderBy('created_at', 'desc')
      .first();

    if (!versionRecord) {
      throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '目标版本不存在');
    }

    const newVersion = ((latest?.version as number) || 0) + 1;
    const [rolledBackTemplate] = await db('prompt_templates')
      .where('id', templateId)
      .update({
        content: versionRecord.content,
        variables: versionRecord.variables,
        metadata: versionRecord.metadata,
        version: newVersion,
        updated_by: userId,
        updated_at: new Date()
      })
      .returning('*');

    logger.info('[PromptTemplateService] Template rolled back:', {
      templateId,
      fromVersion: template.version,
      toVersion: version,
      newVersion
    });

    return this.parseTemplate(rolledBackTemplate);
  }

  async previewTemplate(
    templateId: string,
    variables: Record<string, unknown> = {}
  ): Promise<PreviewResult> {
    const template = await this.getTemplateById(templateId);
    const requiredVariables = this.extractVariables(template.content);
    const missingVariables = requiredVariables.filter(
      (name) => !Object.prototype.hasOwnProperty.call(variables, name) || variables[name] === ''
    );

    if (missingVariables.length > 0) {
      throw AppError.custom(
        ERROR_CODES.MISSING_PARAMETERS,
        `缺少必需的变量: ${missingVariables.join(', ')}`
      );
    }

    const previewContent = this.replaceVariables(template.content, variables);
    return {
      templateId: template.id,
      templateKey: template.key,
      templateName: template.name,
      variables: { provided: variables, required: requiredVariables, missing: missingVariables },
      content: previewContent
    };
  }

  async validateTemplate(templateId: string): Promise<ValidationResult> {
    const template = await this.getTemplateById(templateId);
    const extractedVariables = this.extractVariables(template.content);
    const definedVariables = template.variables || {};
    const issues: string[] = [];
    const warnings: string[] = [];

    extractedVariables.forEach((varName) => {
      if (!Object.prototype.hasOwnProperty.call(definedVariables, varName)) {
        warnings.push(`变量 {{${varName}}} 未在模板定义中声明`);
      }
    });

    Object.keys(definedVariables).forEach((varName) => {
      if (!extractedVariables.includes(varName)) {
        warnings.push(`定义的变量 ${varName} 在模板中未使用`);
      }
    });

    Object.entries(definedVariables).forEach(([varName, varDef]) => {
      if (!varDef.type) warnings.push(`变量 ${varName} 缺少类型定义`);
      if (varDef.required && !varDef.default && !extractedVariables.includes(varName)) {
        warnings.push(`必需变量 ${varName} 有默认值但未在模板中使用`);
      }
    });

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      variables: {
        extracted: extractedVariables,
        defined: definedVariables,
        count: extractedVariables.length
      }
    };
  }

  async getTemplateStats(): Promise<TemplateStats> {
    const stats = (await db('prompt_templates')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(CASE WHEN status = "published" THEN 1 END) as published'),
        db.raw('COUNT(CASE WHEN status = "draft" THEN 1 END) as draft'),
        db.raw('COUNT(CASE WHEN status = "archived" THEN 1 END) as archived'),
        db.raw('COUNT(CASE WHEN category = "system" THEN 1 END) as system'),
        db.raw('COUNT(CASE WHEN category = "user" THEN 1 END) as user'),
        db.raw('COUNT(CASE WHEN category = "assistant" THEN 1 END) as assistant'),
        db.raw('COUNT(CASE WHEN category = "function" THEN 1 END) as function')
      )
      .first()) as TemplateStats;

    return stats;
  }

  async getTemplateCategories(): Promise<TemplateCategory[]> {
    return this.VALID_CATEGORIES;
  }

  async getTemplateExamples(): Promise<PromptTemplate[]> {
    const examples = await db('prompt_templates')
      .where('status', 'published')
      .limit(5)
      .orderBy('created_at', 'desc');
    return examples.map((t) => this.parseTemplate(t));
  }

  async batchPreviewTemplates(
    templates: BatchPreviewItem[]
  ): Promise<Array<PreviewResult | { error: string }>> {
    const results: Array<PreviewResult | { error: string }> = [];

    for (const item of templates) {
      try {
        const result = await this.previewTemplate(item.id, item.variables || {});
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '预览失败';
        results.push({ error: errorMessage });
      }
    }

    return results;
  }

  async createVersionRecord(
    templateId: string,
    version: number,
    content: string,
    variables: Variables | null,
    metadata: TemplateMetadata | null,
    changeLog: string,
    status: TemplateStatus,
    userId: string
  ): Promise<void> {
    await db('prompt_template_versions').insert({
      template_id: templateId,
      version,
      content,
      variables: variables ? JSON.stringify(variables) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      change_log: changeLog,
      status,
      created_by: userId
    });
  }

  extractVariables(content: string): string[] {
    const matches = content.match(this.VARIABLE_PATTERN);
    if (!matches) return [];
    return matches
      .map((m) => m.slice(2, -2))
      .filter((varName, index, self) => self.indexOf(varName) === index);
  }

  validateVariables(definedVariables: Variables | null, extractedVariables: string[]): Variables {
    if (!definedVariables) return {};
    const validated: Variables = { ...definedVariables };
    extractedVariables.forEach((varName) => {
      if (!Object.prototype.hasOwnProperty.call(validated, varName)) {
        validated[varName] = { type: 'string', description: `变量 ${varName}`, required: true };
      }
    });
    return validated;
  }

  replaceVariables(content: string, variables: Record<string, unknown>): string {
    return content.replace(this.VARIABLE_PATTERN, (match, varName: string) => {
      if (Object.prototype.hasOwnProperty.call(variables, varName)) {
        return String(variables[varName]);
      }
      return match;
    });
  }

  private parseTemplate(raw: Record<string, unknown>): PromptTemplate {
    return {
      ...raw,
      variables: raw.variables ? JSON.parse(raw.variables as string) : null,
      metadata: raw.metadata ? JSON.parse(raw.metadata as string) : null
    } as PromptTemplate;
  }
}

export default new PromptTemplateService();
