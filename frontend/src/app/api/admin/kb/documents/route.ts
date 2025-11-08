/**
 * 知识库文档管理API路由
 * 艹，必须提供完整的CRUD操作和统计功能！
 *
 * @author 老王
 */

import { NextRequest } from 'next/server';

// 模拟数据库存储
let documents = [
  {
    id: 'doc_001',
    name: 'AI产品设计规范.pdf',
    type: 'pdf',
    size: 2048576,
    status: 'completed',
    progress: 100,
    chunks: 156,
    uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    metadata: {
      pageCount: 45,
      wordCount: 12500,
      language: 'zh-CN'
    }
  },
  {
    id: 'doc_002',
    name: '用户体验设计指南.docx',
    type: 'docx',
    size: 1024000,
    status: 'completed',
    progress: 100,
    chunks: 89,
    uploadedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    metadata: {
      pageCount: 32,
      wordCount: 8900,
      language: 'zh-CN'
    }
  },
  {
    id: 'doc_003',
    name: 'API接口文档.md',
    type: 'md',
    size: 512000,
    status: 'processing',
    progress: 75,
    chunks: 45,
    uploadedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    metadata: {
      wordCount: 5600,
      language: 'zh-CN'
    }
  },
  {
    id: 'doc_004',
    name: '系统架构说明.txt',
    type: 'txt',
    size: 256000,
    status: 'failed',
    progress: 30,
    chunks: 0,
    uploadedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    errorMessage: '文件格式不支持或文件损坏'
  }
];

// GET - 获取文档列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    let filteredDocuments = [...documents];

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      filteredDocuments = filteredDocuments.filter(doc =>
        doc.name.toLowerCase().includes(searchLower)
      );
    }

    // 状态过滤
    if (status) {
      filteredDocuments = filteredDocuments.filter(doc => doc.status === status);
    }

    // 分页
    const total = filteredDocuments.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

    return Response.json({
      success: true,
      data: {
        documents: paginatedDocuments,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('获取文档列表失败:', error);

    return Response.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '获取文档列表失败',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, {
      status: 500
    });
  }
}

// POST - 批量删除文档
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ids } = body;

    if (action === 'batch-delete' && Array.isArray(ids)) {
      // 批量删除
      const initialLength = documents.length;
      documents = documents.filter(doc => !ids.includes(doc.id));
      const deletedCount = initialLength - documents.length;

      return Response.json({
        success: true,
        message: `成功删除 ${deletedCount} 个文档`,
        data: { deleted: deletedCount }
      });
    }

    return Response.json({
      success: false,
      code: 'INVALID_ACTION',
      message: '无效的操作类型'
    }, {
      status: 400
    });

  } catch (error) {
    console.error('批量删除文档失败:', error);

    return Response.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '批量删除文档失败',
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}