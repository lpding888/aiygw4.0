/**
 * 知识库统计API路由
 * 艹，必须提供实时的统计数据和监控信息！
 *
 * @author 老王
 */

import { NextRequest } from 'next/server';

// 模拟统计数据
const queueStats = {
  pending: 3,
  processing: 2,
  completed: 156,
  failed: 2,
  avgProcessingTime: 45.6,
  throughput: 12.5
};

const systemStats = {
  totalDocuments: 163,
  totalChunks: 2456,
  totalSize: 52428800, // 50MB
  avgChunksPerDoc: 15.1,
  processingRate: 89.5,
  successRate: 95.2
};

// 获取队列统计
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'queue';

    if (type === 'queue') {
      return Response.json({
        success: true,
        data: queueStats
      });
    } else if (type === 'system') {
      return Response.json({
        success: true,
        data: systemStats
      });
    } else {
      return Response.json({
        success: true,
        data: {
          queue: queueStats,
          system: systemStats
        }
      });
    }

  } catch (error) {
    console.error('获取统计数据失败:', error);

    return Response.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '获取统计数据失败',
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