import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * 获取租户列表
 * 转发到后端真实API
 */
export async function GET() {
    try {
        // 获取用户token
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            // 未登录，返回空列表
            return NextResponse.json({
                success: true,
                tenants: [],
            });
        }

        // 转发到后端API
        const response = await fetch(`${BACKEND_URL}/api/tenants`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] 获取租户列表失败:', error);
        return NextResponse.json(
            {
                success: false,
                error: '获取租户列表失败',
                tenants: [],
            },
            { status: 500 }
        );
    }
}
