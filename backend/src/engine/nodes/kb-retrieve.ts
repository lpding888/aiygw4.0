/**
 * KB检索节点执行器
 * 艹，这个憨批节点负责从知识库检索上下文并拼装到Prompt！
 */

import axios from 'axios';
import db from '../../db/index.js';
import logger from '../../utils/logger.js';
import {
  NodeExecutor,
  NodeExecutionContext,
  NodeExecutionResult,
  NodeConfig,
  NodeError,
  NodeErrorType
} from '../types.js';

/**
 * KB检索配置
 */
interface KBRetrieveConfig {
  query: string; // 检索查询（支持变量模板）
  kbId?: string; // 知识库ID（可选）
  topK?: number; // 返回结果数量（默认5）
  filters?: Record<string, unknown>; // 过滤条件
  outputKey?: string; // 输出键名（默认'contexts'）
}

/**
 * KB检索结果
 */
interface RetrieveResult {
  id: string;
  text: string;
  metadata: unknown;
  title: string;
  kbId: string;
}

/**
 * KB检索节点执行器
 */
class KBRetrieveNodeExecutor implements NodeExecutor {
  /**
   * 执行KB检索节点
   */
  async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const config = this.parseConfig(context.node);

      logger.info(
        `[KBRetrieve] 开始检索: flowId=${context.flowContext.flowId} ` + `nodeId=${context.node.id}`
      );

      // 解析查询变量
      const resolvedQuery = this.resolveValue(config.query, context.flowContext.state);

      // 执行检索
      const results = await this.retrieve(
        resolvedQuery,
        config.kbId,
        config.topK || 5,
        config.filters || {}
      );

      // 合并结果到流程状态
      const outputKey = config.outputKey || 'contexts';
      context.flowContext.state[outputKey] = results.map((r) => r.text);
      context.flowContext.state[`${outputKey}_metadata`] = results;

      const duration = Date.now() - startTime;

      logger.info(
        `[KBRetrieve] 检索成功: nodeId=${context.node.id} ` +
          `results=${results.length} duration=${duration}ms`
      );

      return {
        success: true,
        outputs: {
          [outputKey]: results.map((r) => r.text),
          [`${outputKey}_metadata`]: results
        },
        duration
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      logger.error(`[KBRetrieve] 检索失败: nodeId=${context.node.id}`, error);

      return {
        success: false,
        error: this.handleError(error),
        duration
      };
    }
  }

  /**
   * 验证节点配置
   */
  validate(config: NodeConfig): boolean {
    try {
      const kbConfig = config.config as KBRetrieveConfig;

      if (!kbConfig.query) {
        logger.error('[KBRetrieve] 缺少query');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('[KBRetrieve] 配置验证失败:', error);
      return false;
    }
  }

  /**
   * 解析节点配置
   * @private
   */
  private parseConfig(node: NodeConfig): KBRetrieveConfig {
    return node.config as KBRetrieveConfig;
  }

  /**
   * 执行检索
   * @private
   */
  private async retrieve(
    query: string,
    kbId: string | undefined,
    topK: number,
    filters: Record<string, unknown>
  ): Promise<RetrieveResult[]> {
    try {
      // 简化实现：直接查询数据库
      let dbQuery = db('kb_chunks')
        .join('kb_documents', 'kb_chunks.document_id', 'kb_documents.id')
        .where('kb_documents.status', 'completed');

      if (kbId) {
        dbQuery = dbQuery.where('kb_documents.kb_id', kbId);
      }

      // 文本相似度匹配（简化版）
      dbQuery = dbQuery.where('kb_chunks.text', 'like', `%${query}%`);

      const results = await dbQuery
        .select(
          'kb_chunks.id',
          'kb_chunks.text',
          'kb_chunks.metadata',
          'kb_documents.title',
          'kb_documents.kb_id'
        )
        .limit(topK);

      return results.map((r: { id: string; text: string; metadata: string; title: string; kb_id: string }) => ({
        id: r.id,
        text: r.text,
        metadata: JSON.parse(r.metadata || '{}'),
        title: r.title,
        kbId: r.kb_id
      }));
    } catch (error) {
      logger.error('[KBRetrieve] 数据库查询失败:', error);
      throw error;
    }
  }

  /**
   * 解析变量值
   * @private
   */
  private resolveValue(value: unknown, state: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const resolved = this.getNestedValue(state, path.trim());
        return resolved !== undefined ? resolved : match;
      });
    }
    return value;
  }

  /**
   * 获取嵌套对象值
   * @private
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 处理错误
   * @private
   */
  private handleError(error: unknown): NodeError {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      code: 'KB_RETRIEVE_ERROR',
      message: err.message || 'KB retrieve failed',
      type: NodeErrorType.KB_RETRIEVE_ERROR
    };
  }
}

// 导出单例
export const kbRetrieveExecutor = new KBRetrieveNodeExecutor();

export default kbRetrieveExecutor;
