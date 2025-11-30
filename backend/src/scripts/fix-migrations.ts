/**
 * 修复损坏的迁移记录
 * 删除数据库中已不存在的迁移文件记录
 */
import { db } from '../config/database.js';
import logger from '../utils/logger.js';

async function fixMigrations() {
  try {
    logger.info('开始清理损坏的迁移记录...');

    // 测试数据库连接
    await db.raw('SELECT 1');
    logger.info('数据库连接成功');

    // 删除已不存在的迁移文件记录
    const missingMigrations = [
      '20251128000001_fix_provider_endpoints_schema.cjs',
      '20251128000002_add_dynamic_provider_fields.cjs'
    ];

    for (const migrationName of missingMigrations) {
      const deleted = await db('knex_migrations')
        .where('name', migrationName)
        .del();

      if (deleted > 0) {
        logger.info(`已删除损坏的迁移记录: ${migrationName}`);
      } else {
        logger.info(`迁移记录不存在（可能已删除）: ${migrationName}`);
      }
    }

    logger.info('✅ 迁移记录清理完成');

    // 关闭数据库连接
    await db.destroy();
    process.exit(0);
  } catch (error) {
    logger.error('清理迁移记录失败:', error);
    await db.destroy();
    process.exit(1);
  }
}

fixMigrations();
