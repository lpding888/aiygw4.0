import type { Request, Response, NextFunction } from 'express';
import pipelineValidator from '../../services/pipelineValidator.service.js';
import logger from '../../utils/logger.js';

interface PipelineValidationData {
  nodes?: unknown;
  edges?: unknown;
}

interface TopologicalSortResult {
  isDAG?: boolean;
  hasCycle?: boolean;
  topologicalOrder?: unknown[];
  remainingNodes?: unknown[];
  cycleNodes?: unknown[];
}

class PipelinesValidateController {
  /**
   * 校验 Pipeline 拓扑结构
   * POST /admin/pipelines/validate
   */
  async validatePipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodes, edges } = req.body as PipelineValidationData;

      if (!Array.isArray(nodes)) {
        res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少必要参数: nodes (数组)'
          }
        });
        return;
      }

      if (!Array.isArray(edges)) {
        res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少必要参数: edges (数组)'
          }
        });
        return;
      }

      const validation = pipelineValidator.validatePipelineTopology({ nodes, edges });

      logger.info('[PipelinesValidateController] 校验完成', {
        nodesCount: nodes.length,
        edgesCount: edges.length,
        valid: validation.valid,
        errorsCount: validation.errors.length,
        warningsCount: validation.warnings.length
      });

      res.json({
        success: true,
        data: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          summary: {
            nodesCount: nodes.length,
            edgesCount: edges.length,
            errorsCount: validation.errors.length,
            warningsCount: validation.warnings.length
          }
        }
      });
    } catch (error) {
      logger.error('[PipelinesValidateController] 校验失败', error);
      next(error);
    }
  }

  /**
   * 获取 Pipeline 拓扑排序
   * POST /admin/pipelines/topological-order
   */
  async getTopologicalOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodes, edges } = req.body as PipelineValidationData;

      if (!Array.isArray(nodes) || !Array.isArray(edges)) {
        res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少必要参数: nodes, edges'
          }
        });
        return;
      }

      const result = pipelineValidator.detectCyclesUsingKahn(nodes, edges) as TopologicalSortResult;
      const isDAG = typeof result.isDAG === 'boolean' ? result.isDAG : !result.hasCycle;
      const topologicalOrder = result.topologicalOrder ?? [];
      const remainingNodes = result.remainingNodes ?? result.cycleNodes ?? [];

      res.json({
        success: true,
        data: {
          isDAG,
          topologicalOrder,
          remainingNodes,
          hasCycle: !isDAG
        }
      });
    } catch (error) {
      logger.error('[PipelinesValidateController] 获取拓扑排序失败', error);
      next(error);
    }
  }
}

export default new PipelinesValidateController();
