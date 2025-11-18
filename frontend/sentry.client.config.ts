let Sentry: any = null;

try {
  // 可选加载，未安装时直接忽略
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sentry = require('@sentry/nextjs');
} catch {
  Sentry = null;
}

if (Sentry && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.01,
    ignoreErrors: ['ResizeObserver loop limit exceeded'],
  });
}
