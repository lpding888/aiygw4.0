import { api } from './api';

// 手动触发后端缓存刷新 (再次触发)
async function forceReload() {
  try {
    console.log('Frontend updated. Waiting for recompile...');
  } catch (e) {
    console.error(e);
  }
}

forceReload();
