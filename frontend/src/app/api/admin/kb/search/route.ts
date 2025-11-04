/**
 * 知识库检索API路由
 * 艹，必须支持语义搜索和相关性评分！
 *
 * @author 老王
 */

import { NextRequest } from 'next/server';

// 模拟知识库数据
const knowledgeChunks = [
  {
    id: 'chunk_001',
    content: '人工智能（AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。这包括学习、推理、问题解决、感知和语言理解等能力。',
    documentName: 'AI产品设计规范.pdf',
    chunkIndex: 0,
    metadata: { category: 'AI', relevance: 0.95 }
  },
  {
    id: 'chunk_002',
    content: '机器学习是人工智能的核心技术之一，通过算法让计算机从数据中学习规律，并利用这些规律对新数据进行预测或决策。常见的机器学习类型包括监督学习、无监督学习和强化学习。',
    documentName: 'AI产品设计规范.pdf',
    chunkIndex: 1,
    metadata: { category: 'ML', relevance: 0.92 }
  },
  {
    id: 'chunk_003',
    content: '用户体验设计是以用户为中心的设计方法，旨在创造有用、可用且令人愉快的产品。优秀的用户体验设计需要考虑用户需求、使用场景、技术限制等多个方面。',
    documentName: '用户体验设计指南.docx',
    chunkIndex: 5,
    metadata: { category: 'UX', relevance: 0.88 }
  },
  {
    id: 'chunk_004',
    content: '响应式设计是一种网页设计方法，使网页能够根据不同的设备和屏幕尺寸自动调整布局和内容展示，从而为用户提供最佳的浏览体验。',
    documentName: '用户体验设计指南.docx',
    chunkIndex: 12,
    metadata: { category: 'Design', relevance: 0.85 }
  },
  {
    id: 'chunk_005',
    content: 'RESTful API是一种网络应用程序的设计风格和开发方式，基于HTTP协议，使用标准的HTTP方法（GET、POST、PUT、DELETE等）来实现资源的增删改查操作。',
    documentName: 'API接口文档.md',
    chunkIndex: 3,
    metadata: { category: 'API', relevance: 0.90 }
  }
];

// POST - 执行检索
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK = 5, threshold = 0.7 } = body;

    if (!query || typeof query !== 'string') {
      return Response.json({
        success: false,
        code: 'INVALID_PARAMS',
        message: '检索内容不能为空'
      }, {
        status: 400
      });
    }

    // 模拟语义检索过程
    const queryLower = query.toLowerCase();
    const results = knowledgeChunks
      .map(chunk => {
        // 简单的关键词匹配计算相似度（实际应该使用向量相似度）
        let score = 0;
        const queryWords = queryLower.split(/\s+/);
        const contentWords = chunk.content.toLowerCase().split(/\s+/);

        // 计算词汇重叠度
        const overlap = queryWords.filter(word =>
          contentWords.some(contentWord => contentWord.includes(word))
        ).length;

        score = overlap / queryWords.length;

        // 添加一些随机性模拟真实的语义匹配
        score += Math.random() * 0.2;

        return {
          ...chunk,
          score: Math.min(score, 1.0)
        };
      })
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return Response.json({
      success: true,
      data: {
        results,
        query,
        totalFound: results.length,
        searchTime: Math.random() * 100 + 50, // 模拟检索时间 50-150ms
        threshold
      }
    });

  } catch (error) {
    console.error('检索失败:', error);

    return Response.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '检索失败',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, {
      status: 500
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}