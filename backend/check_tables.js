import knexConfig from './knexfile.js';
import knex from 'knex';

// 使用开发环境配置
const db = knex(knexConfig.development);

async function checkTables() {
  try {
    console.log('🔍 开始检查数据库表结构...');
    
    // 获取所有表名
    const tables = await db.raw('SHOW TABLES');
    const tableNames = Object.values(tables[0]).map(row => Object.values(row)[0]);
    
    console.log(`\n📊 数据库中共有 ${tableNames.length} 个表：`);
    console.log(tableNames.join(', '));
    
    // 检查关键表的结构
    const keyTables = [
      'users',
      'orders',
      'tasks',
      'provider_configs',
      'feature_definitions'
    ];
    
    for (const table of keyTables) {
      if (tableNames.includes(table)) {
        console.log(`\n🔬 检查 ${table} 表结构：`);
        const columns = await db.raw(`DESCRIBE ${table}`);
        console.log('\n列名 | 类型 | 是否为空 | 键 | 默认值 | 额外信息');
        console.log('--- | --- | --- | --- | --- | ---');
        columns[0].forEach(col => {
          console.log(`${col.Field} | ${col.Type} | ${col.Null} | ${col.Key} | ${col.Default} | ${col.Extra}`);
        });
        
        // 检查索引
        const indexes = await db.raw(`SHOW INDEX FROM ${table}`);
        const indexNames = [...new Set(indexes[0].map(idx => idx.Key_name))].filter(idx => idx !== 'PRIMARY');
        if (indexNames.length > 0) {
          console.log(`\n📌 索引：${indexNames.join(', ')}`);
        }
      } else {
        console.log(`\n❌ 表 ${table} 不存在`);
      }
    }
    
    console.log('\n✅ 表结构检查完成！');
    
  } catch (error) {
    console.error('检查表结构时出错:', error);
  } finally {
    await db.destroy();
  }
}

checkTables();
