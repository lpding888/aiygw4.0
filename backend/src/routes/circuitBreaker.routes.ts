import { Router } from 'express';
import circuitBreakerController from '../controllers/circuitBreaker.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
// 旧JS校验中间件，先桥接
import { validateCircuitBreakerOperation } from '../middlewares/validation.middleware.js';

const router = Router();

// 公开健康检查
router.get('/health', circuitBreakerController.healthCheck.bind(circuitBreakerController));

// 认证 + 管理员权限
router.use(authenticate);
router.use(requireRole('admin'));

// 熔断器状态
router.get(
  '/circuit-breakers',
  circuitBreakerController.getAllCircuitBreakers.bind(circuitBreakerController)
);
router.get(
  '/circuit-breakers/stats',
  circuitBreakerController.getCircuitBreakerStats.bind(circuitBreakerController)
);
router.get(
  '/circuit-breakers/:name',
  circuitBreakerController.getCircuitBreaker.bind(circuitBreakerController)
);

// Provider状态
router.get('/providers', circuitBreakerController.getProviderStates.bind(circuitBreakerController));
router.get(
  '/providers/registered',
  circuitBreakerController.getRegisteredProviders.bind(circuitBreakerController)
);
router.get(
  '/providers/:name',
  circuitBreakerController.getProviderState.bind(circuitBreakerController)
);

// 熔断器控制
router.post(
  '/circuit-breakers/:name/open',
  validateCircuitBreakerOperation,
  circuitBreakerController.openCircuitBreaker.bind(circuitBreakerController)
);
router.post(
  '/circuit-breakers/:name/close',
  validateCircuitBreakerOperation,
  circuitBreakerController.closeCircuitBreaker.bind(circuitBreakerController)
);
router.post(
  '/circuit-breakers/:name/reset',
  validateCircuitBreakerOperation,
  circuitBreakerController.resetCircuitBreaker.bind(circuitBreakerController)
);

// Provider统计操作
router.post(
  '/providers/:name/reset-stats',
  validateCircuitBreakerOperation,
  circuitBreakerController.resetProviderStats.bind(circuitBreakerController)
);

// 批量操作
router.post(
  '/circuit-breakers/batch',
  validateCircuitBreakerOperation,
  circuitBreakerController.batchOperateCircuitBreakers.bind(circuitBreakerController)
);

// 清理不活跃熔断器
router.delete(
  '/circuit-breakers/cleanup',
  validateCircuitBreakerOperation,
  circuitBreakerController.cleanupInactiveCircuitBreakers.bind(circuitBreakerController)
);

// 测试操作（仅开发环境）
if (process.env.NODE_ENV === 'development') {
  router.post(
    '/providers/:providerName/:methodName/execute',
    circuitBreakerController.executeProviderMethod.bind(circuitBreakerController)
  );
}

export default router;
