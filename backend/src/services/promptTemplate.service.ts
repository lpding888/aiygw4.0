import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import cmsCacheService from './cmsCache.service.js';

class PromptTemplateService {
  private readonly CACHE_SCOPE = 'prompt_templates';
  private readonly VARIABLE_PATTERN = /\{\{(\w+)\}\}/g; // {{variable}}
  private readonly VALID_CATEGORIES = ['system', 'user', 'assistant', 'function'];
  private readonly VALID_STATUSES = ['draft', 'published', 'archived'];

  async getTemplates(options: any = {}) {
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
      query = query.where(function (this: any) {
        this.where('prompt_templates.name', 'like', `%${search}%`)
          .orWhere('prompt_templates.description', 'like', `%${search}%`)
          .orWhere('prompt_templates.content', 'like', `%${search}%`);
      });
    }

    const validSortFields = ['name', 'category', 'status', 'version', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updated_at';
    const sortDirection = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(`prompt_templates.${sortField}`, sortDirection);

    const templates = await query.limit(parseInt(String(limit))).offset(offset);

    let countQuery = db('prompt_templates');
    if (category) countQuery = countQuery.where('category', category);
    if (status) {
      if (Array.isArray(status)) countQuery = countQuery.whereIn('status', status);
      else countQuery = countQuery.where('status', status);
    }
    if (created_by) countQuery = countQuery.where('created_by', created_by);
    if (search) {
      countQuery = countQuery.where(function (this: any) {
        this.where('name', 'like', `%${search}%`)
          .orWhere('description', 'like', `%${search}%`)
          .orWhere('content', 'like', `%${search}%`);
      });
    }

    const total: any = await countQuery.count('* as count').first();

    return {
      templates: (templates as any[]).map((t) => ({
        ...t,
        variables: (t as any).variables ? JSON.parse((t as any).variables) : null,
        metadata: (t as any).metadata ? JSON.parse((t as any).metadata) : null
      })),
      pagination: {
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        total: total.count,
        totalPages: Math.ceil(total.count / parseInt(String(limit)))
      }
    };
  }

  async getTemplateById(id: string) {
    const template: any = await db('prompt_templates')
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
    return {
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : null,
      metadata: template.metadata ? JSON.parse(template.metadata) : null
    };
  }

