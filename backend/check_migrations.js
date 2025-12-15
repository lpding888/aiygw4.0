import knexConfig from './knexfile.js';
import knex from 'knex';

// 使用开发环境配置
const db = knex(knexConfig.development);

async function checkMigrations() {
  try {
    // 查看已执行的迁移
    const migrations = await db('knex_migrations').select('*').orderBy('id', 'asc');
    console.log('已执行的迁移:');
    migrations.forEach(mig => {
      console.log(`${mig.id}: ${mig.name} (${mig.batch})`);
    });
    
    // 查看所有迁移文件
    console.log('\n所有迁移文件:');
    const fs = require('fs');
    const path = require('path');
    const migrationFiles = fs.readdirSync(path.join(__dirname, 'src/db/migrations'));
    migrationFiles.forEach(file => {
      console.log(file);
    });
    
    // 查看provider_configs表是否存在
    const hasTable = await db.schema.hasTable('provider_configs');
    console.log(`\nprovider_configs表是否存在: ${hasTable}`);
    
  } catch (error) {
    console.error('检查迁移时出错:', error);
  } finally {
    await db.destroy();
  }
}

checkMigrations();
