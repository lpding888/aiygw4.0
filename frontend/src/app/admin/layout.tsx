'use client';

import ProAdminLayout from '@/components/layouts/ProAdminLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ProAdminLayout>{children}</ProAdminLayout>;
}