  async getTemplateByKey(key: string, version: number | null = null) {
    let query: any = db('prompt_templates').where('key', key);
    if (version !== null && version !== undefined) query = query.where('version', version);
    else query = query.where('status', 'published').orderBy('version', 'desc').first();
    const template = await query.first();
    if (!template) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '模板不存在');
    return {
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : null,
      metadata: template.metadata ? JSON.parse(template.metadata) : null
    };
  }

  async createTemplate(templateData: any, userId: string) {
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
    if (!this.VALID_STATUSES.includes(status)) {
      throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS, '无效的模板状态');
    }
    const version = await (cmsCacheService as any).generateVersion(this.CACHE_SCOPE, key);
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
    await (cmsCacheService as any).createSnapshot(
      this.CACHE_SCOPE,
      key,
      template,
      'create',
      '创建模板',
      userId
    );
    await (cmsCacheService as any).invalidate(this.CACHE_SCOPE, key);
    logger.info('[PromptTemplateService] Template created', { key, userId });
    return {
      ...template,
      variables: variables || null,
      metadata: metadata || null
    };
  }

  async updateTemplate(id: string, updateData: any, userId: string) {
    const existing: any = await db('prompt_templates').where('id', id).first();
    if (!existing) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '模板不存在');
    const payload: any = { ...updateData, updated_by: userId, updated_at: new Date() };
    if (updateData.variables !== undefined)
      payload.variables = JSON.stringify(updateData.variables);
    if (updateData.metadata !== undefined) payload.metadata = JSON.stringify(updateData.metadata);
    const [updated] = await db('prompt_templates').where('id', id).update(payload).returning('*');
    await (cmsCacheService as any).createSnapshot(
      this.CACHE_SCOPE,
      existing.key,
      updated,
      'update',
      '更新模板',
      userId
    );
    await (cmsCacheService as any).invalidate(this.CACHE_SCOPE, existing.key);
    return {
      ...updated,
      variables: updated.variables ? JSON.parse(updated.variables) : null,
      metadata: updated.metadata ? JSON.parse(updated.metadata) : null
    };
  }

  async deleteTemplate(id: string, userId: string) {
    const template = await this.getTemplateById(id);
    await db('prompt_templates').where('id', id).del();
    await (cmsCacheService as any).createSnapshot(
      this.CACHE_SCOPE,
      (template as any).key,
      template,
      'delete',
      '删除模板',
      userId
    );
    await (cmsCacheService as any).invalidate(this.CACHE_SCOPE, (template as any).key);
  }

  async publishTemplate(id: string, userId: string) {
    const template = await this.getTemplateById(id);
    if ((template as any).status === 'published') {
      throw AppError.custom(ERROR_CODES.INVALID_REQUEST, '模板已发布');
    }
    const [published] = await db('prompt_templates')
      .where('id', id)
      .update({ status: 'published', updated_by: userId, updated_at: new Date() })
      .returning('*');
    await (cmsCacheService as any).createSnapshot(
      this.CACHE_SCOPE,
      (template as any).key,
      published,
      'publish',
      '发布模板',
      userId
    );
    await (cmsCacheService as any).invalidate(this.CACHE_SCOPE, (template as any).key);
    return published;
  }

  async archiveTemplate(id: string, userId: string) {
    const template = await this.getTemplateById(id);
    const [archived] = await db('prompt_templates')
      .where('id', id)
      .update({ status: 'archived', updated_by: userId, updated_at: new Date() })
      .returning('*');
    await (cmsCacheService as any).createSnapshot(
      this.CACHE_SCOPE,
      (template as any).key,
      archived,
      'archive',
      '归档模板',
      userId
    );
    await (cmsCacheService as any).invalidate(this.CACHE_SCOPE, (template as any).key);
    return archived;
  }

  async getTemplateVersions(templateId: string, options: any = {}) {
    const { page = 1, limit = 20 } = options;
    const template: any = await this.getTemplateById(templateId);
    const offset = (page - 1) * limit;
    const total: any = await db('prompt_template_versions')
      .where({ template_id: templateId })
      .count('* as count')
      .first();
    const versions = await db('prompt_template_versions')
      .where({ template_id: templateId })
      .select(['version', 'status', 'change_log', 'created_by', 'created_at'])
      .orderBy('version', 'desc')
      .limit(limit)
      .offset(offset);
    return {
      template: { id: templateId, key: (template as any).key, name: (template as any).name },
      versions,
      pagination: {
        current: page,
        pageSize: limit,
        total: parseInt(String(total.count)),
        totalPages: Math.ceil(parseInt(String(total.count)) / limit)
      }
    };
  }

  async rollbackToVersion(templateId: string, version: number, userId: string) {
    const template: any = await this.getTemplateById(templateId);
    const latest = await db('prompt_templates').where('id', templateId).first();
    const versionRecord: any = await db('prompt_template_versions')
      .where({ template_id: templateId, version })
      .orderBy('created_at', 'desc')
      .first();
    if (!versionRecord) {
      throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '目标版本不存在');
    }
    const newVersion = ((latest as any).version || 0) + 1;
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
      fromVersion: (template as any).version,
      toVersion: version,
      newVersion
    });
    return {
      ...rolledBackTemplate,
      variables: rolledBackTemplate.variables ? JSON.parse(rolledBackTemplate.variables) : null,
      metadata: rolledBackTemplate.metadata ? JSON.parse(rolledBackTemplate.metadata) : null
    };
  }

  async previewTemplate(templateId: string, variables: Record<string, any> = {}) {
    const template: any = await this.getTemplateById(templateId);
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
      templateId,
      templateKey: template.key,
      templateName: template.name,
      variables: { provided: variables, required: requiredVariables, missing: missingVariables },
      content: previewContent
    };
  }

  validateTemplate(templateId: string) {
    return new Promise(async (resolve, reject) => {
      try {
        const template: any = await this.getTemplateById(templateId);
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
        Object.entries(definedVariables).forEach(([varName, varDef]: any) => {
          if (!varDef.type) warnings.push(`变量 ${varName} 缺少类型定义`);
          if (varDef.required && !varDef.default && !extractedVariables.includes(varName)) {
            warnings.push(`必需变量 ${varName} 有默认值但未在模板中使用`);
          }
        });
        resolve({
          valid: issues.length === 0,
          issues,
          warnings,
          variables: {
            extracted: extractedVariables,
            defined: definedVariables,
            count: extractedVariables.length
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async getTemplateStats() {
    const stats = await db('prompt_templates')
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
      .first();
    return stats;
  }

  async createVersionRecord(
    templateId: string,
    version: number,
    content: string,
    variables: any,
    metadata: any,
    changeLog: string,
    status: string,
    userId: string
  ) {
    return await db('prompt_template_versions').insert({
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

  extractVariables(content: string) {
    const matches = content.match(this.VARIABLE_PATTERN);
    if (!matches) return [];
    return matches
      .map((m) => m.slice(2, -2))
      .filter((varName, index, self) => self.indexOf(varName) === index);
  }

  validateVariables(definedVariables: any, extractedVariables: string[]) {
    if (!definedVariables) return null;
    const validated: any = { ...definedVariables };
    extractedVariables.forEach((varName) => {
      if (!Object.prototype.hasOwnProperty.call(validated, varName)) {
        validated[varName] = { type: 'string', description: `变量 ${varName}`, required: true };
      }
    });
    return validated;
  }

  replaceVariables(content: string, variables: Record<string, any>) {
    return content.replace(this.VARIABLE_PATTERN as any, (match, varName) => {
      if (Object.prototype.hasOwnProperty.call(variables, varName)) {
        return variables[varName];
      }
      return match;
    });
  }
}

export default new PromptTemplateService();
