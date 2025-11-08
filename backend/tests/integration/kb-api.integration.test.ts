/**
 * 知识库API集成测试
 * 艹，这个测试覆盖知识库文档管理和检索的完整流程！
 *
 * 测试范围：
 * - POST /api/admin/kb/documents - 上传文档
 * - GET /api/admin/kb/documents - 获取文档列表
 * - POST /api/admin/kb/query - 检索文档
 * - GET /api/admin/kb/queue-stats - 获取队列统计
 */

import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { db } from '../../src/config/database.js';
import { addIngestJob, getQueueStats } from '../../src/rag/ingest/worker.js';

jest.mock('../../src/rag/ingest/worker.ts');
const mockedAddIngestJob = addIngestJob as jest.MockedFunction<typeof addIngestJob>;
const mockedGetQueueStats = getQueueStats as jest.MockedFunction<typeof getQueueStats>;

describe('Knowledge Base API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });
  let testKbId: string;
  let testDocumentId: string;

  beforeAll(async () => {
    // 清理测试数据
    await db('kb_chunks').where('kb_id', 'like', 'test-%').del();
    await db('kb_documents').where('kb_id', 'like', 'test-%').del();

    testKbId = 'test-kb-integration';

    mockedAddIngestJob.mockResolvedValue();
    mockedGetQueueStats.mockResolvedValue({
      queue: 'kb-ingest',
      counts: {
        waiting: 0,
        active: 0,
        completed: 10,
        failed: 0
      },
      timestamp: new Date().toISOString()
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await db('kb_chunks').where('kb_id', 'like', 'test-%').del();
    await db('kb_documents').where('kb_id', 'like', 'test-%').del();
    await db.destroy();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/kb/documents - 上传文档', () => {
    it('应该成功上传文本文档并创建ingestion任务', async () => {
      // Arrange
      const documentData = {
        kbId: testKbId,
        title: '测试文档-AI技术简介',
        content: '人工智能（AI）是计算机科学的一个分支，致力于开发能够模拟人类智能的系统。',
        format: 'text',
        metadata: {
          author: '测试用户',
          category: 'AI'
        }
      };

      // Act
      const response = await request(app)
        .post('/api/admin/kb/documents')
        .send(documentData)
        .set('Authorization', 'Bearer test-admin-token')
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        documentId: expect.any(String),
        jobId: expect.any(String),
        status: 'queued'
      });

      testDocumentId = response.body.documentId;

      // 验证文档已插入数据库
      const document = await db('kb_documents').where('id', testDocumentId).first();

      expect(document).toMatchObject({
        kb_id: testKbId,
        title: '测试文档-AI技术简介',
        format: 'text',
        status: 'pending'
      });

      // 验证ingestion任务已加入队列
      expect(mockedAddIngestJob).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: testDocumentId,
          kbId: testKbId,
          userId: expect.any(String)
        })
      );
    });

    it('应该支持上传Markdown文档', async () => {
      // Arrange
      const markdownData = {
        kbId: testKbId,
        title: 'Markdown测试文档',
        content: `# 标题1\n\n## 标题2\n\n这是一段**加粗**的文本。`,
        format: 'markdown'
      };

      // Act
      const response = await request(app)
        .post('/api/admin/kb/documents')
        .send(markdownData)
        .set('Authorization', 'Bearer test-admin-token')
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        documentId: expect.any(String),
        jobId: expect.any(String),
        status: 'queued'
      });
    });

    it('应该在未提供必需字段时返回400', async () => {
      // Arrange - 缺少content字段
      const invalidData = {
        kbId: testKbId,
        title: '无效文档',
        format: 'text'
        // content 缺失
      };

      // Act
      const response = await request(app)
        .post('/api/admin/kb/documents')
        .send(invalidData)
        .set('Authorization', 'Bearer test-admin-token')
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('content')
      });
    });

    it('应该在未认证时返回401', async () => {
      // Act
      const response = await request(app)
        .post('/api/admin/kb/documents')
        .send({
          kbId: testKbId,
          title: 'Test',
          content: 'Test content',
          format: 'text'
        })
        .expect(401);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Unauthorized')
      });
    });

    it('应该在非管理员用户访问时返回403', async () => {
      // Act
      const response = await request(app)
        .post('/api/admin/kb/documents')
        .send({
          kbId: testKbId,
          title: 'Test',
          content: 'Test content',
          format: 'text'
        })
        .set('Authorization', 'Bearer test-user-token') // 非管理员token
        .expect(403);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Forbidden')
      });
    });
  });

  describe('GET /api/admin/kb/documents - 获取文档列表', () => {
    beforeAll(async () => {
      // 创建测试文档
      await db('kb_documents').insert([
        {
          id: 'doc-list-1',
          kb_id: testKbId,
          title: '文档1',
          content: 'Content 1',
          format: 'text',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'doc-list-2',
          kb_id: testKbId,
          title: '文档2',
          content: 'Content 2',
          format: 'markdown',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'doc-list-3',
          kb_id: testKbId,
          title: '文档3',
          content: 'Content 3',
          format: 'text',
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    });

    afterAll(async () => {
      await db('kb_documents').whereIn('id', ['doc-list-1', 'doc-list-2', 'doc-list-3']).del();
    });

    it('应该返回指定知识库的所有文档', async () => {
      // Act
      const response = await request(app)
        .get(`/api/admin/kb/documents?kbId=${testKbId}`)
        .set('Authorization', 'Bearer test-admin-token')
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        documents: expect.arrayContaining([
          expect.objectContaining({
            id: 'doc-list-1',
            title: '文档1',
            status: 'completed'
          }),
          expect.objectContaining({
            id: 'doc-list-2',
            title: '文档2',
            status: 'completed'
          }),
          expect.objectContaining({
            id: 'doc-list-3',
            title: '文档3',
            status: 'pending'
          })
        ]),
        total: 3
      });
    });

    it('应该支持分页查询', async () => {
      // Act
      const response = await request(app)
        .get(`/api/admin/kb/documents?kbId=${testKbId}&page=1&limit=2`)
        .set('Authorization', 'Bearer test-admin-token')
        .expect(200);

      // Assert
      expect(response.body.documents.length).toBeLessThanOrEqual(2);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 2);
    });

    it('应该支持按状态筛选', async () => {
      // Act
      const response = await request(app)
        .get(`/api/admin/kb/documents?kbId=${testKbId}&status=completed`)
        .set('Authorization', 'Bearer test-admin-token')
        .expect(200);

      // Assert
      expect(response.body.documents).toHaveLength(2);
      response.body.documents.forEach((doc: any) => {
        expect(doc.status).toBe('completed');
      });
    });
  });

  describe('POST /api/admin/kb/query - 检索文档', () => {
    beforeAll(async () => {
      // 创建测试文档和chunks
      await db('kb_documents').insert({
        id: 'doc-query-1',
        kb_id: testKbId,
        title: 'AI技术概述',
        content: '人工智能技术包括机器学习、深度学习、自然语言处理等多个领域。',
        format: 'text',
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date()
      });

      await db('kb_chunks').insert([
        {
          id: 'chunk-1',
          document_id: 'doc-query-1',
          kb_id: testKbId,
          chunk_index: 0,
          text: '人工智能技术包括机器学习、深度学习',
          embedding: Buffer.from(new Array(1536).fill(0.1)), // Mock embedding
          created_at: new Date()
        },
        {
          id: 'chunk-2',
          document_id: 'doc-query-1',
          kb_id: testKbId,
          chunk_index: 1,
          text: '自然语言处理是AI的重要分支',
          embedding: Buffer.from(new Array(1536).fill(0.2)),
          created_at: new Date()
        }
      ]);
    });

    afterAll(async () => {
      await db('kb_chunks').where('document_id', 'doc-query-1').del();
      await db('kb_documents').where('id', 'doc-query-1').del();
    });

    it('应该成功检索相关文档', async () => {
      // Act
      const response = await request(app)
        .post('/api/admin/kb/query')
        .send({
          kbId: testKbId,
          query: '什么是机器学习？',
          topK: 5
        })
        .set('Authorization', 'Bearer test-admin-token')
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            documentId: 'doc-query-1',
            text: expect.any(String),
            score: expect.any(Number)
          })
        ]),
        total: expect.any(Number)
      });

      expect(response.body.results[0].score).toBeGreaterThan(0);
    });

    it('应该支持限制返回结果数量（topK）', async () => {
      // Act
      const response = await request(app)
        .post('/api/admin/kb/query')
        .send({
          kbId: testKbId,
          query: 'AI技术',
          topK: 1
        })
        .set('Authorization', 'Bearer test-admin-token')
        .expect(200);

      // Assert
      expect(response.body.results.length).toBeLessThanOrEqual(1);
    });

    it('应该在未提供query时返回400', async () => {
      // Act
      const response = await request(app)
        .post('/api/admin/kb/query')
        .send({
          kbId: testKbId,
          // query 缺失
          topK: 5
        })
        .set('Authorization', 'Bearer test-admin-token')
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('query')
      });
    });
  });

  describe('GET /api/admin/kb/queue-stats - 获取队列统计', () => {
    it('应该返回ingestion队列统计信息', async () => {
      // Act
      const response = await request(app)
        .get('/api/admin/kb/queue-stats')
        .set('Authorization', 'Bearer test-admin-token')
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        data: {
          queue: 'kb-ingest',
          counts: {
            waiting: expect.any(Number),
            active: expect.any(Number),
            completed: expect.any(Number),
            failed: expect.any(Number)
          }
        }
      });

      expect(mockedGetQueueStats).toHaveBeenCalled();
    });

    it('应该在未认证时返回401', async () => {
      // Act
      const response = await request(app).get('/api/admin/kb/queue-stats').expect(401);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Unauthorized')
      });
    });
  });

  describe('文档处理流程集成测试', () => {
    it('应该完成从上传到检索的完整流程', async () => {
      // Step 1: 上传文档
      const uploadResponse = await request(app)
        .post('/api/admin/kb/documents')
        .send({
          kbId: testKbId,
          title: '完整流程测试文档',
          content: '这是一个用于测试完整流程的文档，包含了丰富的内容。',
          format: 'text'
        })
        .set('Authorization', 'Bearer test-admin-token')
        .expect(201);

      const { documentId } = uploadResponse.body;

      // Step 2: 模拟文档处理完成，更新状态
      await db('kb_documents').where('id', documentId).update({ status: 'completed' });

      // Step 3: 获取文档列表，验证文档存在
      const listResponse = await request(app)
        .get(`/api/admin/kb/documents?kbId=${testKbId}`)
        .set('Authorization', 'Bearer test-admin-token')
        .expect(200);

      expect(listResponse.body.documents.some((doc: any) => doc.id === documentId)).toBe(true);

      // Step 4: 清理
      await db('kb_documents').where('id', documentId).del();
    });
  });
});
