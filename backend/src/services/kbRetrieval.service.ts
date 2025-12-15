/**
 * KB Retrieval Service
 *
 * 统一知识库检索逻辑：
 * - 优先语义检索（embedding 余弦相似度）
 * - 未开启/无向量时退化为关键词 LIKE 检索
 */

import { db } from '../db/index.js';
import logger from '../utils/logger.js';
import kbEmbeddingService from './kbEmbedding.service.js';
import { escapeLikePattern } from '../utils/sql-helpers.js';

export interface RetrieveOptions {
  query: string;
  userId: string;
  kbId?: string;
  topK?: number;
  filters?: Record<string, unknown>;
}

export interface RetrieveResult {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
  title: string;
  kbId: string;
  score?: number;
}

class KBRetrievalService {
  private readonly DEFAULT_TOPK = 5;
  private readonly MAX_CANDIDATES = 500;

  async retrieve(options: RetrieveOptions): Promise<RetrieveResult[]> {
    const { query, userId, kbId, topK = this.DEFAULT_TOPK, filters = {} } = options;
    if (!query || query.trim().length === 0) return [];

    try {
      const useEmbeddings = await kbEmbeddingService.isEnabled();

      if (useEmbeddings) {
        const semantic = await this.semanticRetrieve(query, userId, kbId, topK, filters);
        if (semantic.length > 0) return semantic;
      }

      return await this.keywordRetrieve(query, userId, kbId, topK);
    } catch (error) {
      logger.error('[KBRetrievalService] 检索失败，回退关键词模式', error);
      return await this.keywordRetrieve(query, userId, kbId, topK);
    }
  }

  private async keywordRetrieve(
    query: string,
    userId: string,
    kbId: string | undefined,
    topK: number
  ): Promise<RetrieveResult[]> {
    let dbQuery = db('kb_chunks')
      .join('kb_documents', 'kb_chunks.document_id', 'kb_documents.id')
      .where('kb_documents.user_id', userId)
      .where('kb_documents.status', 'completed');

    if (kbId) {
      dbQuery = dbQuery.where('kb_documents.kb_id', kbId);
    }

    dbQuery = dbQuery.where('kb_chunks.text', 'like', `%${escapeLikePattern(query)}%`);

    const results = await dbQuery
      .select(
        'kb_chunks.id',
        'kb_chunks.text',
        'kb_chunks.metadata',
        'kb_documents.title',
        'kb_documents.kb_id'
      )
      .limit(topK);

    return results.map(
      (r: { id: string; text: string; metadata: string; title: string; kb_id: string }) => ({
        id: r.id,
        text: r.text,
        metadata: this.safeParseJson(r.metadata),
        title: r.title,
        kbId: r.kb_id
      })
    );
  }

  private async semanticRetrieve(
    query: string,
    userId: string,
    kbId: string | undefined,
    topK: number,
    _filters: Record<string, unknown>
  ): Promise<RetrieveResult[]> {
    const queryVector = await kbEmbeddingService.embed(query, userId);
    if (!queryVector) return [];

    let dbQuery = db('kb_chunks')
      .join('kb_documents', 'kb_chunks.document_id', 'kb_documents.id')
      .where('kb_documents.user_id', userId)
      .where('kb_documents.status', 'completed')
      .where('kb_chunks.embedding_status', 'completed');

    if (kbId) {
      dbQuery = dbQuery.where('kb_documents.kb_id', kbId);
    }

    const candidates = await dbQuery
      .select(
        'kb_chunks.id',
        'kb_chunks.text',
        'kb_chunks.metadata',
        'kb_documents.title',
        'kb_documents.kb_id'
      )
      .limit(this.MAX_CANDIDATES);

    const scored: RetrieveResult[] = [];

    for (const c of candidates as Array<{
      id: string;
      text: string;
      metadata: string;
      title: string;
      kb_id: string;
    }>) {
      const metadata = this.safeParseJson(c.metadata);
      const vec = metadata.embedding as number[] | undefined;
      if (!Array.isArray(vec)) continue;

      const score = this.cosineSimilarity(queryVector, vec);
      scored.push({
        id: c.id,
        text: c.text,
        metadata,
        title: c.title,
        kbId: c.kb_id,
        score
      });
    }

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return scored.slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;

    let dot = 0;
    let na = 0;
    let nb = 0;

    for (let i = 0; i < len; i += 1) {
      const va = a[i] ?? 0;
      const vb = b[i] ?? 0;
      dot += va * vb;
      na += va * va;
      nb += vb * vb;
    }

    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  private safeParseJson(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

export default new KBRetrievalService();
