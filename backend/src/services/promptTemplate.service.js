const db = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const cmsCacheService = require('./cmsCache.service');

/**
 * Prompt模板中心服务
 */
class PromptTemplateService {
  constructor() {
    this.CACHE_SCOPE = 'prompt_templates';
    this.VARIABLE_PATTERN = /\{\{(\w+)\}\}/g; // 变量匹配模式 {{variable}}
    this.VALID_CATEGORIES = ['system', 'user', 'assistant', 'function'];
    this.VALID_STATUSES = ['draft', 'published', 'archived'];
  }

  /**
   * 获取模板列表
   */
  async getTemplates(options = {}) {
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

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('prompt_templates')
      .select([
        'prompt_templates.*',
        'creator.username as created_by_username',
        'updater.username as updated_by_username'
      ])
      .leftJoin('users as creator', 'prompt_templates.created_by', 'creator.id')
      .leftJoin('users as updater', 'prompt_templates.updated_by', 'updater.id');

    // 筛选条件
    if (category) {
      query = query.where('prompt_templates.category', category);
    }

    if (status) {
      if (Array.isArray(status)) {
        query = query.whereIn('prompt_templates.status', status);
      } else {
        query = query.where('prompt_templates.status', status);
      }
    }

    if (created_by) {
      query = query.where('prompt_templates.created_by', created_by);
    }

    if (search) {
      query = query.where(function() {
        this.where('prompt_templates.name', 'like', `%${search}%`)
            .orWhere('prompt_templates.description', 'like', `%${search}%`)
            .orWhere('prompt_templates.content', 'like', `%${search}%`);
      });
    }

    // 排序
    const validSortFields = ['name', 'category', 'status', 'version', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updated_at';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    query = query.orderBy(`prompt_templates.${sortField}`, sortDirection);

    // 分页
    const templates = await query.limit(parseInt(limit)).offset(offset);

    // 获取总数
    let countQuery = db('prompt_templates');

    if (category) countQuery = countQuery.where('category', category);
    if (status) {
      if (Array.isArray(status)) {
        countQuery = countQuery.whereIn('status', status);
      } else {
        countQuery = countQuery.where('status', status);
      }
    }
    if (created_by) countQuery = countQuery.where('created_by', created_by);
    if (search) {
      countQuery = countQuery.where(function() {
        this.where('name', 'like', `%${search}%`)
            .orWhere('description', 'like', `%${search}%`)
            .orWhere('content', 'like', `%${search}%`);
      });
    }

    const total = await countQuery.count('* as count').first();

    return {
      templates: templates.map(template => ({
        ...template,
        variables: template.variables ? JSON.parse(template.variables) : null,
        metadata: template.metadata ? JSON.parse(template.metadata) : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        totalPages: Math.ceil(total.count / parseInt(limit))
      }
    };
  }

  /**
   * 根据ID获取模板
   */
  async getTemplateById(id) {
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

    if (!template) {
      throw new AppError('模板不存在', 404);
    }

    return {
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : null,
      metadata: template.metadata ? JSON.parse(template.metadata) : null
    };
  }

  /**
   * 根据key获取模板
   */
  async getTemplateByKey(key, version = null) {
    let query = db('prompt_templates').where('key', key);

    if (version) {
      query = query.where('version', version);
    } else {
      query = query.where('status', 'published').orderBy('version', 'desc').first();
    }

    const template = await query.first();

    if (!template) {
      throw new AppError('模板不存在', 404);
    }

    return {
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : null,
      metadata: template.metadata ? JSON.parse(template.metadata) : null
    };
  }

  /**
   * 创建模板
   */
  async createTemplate(templateData, userId) {
    const {
      key,
      name,
      description,
      content,
      category = 'user',
      variables = null,
      metadata = null,
      status = 'draft'
    } = templateData;

    // 验证必填字段
    if (!key || !name || !content) {
      throw new AppError('模板key、名称和内容不能为空', 400);
    }

    // 验证类别
    if (!this.VALID_CATEGORIES.includes(category)) {
      throw new AppError(`无效的模板类别: ${category}`, 400);
    }

    // 验证状态
    if (!this.VALID_STATUSES.includes(status)) {
      throw new AppError(`无效的模板状态: ${status}`, 400);
    }

    // 检查key是否已存在
    const existingTemplate = await db('prompt_templates').where('key', key).first();
    if (existingTemplate) {
      throw new AppError('模板key已存在', 409);
    }

    // 解析变量
    const extractedVariables = this.extractVariables(content);
    const validatedVariables = this.validateVariables(variables, extractedVariables);

    const [template] = await db('prompt_templates').insert({
      key,
      name,
      description,
      content,
      category,
      variables: validatedVariables ? JSON.stringify(validatedVariables) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      version: 1,
      status,
      created_by: userId,
      updated_by: userId
    }).returning('*');

    // 创建版本记录
    await this.createVersionRecord(template.id, 1, content, validatedVariables, metadata, null, status, userId);

    logger.info('[PromptTemplateService] Template created:', { id: template.id, key, name });

    return {
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : null,
      metadata: template.metadata ? JSON.parse(template.metadata) : null
    };
  }

  /**
   * 更新模板
   */
  async updateTemplate(id, updateData, userId) {
    const template = await this.getTemplateById(id);

    const {
      name,
      description,
      content,
      category,
      variables,
      metadata,
      status
    } = updateData;

    // 验证类别
    if (category && !this.VALID_CATEGORIES.includes(category)) {
      throw new AppError(`无效的模板类别: ${category}`, 400);
    }

    // 验证状态
    if (status && !this.VALID_STATUSES.includes(status)) {
      throw new AppError(`无效的模板状态: ${status}`, 400);
    }

    // 如果内容发生变化，创建新版本
    let newVersion = template.version;
    let changeLog = null;

    if (content && content !== template.content) {
      newVersion = template.version + 1;
      changeLog = `版本 ${newVersion}: 内容更新`;

      // 解析变量
      const extractedVariables = this.extractVariables(content);
      const validatedVariables = this.validateVariables(variables, extractedVariables);

      // 创建新版本记录
      await this.createVersionRecord(
        template.id,
        newVersion,
        content,
        validatedVariables,
        metadata,
        changeLog,
        status || template.status,
        userId
      );

      // 更新variables为最新版本的变量
      updateData.variables = validatedVariables ? JSON.stringify(validatedVariables) : null;
    } else if (variables) {
      // 验证变量
      const extractedVariables = this.extractVariables(template.content);
      const validatedVariables = this.validateVariables(variables, extractedVariables);
      updateData.variables = validatedVariables ? JSON.stringify(validatedVariables) : null;
    }

    const updateFields = {
      ...updateData,
      version: newVersion,
      updated_by: userId,
      updated_at: new Date()
    };

    if (metadata) {
      updateFields.metadata = JSON.stringify(metadata);
    }

    const [updatedTemplate] = await db('prompt_templates')
      .where('id', id)
      .update(updateFields)
      .returning('*');

    logger.info('[PromptTemplateService] Template updated:', {
      id,
      version: newVersion,
      changeLog
    });

    return {
      ...updatedTemplate,
      variables: updatedTemplate.variables ? JSON.parse(updatedTemplate.variables) : null,
      metadata: updatedTemplate.metadata ? JSON.parse(updatedTemplate.metadata) : null
    };
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id, userId) {
    const template = await this.getTemplateById(id);

    await db('prompt_templates').where('id', id).del();
    await db('prompt_template_versions').where('template_id', id).del();

    logger.info('[PromptTemplateService] Template deleted:', { id, key: template.key });

    return { deleted: true, template };
  }

  /**
   * 发布模板
   */
  async publishTemplate(id, userId) {
    const template = await this.getTemplateById(id);

    if (template.status === 'published') {
      throw new AppError('模板已经是发布状态', 400);
    }

    const [publishedTemplate] = await db('prompt_templates')
      .where('id', id)
      .update({
        status: 'published',
        updated_by: userId,
        updated_at: new Date()
      })
      .returning('*');

    // 更新版本记录状态
    await db('prompt_template_versions')
      .where('template_id', id)
      .where('version', template.version)
      .update({
        status: 'published'
      });

    logger.info('[PromptTemplateService] Template published:', { id, key: template.key });

    return {
      ...publishedTemplate,
      variables: publishedTemplate.variables ? JSON.parse(publishedTemplate.variables) : null,
      metadata: publishedTemplate.metadata ? JSON.parse(publishedTemplate.metadata) : null
    };
  }

  /**
   * 归档模板
   */
  async archiveTemplate(id, userId) {
    const template = await this.getTemplateById(id);

    if (template.status === 'archived') {
      throw new AppError('模板已经是归档状态', 400);
    }

    const [archivedTemplate] = await db('prompt_templates')
      .where('id', id)
      .update({
        status: 'archived',
        updated_by: userId,
        updated_at: new Date()
      })
      .returning('*');

    logger.info('[PromptTemplateService] Template archived:', { id, key: template.key });

    return {
      ...archivedTemplate,
      variables: archivedTemplate.variables ? JSON.parse(archivedTemplate.variables) : null,
      metadata: archivedTemplate.metadata ? JSON.parse(archivedTemplate.metadata) : null
    };
  }

  /**
   * 获取模板版本历史
   */
  async getTemplateVersions(templateId) {
    const versions = await db('prompt_template_versions')
      .select([
        'prompt_template_versions.*',
        'creator.username as created_by_username'
      ])
      .leftJoin('users as creator', 'prompt_template_versions.created_by', 'creator.id')
      .where('template_id', templateId)
      .orderBy('version', 'desc');

    return versions.map(version => ({
      ...version,
      variables: version.variables ? JSON.parse(version.variables) : null,
      metadata: version.metadata ? JSON.parse(version.metadata) : null
    }));
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(templateId, version, userId) {
    const template = await this.getTemplateById(templateId);
    const versionRecord = await db('prompt_template_versions')
      .where('template_id', templateId)
      .where('version', version)
      .first();

    if (!versionRecord) {
      throw new AppError('版本不存在', 404);
    }

    // 创建新版本（回滚版本）
    const newVersion = template.version + 1;
    const changeLog = `回滚到版本 ${version}`;

    await this.createVersionRecord(
      templateId,
      newVersion,
      versionRecord.content,
      versionRecord.variables ? JSON.parse(versionRecord.variables) : null,
      versionRecord.metadata ? JSON.parse(versionRecord.metadata) : null,
      changeLog,
      template.status,
      userId
    );

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

    return {
      ...rolledBackTemplate,
      variables: rolledBackTemplate.variables ? JSON.parse(rolledBackTemplate.variables) : null,
      metadata: rolledBackTemplate.metadata ? JSON.parse(rolledBackTemplate.metadata) : null
    };
  }

  /**
   * 预览模板（替换变量）
   */
  async previewTemplate(templateId, variables = {}) {
    const template = await this.getTemplateById(templateId);

    // 验证必需的变量
    const requiredVariables = this.extractVariables(template.content);
    const missingVariables = requiredVariables.filter(varName =>
      !variables.hasOwnProperty(varName) || variables[varName] === ''
    );

    if (missingVariables.length > 0) {
      throw new AppError(`缺少必需的变量: ${missingVariables.join(', ')}`, 400);
    }

    // 替换变量
    const previewContent = this.replaceVariables(template.content, variables);

    return {
      templateId,
      templateKey: template.key,
      templateName: template.name,
      variables: {
        provided: variables,
        required: requiredVariables,
        missing: missingVariables
      },
      content: previewContent
    };
  }

  /**
   * 验证模板变量
   */
  validateTemplate(templateId) {
    return new Promise(async (resolve, reject) => {
      try {
        const template = await this.getTemplateById(templateId);

        const extractedVariables = this.extractVariables(template.content);
        const definedVariables = template.variables || {};

        const issues = [];
        const warnings = [];

        // 检查未定义的变量
        extractedVariables.forEach(varName => {
          if (!definedVariables.hasOwnProperty(varName)) {
            warnings.push(`变量 {{${varName}}} 未在模板定义中声明`);
          }
        });

        // 检查已定义但未使用的变量
        Object.keys(definedVariables).forEach(varName => {
          if (!extractedVariables.includes(varName)) {
            warnings.push(`定义的变量 ${varName} 在模板中未使用`);
          }
        });

        // 验证变量定义
        Object.entries(definedVariables).forEach(([varName, varDef]) => {
          if (!varDef.type) {
            warnings.push(`变量 ${varName} 缺少类型定义`);
          }

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

  /**
   * 获取模板统计
   */
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

  /**
   * 创建版本记录
   */
  async createVersionRecord(templateId, version, content, variables, metadata, changeLog, status, userId) {
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

  /**
   * 提取模板中的变量
   */
  extractVariables(content) {
    const matches = content.match(this.VARIABLE_PATTERN);
    if (!matches) return [];

    return matches.map(match => {
      // 去掉 {{ 和 }}
      return match.slice(2, -2);
    }).filter((varName, index, self) => self.indexOf(varName) === index); // 去重
  }

  /**
   * 验证变量定义
   */
  validateVariables(definedVariables, extractedVariables) {
    if (!definedVariables) return null;

    const validatedVariables = { ...definedVariables };

    extractedVariables.forEach(varName => {
      if (!validatedVariables.hasOwnProperty(varName)) {
        validatedVariables[varName] = {
          type: 'string',
          description: `变量 ${varName}`,
          required: true
        };
      }
    });

    return validatedVariables;
  }

  /**
   * 替换模板变量
   */
  replaceVariables(content, variables) {
    return content.replace(this.VARIABLE_PATTERN, (match, varName) => {
      if (variables.hasOwnProperty(varName)) {
        return variables[varName];
      }
      return match; // 保持原样如果没有提供值
    });
  }
}

module.exports = new PromptTemplateService();