/**
 * KB Embedding Service
 *
 * 负责为知识库 chunks 生成向量，用于语义检索。
 *
 * 设计：
 * - 默认通过 HTTP MCP 调用外部 embedding 工具（由你在后台配置）。
 * - 未配置/关闭时返回 null，系统自动退化为关键词检索。
 *
 * 配置项（system_configs）：
 * - kb_use_embeddings: boolean，可选；true 开启
 * - kb_embedding_mcp_endpoint_id: string，必填；MCP 端点 id
 * - kb_embedding_mcp_tool_name: string，可选；默认 'embed'
 * - kb_embedding_model: string，可选；透传给工具
 */

import logger from '../utils/logger.js';
import systemConfigService from './systemConfig.service.js';
import mcpEndpointsService from './mcp-endpoints.service.js';

type EmbeddingConfig = {
  enabled: boolean;
  endpointId: string;
  toolName: string;
  model?: string;
};

const toBoolean = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  }
  if (typeof value === 'number') return value > 0;
  return false;
};

class KBEmbeddingService {
  private initialized = false;
  private config: EmbeddingConfig | null = null;

  private async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const enabledRaw = await systemConfigService.get('kb_use_embeddings', 'false');
      const endpointIdRaw = await systemConfigService.get('kb_embedding_mcp_endpoint_id', '');
      const toolNameRaw = await systemConfigService.get('kb_embedding_mcp_tool_name', 'embed');
      const modelRaw = await systemConfigService.get('kb_embedding_model', '');

      const endpointId = String(endpointIdRaw ?? '').trim();
      const toolName = String(toolNameRaw ?? 'embed').trim() || 'embed';
      const model = String(modelRaw ?? '').trim() || undefined;

      const enabled = toBoolean(enabledRaw) && endpointId.length > 0;

      this.config = { enabled, endpointId, toolName, model };
      this.initialized = true;

      logger.info('[KBEmbeddingService] 配置加载完成', {
        enabled,
        endpointId: endpointId ? 'set' : 'empty',
        toolName,
        model: model ? 'set' : 'empty'
      });
    } catch (error) {
      logger.error('[KBEmbeddingService] 配置加载失败，禁用 embedding', error);
      this.config = { enabled: false, endpointId: '', toolName: 'embed' };
      this.initialized = true;
    }
  }

  async isEnabled(): Promise<boolean> {
    await this.init();
    return Boolean(this.config?.enabled);
  }

  /**
   * 生成单条文本 embedding
   * @returns 向量数组；未开启/失败返回 null
   */
  async embed(text: string, userId: string): Promise<number[] | null> {
    await this.init();
    if (!this.config?.enabled) return null;
    if (!text || text.trim().length === 0) return null;

    try {
      const parameters: Record<string, unknown> = { input: text };
      if (this.config.model) parameters.model = this.config.model;

      const resp = await mcpEndpointsService.executeTool(
        this.config.endpointId,
        this.config.toolName,
        parameters,
        userId
      );

      const vector = this.extractVector(resp);
      if (!vector) {
        throw new Error('embedding 结果无法解析');
      }

      return vector;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('[KBEmbeddingService] 生成 embedding 失败', { error: err.message });
      return null;
    }
  }

  async embedMany(texts: string[], userId: string): Promise<(number[] | null)[]> {
    const results: (number[] | null)[] = [];
    for (const t of texts) {
      results.push(await this.embed(t, userId));
    }
    return results;
  }

  private extractVector(resp: unknown): number[] | null {
    if (!resp) return null;

    // 直接数组
    if (Array.isArray(resp) && resp.every((v) => typeof v === 'number')) {
      return resp as number[];
    }

    if (typeof resp === 'object') {
      const obj = resp as Record<string, unknown>;

      const embedding = obj.embedding;
      if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
        return embedding as number[];
      }

      const result = obj.result;
      if (Array.isArray(result) && result.every((v) => typeof v === 'number')) {
        return result as number[];
      }

      const data = obj.data;
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0] as Record<string, unknown>;
        const e = first?.embedding;
        if (Array.isArray(e) && e.every((v) => typeof v === 'number')) {
          return e as number[];
        }
      }
    }

    return null;
  }
}

export default new KBEmbeddingService();
