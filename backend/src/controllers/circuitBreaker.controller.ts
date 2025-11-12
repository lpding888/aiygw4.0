import type { Request, Response } from 'express';
import logger from '../utils/logger.js';
import circuitBreakerService from '../services/circuit-breaker.service.js';
import providerWrapperService from '../services/provider-wrapper.service.js';
import providerRegistryService from '../services/provider-registry.service.js';

class CircuitBreakerController {
  async getAllCircuitBreakers(_req: Request, res: Response): Promise<void> {
    try {
      const states = circuitBreakerService.getAllCircuitBreakerStates();
      res.json({ success: true, data: states, timestamp: new Date().toISOString() });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 获取熔断器状态失败:', error);
      res.status(500).json({ success: false, error: '获取熔断器状态失败', message: err.message });
    }
  }

  async getCircuitBreaker(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params as { name: string };
      const state = circuitBreakerService.getCircuitBreakerState(name);
      if (!state) {
        res.status(404).json({ success: false, error: '熔断器不存在', name });
        return;
      }
      res.json({ success: true, data: state, timestamp: new Date().toISOString() });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 获取熔断器状态失败:', error);
      res.status(500).json({ success: false, error: '获取熔断器状态失败', message: err.message });
    }
  }

  async openCircuitBreaker(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params as { name: string };
      const { reason } = (req.body ?? {}) as { reason?: string };
      const success = circuitBreakerService.openCircuitBreaker(name, reason);
      if (!success) {
        res.status(404).json({ success: false, error: '熔断器不存在', name });
        return;
      }
      res.json({
        success: true,
        message: `熔断器 ${name} 已手动打开`,
        reason: reason || 'manual',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 打开熔断器失败:', error);
      res.status(500).json({ success: false, error: '打开熔断器失败', message: err.message });
    }
  }

  async closeCircuitBreaker(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params as { name: string };
      const success = circuitBreakerService.closeCircuitBreaker(name);
      if (!success) {
        res.status(404).json({ success: false, error: '熔断器不存在', name });
        return;
      }
      res.json({
        success: true,
        message: `熔断器 ${name} 已手动关闭`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 关闭熔断器失败:', error);
      res.status(500).json({ success: false, error: '关闭熔断器失败', message: err.message });
    }
  }

  async resetCircuitBreaker(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params as { name: string };
      const success = circuitBreakerService.resetCircuitBreaker(name);
      if (!success) {
        res.status(404).json({ success: false, error: '熔断器不存在', name });
        return;
      }
      res.json({
        success: true,
        message: `熔断器 ${name} 已重置`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 重置熔断器失败:', error);
      res.status(500).json({ success: false, error: '重置熔断器失败', message: err.message });
    }
  }

  async getProviderStates(_req: Request, res: Response): Promise<void> {
    try {
      const states = providerWrapperService.getAllProviderStates();
      res.json({ success: true, data: states, timestamp: new Date().toISOString() });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 获取Provider状态失败:', error);
      res.status(500).json({ success: false, error: '获取Provider状态失败', message: err.message });
    }
  }

  async getRegisteredProviders(_req: Request, res: Response): Promise<void> {
    try {
      const providers = providerRegistryService.getRegisteredProviders();
      const states = providerRegistryService.getAllProviderStates();
      res.json({ success: true, data: { providers, states }, timestamp: new Date().toISOString() });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 获取已注册Provider失败:', error);
      res
        .status(500)
        .json({ success: false, error: '获取已注册Provider失败', message: err.message });
    }
  }

  async getProviderState(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params as { name: string };
      const state = providerWrapperService.getProviderStats(name);
      res.json({ success: true, data: state, timestamp: new Date().toISOString() });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 获取Provider状态失败:', error);
      res.status(500).json({ success: false, error: '获取Provider状态失败', message: err.message });
    }
  }

  async resetProviderStats(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params as { name: string };
      const success = providerWrapperService.resetProviderStats(name);
      res.json({ success, message: success ? '重置成功' : '重置失败' });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 重置Provider统计失败:', error);
      res.status(500).json({ success: false, error: '重置Provider统计失败', message: err.message });
    }
  }

  async executeProviderMethod(req: Request, res: Response): Promise<void> {
    try {
      const { providerName, methodName } = req.params as {
        providerName: string;
        methodName: string;
      };
      const { args = [], options = {} } = (req.body ?? {}) as {
        args?: unknown[];
        options?: Record<string, unknown>;
      };
      if (!providerRegistryService.isProviderRegistered(providerName)) {
        res.status(404).json({ success: false, error: 'Provider未注册', providerName });
        return;
      }
      const result = await providerRegistryService.execute(providerName, methodName, args, options);
      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 执行Provider方法失败:', error);
      res.status(500).json({ success: false, error: '执行Provider方法失败', message: err.message });
    }
  }

  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const [circuitBreakerHealth, providerHealth, registryHealth] = await Promise.all([
        circuitBreakerService.healthCheck(),
        providerWrapperService.healthCheck(),
        providerRegistryService.healthCheck()
      ]);

      const overallStatus = [circuitBreakerHealth, providerHealth, registryHealth]
        .map((h) => h?.status)
        .some((s) => s === 'unhealthy' || s === 'degraded')
        ? 'degraded'
        : 'healthy';

      res.json({
        success: true,
        data: {
          status: overallStatus,
          services: {
            circuitBreaker: circuitBreakerHealth,
            providerWrapper: providerHealth,
            providerRegistry: registryHealth
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 健康检查失败:', error);
      res.status(500).json({
        success: false,
        error: '健康检查失败',
        message: err.message,
        status: 'unhealthy'
      });
    }
  }

  async getCircuitBreakerStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = circuitBreakerService.getStats();
      res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 获取熔断器统计失败:', error);
      res.status(500).json({ success: false, error: '获取熔断器统计失败', message: err.message });
    }
  }

  async cleanupInactiveCircuitBreakers(req: Request, res: Response): Promise<void> {
    try {
      const { inactiveThresholdMs = '3600000' } = req.query as Record<string, unknown>;
      const cleanedCount = circuitBreakerService.cleanupInactiveCircuitBreakers(
        Number(inactiveThresholdMs)
      );
      res.json({
        success: true,
        message: `清理完成，删除了 ${cleanedCount} 个不活跃的熔断器`,
        cleanedCount,
        thresholdMs: Number(inactiveThresholdMs),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 清理熔断器失败:', error);
      res.status(500).json({ success: false, error: '清理熔断器失败', message: err.message });
    }
  }

  async batchOperateCircuitBreakers(req: Request, res: Response): Promise<void> {
    try {
      const { operation, names } = (req.body ?? {}) as { operation?: string; names?: string[] };
      if (!operation || !Array.isArray(names) || names.length === 0) {
        res
          .status(400)
          .json({ success: false, error: '参数错误', message: '需要提供 operation 和 names 数组' });
        return;
      }
      const results: Array<{
        name: string;
        success: boolean;
        operation: string;
        error?: string;
      }> = [];
      let successCount = 0;
      let failureCount = 0;
      for (const name of names) {
        try {
          let success = false;
          switch (operation) {
            case 'open':
              success = circuitBreakerService.openCircuitBreaker(name, 'batch operation');
              break;
            case 'close':
              success = circuitBreakerService.closeCircuitBreaker(name);
              break;
            case 'reset':
              success = circuitBreakerService.resetCircuitBreaker(name);
              break;
            default:
              throw new Error(`不支持的操作: ${operation}`);
          }
          results.push({ name, success, operation });
          if (success) successCount++;
          else failureCount++;
        } catch (error) {
          const err = error as Error;
          results.push({ name, success: false, operation, error: err.message });
          failureCount++;
        }
      }
      res.json({
        success: true,
        data: { operation, results, summary: { total: names.length, successCount, failureCount } },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[CircuitBreakerController] 批量操作熔断器失败:', error);
      res.status(500).json({ success: false, error: '批量操作熔断器失败', message: err.message });
    }
  }
}

export default new CircuitBreakerController();
