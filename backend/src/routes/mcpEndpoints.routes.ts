import { Router } from 'express';
import mcpEndpointController from '../controllers/mcpEndpoint.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/require-permission.middleware.js';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

// 资源标识
const resource = 'mcp' as const;

router.get(
  '/',
  requirePermission({ resource, actions: ['read'] }),
  mcpEndpointController.getEndpoints
);

router.get(
  '/stats',
  requirePermission({ resource, actions: ['read'] }),
  mcpEndpointController.getEndpointStats
);

router.get(
  '/server-types',
  requirePermission({ resource, actions: ['read'] }),
  mcpEndpointController.getServerTypes
);

router.get(
  '/templates',
  requirePermission({ resource, actions: ['read'] }),
  mcpEndpointController.getTemplates
);

router.post(
  '/batch-test',
  requirePermission({ resource, actions: ['test'] }),
  mcpEndpointController.batchTestEndpoints
);

router.get(
  '/health',
  requirePermission({ resource, actions: ['read'] }),
  mcpEndpointController.healthCheck
);

router.get(
  '/:id',
  requirePermission({ resource, actions: ['read'] }),
  mcpEndpointController.getEndpointById
);

router.post(
  '/:id/test',
  requirePermission({ resource, actions: ['test'] }),
  mcpEndpointController.testEndpoint
);

router.post(
  '/:id/connect',
  requirePermission({ resource, actions: ['update'] }),
  mcpEndpointController.connectEndpoint
);

router.post(
  '/:id/disconnect',
  requirePermission({ resource, actions: ['update'] }),
  mcpEndpointController.disconnectEndpoint
);

router.post(
  '/:id/discover-tools',
  requirePermission({ resource, actions: ['test'] }),
  mcpEndpointController.discoverTools
);

router.post(
  '/:id/execute',
  requirePermission({ resource, actions: ['update'] }),
  mcpEndpointController.executeTool
);

router.post(
  '/',
  requirePermission({ resource, actions: ['create'] }),
  mcpEndpointController.createEndpoint
);

router.put(
  '/:id',
  requirePermission({ resource, actions: ['update'] }),
  mcpEndpointController.updateEndpoint
);

router.delete(
  '/:id',
  requirePermission({ resource, actions: ['delete'] }),
  mcpEndpointController.deleteEndpoint
);

export default router;
