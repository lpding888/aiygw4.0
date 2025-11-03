const promptTemplateService = require('../services/promptTemplate.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Prompt模板控制器
 */
class PromptTemplateController {
  /**
   * 获取模板列表
   */
  async getTemplates(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        status,
        search,
        sortBy = 'updated_at',
        sortOrder = 'desc',
        created_by
      } = req.query;

      const result = await promptTemplateService.getTemplates({
        page: parseInt(page),
        limit: parseInt(limit),
        category,
        status: status ? (Array.isArray(status) ? status : status.split(',')) : undefined,
        search,
        sortBy,
        sortOrder,
        created_by
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Get templates failed:', error);
      next(error);
    }
  }

  /**
   * 获取模板详情
   */
  async getTemplateById(req, res, next) {
    try {
      const { id } = req.params;
      const template = await promptTemplateService.getTemplateById(id);

      res.json({
        success: true,
        data: template,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Get template by ID failed:', error);
      next(error);
    }
  }

  /**
   * 根据key获取模板
   */
  async getTemplateByKey(req, res, next) {
    try {
      const { key } = req.params;
      const { version } = req.query;

      const template = await promptTemplateService.getTemplateByKey(key, version ? parseInt(version) : null);

      res.json({
        success: true,
        data: template,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Get template by key failed:', error);
      next(error);
    }
  }

  /**
   * 创建模板
   */
  async createTemplate(req, res, next) {
    try {
      const userId = req.user.id;
      const templateData = {
        ...req.body,
        created_by: userId
      };

      const template = await promptTemplateService.createTemplate(templateData, userId);

      res.status(201).json({
        success: true,
        data: template,
        message: '提示词模板创建成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Create template failed:', error);
      next(error);
    }
  }

  /**
   * 更新模板
   */
  async updateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = {
        ...req.body,
        updated_by: userId
      };

      const template = await promptTemplateService.updateTemplate(id, updateData, userId);

      res.json({
        success: true,
        data: template,
        message: '提示词模板更新成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Update template failed:', error);
      next(error);
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await promptTemplateService.deleteTemplate(id, userId);

      res.json({
        success: true,
        data: result,
        message: '提示词模板删除成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Delete template failed:', error);
      next(error);
    }
  }

  /**
   * 发布模板
   */
  async publishTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const template = await promptTemplateService.publishTemplate(id, userId);

      res.json({
        success: true,
        data: template,
        message: '提示词模板发布成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Publish template failed:', error);
      next(error);
    }
  }

  /**
   * 归档模板
   */
  async archiveTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const template = await promptTemplateService.archiveTemplate(id, userId);

      res.json({
        success: true,
        data: template,
        message: '提示词模板归档成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Archive template failed:', error);
      next(error);
    }
  }

  /**
   * 获取模板版本历史
   */
  async getTemplateVersions(req, res, next) {
    try {
      const { id } = req.params;

      const versions = await promptTemplateService.getTemplateVersions(id);

      res.json({
        success: true,
        data: versions,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Get template versions failed:', error);
      next(error);
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(req, res, next) {
    try {
      const { id } = req.params;
      const { version } = req.body;
      const userId = req.user.id;

      if (!version) {
        throw new AppError('版本号不能为空', 400);
      }

      const template = await promptTemplateService.rollbackToVersion(id, parseInt(version), userId);

      res.json({
        success: true,
        data: template,
        message: `已回滚到版本 ${version}`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Rollback template failed:', error);
      next(error);
    }
  }

  /**
   * 预览模板
   */
  async previewTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const { variables } = req.body;

      const preview = await promptTemplateService.previewTemplate(id, variables || {});

      res.json({
        success: true,
        data: preview,
        message: '模板预览生成成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Preview template failed:', error);
      next(error);
    }
  }

  /**
   * 验证模板
   */
  async validateTemplate(req, res, next) {
    try {
      const { id } = req.params;

      const validation = await promptTemplateService.validateTemplate(id);

      res.json({
        success: true,
        data: validation,
        message: validation.valid ? '模板验证通过' : '模板验证发现问题',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Validate template failed:', error);
      next(error);
    }
  }

  /**
   * 批量预览模板
   */
  async batchPreviewTemplates(req, res, next) {
    try {
      const { templates } = req.body;

      if (!templates || !Array.isArray(templates)) {
        throw new AppError('请提供模板列表', 400);
      }

      const results = [];
      let success_count = 0;
      let failed_count = 0;

      for (const templateRequest of templates) {
        try {
          const { id, variables } = templateRequest;
          if (!id) {
            throw new AppError('模板ID不能为空');
          }

          const preview = await promptTemplateService.previewTemplate(id, variables || {});
          results.push({
            template_id: id,
            success: true,
            preview: preview
          });
          success_count++;
        } catch (error) {
          results.push({
            template_id: templateRequest.id,
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
            total: templates.length,
            success: success_count,
            failed: failed_count
          }
        },
        message: `批量预览完成: ${success_count} 成功, ${failed_count} 失败`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Batch preview templates failed:', error);
      next(error);
    }
  }

  /**
   * 获取模板统计
   */
  async getTemplateStats(req, res, next) {
    try {
      const stats = await promptTemplateService.getTemplateStats();

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Get template stats failed:', error);
      next(error);
    }
  }

  /**
   * 获取模板类别列表
   */
  async getTemplateCategories(req, res, next) {
    try {
      const categories = [
        { value: 'system', label: '系统提示词', description: '系统级别的提示词，用于定义AI行为和规则' },
        { value: 'user', label: '用户提示词', description: '用户输入的提示词，用于指导AI生成内容' },
        { value: 'assistant', label: '助手回复', description: 'AI助手的示例回复，用于few-shot学习' },
        { value: 'function', label: '功能提示词', description: '特定功能任务的提示词，如代码生成、文本分析等' }
      ];

      res.json({
        success: true,
        data: categories,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Get template categories failed:', error);
      next(error);
    }
  }

  /**
   * 获取模板示例
   */
  async getTemplateExamples(req, res, next) {
    try {
      const examples = [
        {
          key: 'code_review',
          name: '代码审查助手',
          description: '用于代码审查和优化的提示词模板',
          category: 'function',
          content: `请审查以下代码，重点关注：
1. 代码质量和可读性
2. 性能优化建议
3. 安全漏洞检查
4. 最佳实践遵循

代码：
\`\`\`{{language}}
{{code}}
\`\`\`

请提供具体的改进建议。`,
          variables: {
            language: {
              type: 'string',
              description: '编程语言',
              required: true,
              default: 'javascript'
            },
            code: {
              type: 'string',
              description: '需要审查的代码',
              required: true
            }
          }
        },
        {
          key: 'document_summary',
          name: '文档总结',
          description: '用于总结长篇文档的提示词模板',
          category: 'function',
          content: `请总结以下文档的主要内容：

文档标题：{{title}}
文档内容：
{{content}}

请提供：
1. 核心观点总结（3-5个要点）
2. 关键信息提取
3. 适合的读者群体
4. 相关建议

总结长度：{{length || '200-300字'}}`,
          variables: {
            title: {
              type: 'string',
              description: '文档标题',
              required: true
            },
            content: {
              type: 'string',
              description: '文档内容',
              required: true
            },
            length: {
              type: 'string',
              description: '总结长度要求',
              required: false,
              default: '200-300字'
            }
          }
        },
        {
          key: 'creative_writing',
          name: '创意写作助手',
          description: '用于创意写作的提示词模板',
          category: 'function',
          content: `请根据以下要求进行创意写作：

写作类型：{{writing_type}}
主题：{{theme}}
风格：{{style}}
目标读者：{{audience}}
字数要求：{{word_count}}

额外要求：
{{additional_requirements}}

请创作一篇{{writing_type}}，确保内容原创且富有创意。`,
          variables: {
            writing_type: {
              type: 'string',
              description: '写作类型（小说、诗歌、散文等）',
              required: true
            },
            theme: {
              type: 'string',
              description: '写作主题',
              required: true
            },
            style: {
              type: 'string',
              description: '写作风格',
              required: true
            },
            audience: {
              type: 'string',
              description: '目标读者',
              required: true
            },
            word_count: {
              type: 'string',
              description: '字数要求',
              required: true
            },
            additional_requirements: {
              type: 'string',
              description: '额外要求',
              required: false
            }
          }
        }
      ];

      res.json({
        success: true,
        data: examples,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Get template examples failed:', error);
      next(error);
    }
  }

  /**
   * 复制模板
   */
  async duplicateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const { new_key, new_name } = req.body;
      const userId = req.user.id;

      if (!new_key || !new_name) {
        throw new AppError('新模板key和名称不能为空', 400);
      }

      const originalTemplate = await promptTemplateService.getTemplateById(id);

      const duplicateData = {
        key: new_key,
        name: new_name,
        description: `${originalTemplate.description || ''} (复制)`,
        content: originalTemplate.content,
        category: originalTemplate.category,
        variables: originalTemplate.variables,
        metadata: originalTemplate.metadata,
        status: 'draft'
      };

      const duplicatedTemplate = await promptTemplateService.createTemplate(duplicateData, userId);

      res.status(201).json({
        success: true,
        data: duplicatedTemplate,
        message: '模板复制成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Duplicate template failed:', error);
      next(error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(req, res, next) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'prompt-template',
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };

      res.json({
        success: true,
        data: health,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PromptTemplateController] Health check failed:', error);
      next(error);
    }
  }
}

module.exports = new PromptTemplateController();