/**
 * 停止聊天API路由
 * 艹，简单的停止接口！
 *
 * @author 老王
 */

import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🛑 收到停止聊天请求');

  return Response.json({
    success: true,
    message: '聊天已停止'
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}