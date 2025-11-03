const pipelineExecutionService = require('../services/pipelineExecution.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Pipeline 执行控制器
 */
class PipelineExecutionController {
  /**
   * 创建执行任务
   */
  async createExecution(req, res, next) {
    try {
      const { schema_id, input_data, mode = 'mock' } = req.body;
      const userId = req.user.id;

      // 验证参数
      if (!schema_id) {
        throw new AppError('缺少流程模板ID', 400);
      }

      const execution = await pipelineExecutionService.createExecution(
        schema_id,
        input_data || {},
        mode,
        userId
      );

      res.status(201).json({
        success: true,
        data: execution,
        message: '执行任务创建成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Create execution failed:', error);
      next(error);
    }
  }

  /**
   * 启动执行
   */
  async startExecution(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 启动执行（异步）
      pipelineExecutionService.startExecution(id).catch(error => {
        logger.error('[PipelineExecutionController] Async start execution failed:', error);
      });

      res.json({
        success: true,
        message: '执行已启动',
        data: { execution_id: id },
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Start execution failed:', error);
      next(error);
    }
  }

  /**
   * 创建并立即启动执行
   */
  async createAndStartExecution(req, res, next) {
    try {
      const { schema_id, input_data, mode = 'mock' } = req.body;
      const userId = req.user.id;

      // 验证参数
      if (!schema_id) {
        throw new AppError('缺少流程模板ID', 400);
      }

      // 创建执行
      const execution = await pipelineExecutionService.createExecution(
        schema_id,
        input_data || {},
        mode,
        userId
      );

      // 启动执行（异步）
      pipelineExecutionService.startExecution(execution.id).catch(error => {
        logger.error('[PipelineExecutionController] Async start execution failed:', error);
      });

      res.status(201).json({
        success: true,
        data: execution,
        message: '执行任务创建并启动成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Create and start execution failed:', error);
      next(error);
    }
  }

  /**
   * 获取执行详情
   */
  async getExecution(req, res, next) {
    try {
      const { id } = req.params;

      const execution = pipelineExecutionService.getExecution(id);

      res.json({
        success: true,
        data: execution,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Get execution failed:', error);
      next(error);
    }
  }

  /**
   * 获取执行列表
   */
  async getExecutions(req, res, next) {
    try {
      const {
        schema_id,
        status,
        mode,
        page = 1,
        limit = 20,
        offset = 0
      } = req.query;

      const options = {
        schema_id,
        status,
        mode,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const result = pipelineExecutionService.getExecutions(options);

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Get executions failed:', error);
      next(error);
    }
  }

  /**
   * 取消执行
   */
  async cancelExecution(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await pipelineExecutionService.cancelExecution(id, reason || '用户取消');

      res.json({
        success: true,
        message: '执行已取消',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Cancel execution failed:', error);
      next(error);
    }
  }

  /**
   * SSE 实时执行状态
   */
  async getExecutionEvents(req, res, next) {
    try {
      const { id } = req.params;

      // 验证执行是否存在
      try {
        pipelineExecutionService.getExecution(id);
      } catch (error) {
        throw new AppError('执行任务不存在', 404);
      }

      // 设置SSE响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // 发送连接确认
      res.write(`event: connected\ndata: ${JSON.stringify({
        type: 'connected',
        execution_id: id,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // 监听执行事件
      const eventHandler = (event) => {
        if (event.execution_id === id) {
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
      };

      // 添加事件监听器
      pipelineExecutionService.on('execution:event', eventHandler);

      // 发送初始状态
      try {
        const execution = pipelineExecutionService.getExecution(id);
        res.write(`event: status\ndata: ${JSON.stringify({
          type: 'status',
          execution_id: id,
          current_status: execution.status,
          timestamp: new Date().toISOString()
        })}\n\n`);
      } catch (error) {
        // 忽略获取状态失败
      }

      // 处理客户端断开连接
      req.on('close', () => {
        pipelineExecutionService.removeListener('execution:event', eventHandler);
        logger.info(`[PipelineExecutionController] SSE client disconnected: ${id}`);
      });

      req.on('aborted', () => {
        pipelineExecutionService.removeListener('execution:event', eventHandler);
        logger.info(`[PipelineExecutionController] SSE connection aborted: ${id}`);
      });

      // 定期发送心跳
      const heartbeat = setInterval(() => {
        try {
          res.write(`event: heartbeat\ndata: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`);
        } catch (error) {
          clearInterval(heartbeat);
          pipelineExecutionService.removeListener('execution:event', eventHandler);
        }
      }, 30000); // 30秒心跳

      req.on('close', () => {
        clearInterval(heartbeat);
      });

      req.on('aborted', () => {
        clearInterval(heartbeat);
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Get execution events failed:', error);

      // 如果SSE连接失败，发送错误事件
      if (res.headersSent) {
        res.write(`event: error\ndata: ${JSON.stringify({
          type: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        })}\n\n`);
        res.end();
      } else {
        next(error);
      }
    }
  }

  /**
   * 批量操作执行
   */
  async batchOperateExecutions(req, res, next) {
    try {
      const { execution_ids, operation } = req.body;
      const userId = req.user.id;

      if (!execution_ids || !Array.isArray(execution_ids)) {
        throw new AppError('请提供执行ID列表', 400);
      }

      if (!operation) {
        throw new AppError('请指定操作类型', 400);
      }

      const results = [];
      let success_count = 0;
      let failed_count = 0;

      for (const executionId of execution_ids) {
        try {
          switch (operation) {
            case 'cancel':
              await pipelineExecutionService.cancelExecution(executionId);
              results.push({
                execution_id: executionId,
                success: true,
                operation: 'cancelled'
              });
              success_count++;
              break;
            case 'start':
              await pipelineExecutionService.startExecution(executionId);
              results.push({
                execution_id: executionId,
                success: true,
                operation: 'started'
              });
              success_count++;
              break;
            default:
              results.push({
                execution_id: executionId,
                success: false,
                error: `不支持的操作: ${operation}`
              });
              failed_count++;
          }
        } catch (error) {
          results.push({
            execution_id: executionId,
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
            total: execution_ids.length,
            success: success_count,
            failed: failed_count
          }
        },
        message: `批量操作完成: ${success_count} 成功, ${failed_count} 失败`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Batch operate executions failed:', error);
      next(error);
    }
  }

  /**
   * 获取执行统计
   */
  async getExecutionStats(req, res, next) {
    try {
      const { schema_id } = req.query;

      const options = { schema_id };
      const executions = pipelineExecutionService.getExecutions({ ...options, limit: 1000 });

      const stats = {
        total_executions: executions.executions.length,
        by_status: {},
        by_mode: {},
        average_duration: 0,
        success_rate: 0
      };

      let total_duration = 0;
      let completed_count = 0;

      for (const execution of executions.executions) {
        // 按状态统计
        stats.by_status[execution.status] = (stats.by_status[execution.status] || 0) + 1;

        // 按模式统计
        stats.by_mode[execution.execution_mode] = (stats.by_mode[execution.execution_mode] || 0) + 1;

        // 计算平均时长
        if (execution.duration_ms) {
          total_duration += execution.duration_ms;
          completed_count++;
        }
      }

      if (completed_count > 0) {
        stats.average_duration = Math.round(total_duration / completed_count);
      }

      // 计算成功率
      const completed = stats.by_status.completed || 0;
      const failed = stats.by_status.failed || 0;
      const total_completed = completed + failed;
      if (total_completed > 0) {
        stats.success_rate = Math.round((completed / total_completed) * 100);
      }

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Get execution stats failed:', error);
      next(error);
    }
  }

  /**
   * 清理过期执行
   */
  async cleanupExecutions(req, res, next) {
    try {
      const { max_age } = req.body;
      const maxAgeMs = max_age ? parseInt(max_age) * 1000 : 24 * 60 * 60 * 1000; // 默认24小时

      const cleanedCount = pipelineExecutionService.cleanupExpiredExecutions(maxAgeMs);

      res.json({
        success: true,
        data: { cleaned_count: cleanedCount },
        message: `已清理 ${cleanedCount} 个过期执行记录`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Cleanup executions failed:', error);
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
        service: 'pipeline-execution',
        active_executions: pipelineExecutionService.executions.size,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };

      res.json({
        success: true,
        data: health,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[PipelineExecutionController] Health check failed:', error);
      next(error);
    }
  }
}

module.exports = new PipelineExecutionController();