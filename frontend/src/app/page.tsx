'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // 如果已登录,跳转到工作台
    if (user) {
      router.push('/workspace');
    } else {
      // 未登录,跳转到登录页
      router.push('/login');
    }
  }, [user, router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <div>加载中...</div>
    </div>
  );
}
