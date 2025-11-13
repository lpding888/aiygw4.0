'use client';

import { useEffect } from 'react';
import { initWebVitals } from '@/lib/monitoring/web-vitals';

export default function WebVitalsInitializer() {
  useEffect(() => {
    initWebVitals();
  }, []);

  return null;
}
