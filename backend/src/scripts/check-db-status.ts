/**
 * 检查数据库状态
 */
import knex from 'knex';
import knexConfig from '../../knexfile.js';

async function checkDbStatus() {
  const db = knex(knexConfig.development);

  try {
    console.log('📊 开始检查数据库状态...\n');

    // 1. 检查迁移记录
    console.log('=== 1. 迁移记录 (knex_migrations) ===');
    const migrations = await db('knex_migrations').select('*').orderBy('id', 'desc');
    console.log(`共有 ${migrations.length} 条迁移记录：`);
    migrations.forEach((m, i) => {
      console.log(`${i + 1}. ${m.name} (batch: ${m.batch})`);
    });

    // 2. 检查 provider_endpoints 表结构
    console.log('\n=== 2. provider_endpoints 表结构 ===');
    const columns = await db.raw('DESCRIBE provider_endpoints');
    console.log('字段列表：');
    columns[0].forEach((col: any) => {
      console.log(
        `- ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''}`
      );
    });

    // 3. 检查是否有 provider_ref 字段
    const hasProviderRef = columns[0].some((col: any) => col.Field === 'provider_ref');
    console.log(`\n❓ provider_ref 字段存在: ${hasProviderRef ? '✅ 是' : '❌ 否'}`);

    // 4. 检查表中数据
    console.log('\n=== 3. provider_endpoints 数据统计 ===');
    const count = await db('provider_endpoints').count('* as total').first();
    console.log(`表中共有 ${count?.total || 0} 条数据`);

    if (count && count.total > 0) {
      const sample = await db('provider_endpoints').select('*').limit(3);
      console.log('\n前3条数据样本：');
      sample.forEach((row, i) => {
        console.log(`${i + 1}.`, JSON.stringify(row, null, 2));
      });
    }

    console.log('\n✅ 检查完成');
  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await db.destroy();
  }
}

checkDbStatus();
