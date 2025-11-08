/**
 * MSW Server配置
 * 艹，测试和本地开发必须启用Mock！
 *
 * @author 老王
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// 仅在测试环境或明确启用Mock时才启动
const shouldStartServer =
  process.env.NODE_ENV === 'test' ||
  process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true';

export const server = shouldStartServer
  ? setupServer(...handlers)
  : null;

// 导出启动/停止方法
export const startServer = () => server?.listen();
export const stopServer = () => server?.close();