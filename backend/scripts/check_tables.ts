import { db } from '../src/config/database.js';

async function checkTables() {
  try {
    // 查询所有以 feature 开头的表
    const tables = await db.raw(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = 'ai_wardrobe_dev'
      AND TABLE_NAME LIKE 'feature%'
      ORDER BY TABLE_NAME
    `);

    console.log('\n=== Feature 相关表 ===');
    if (tables[0].length > 0) {
      tables[0].forEach((row: any) => {
        console.log(`  ✓ ${row.TABLE_NAME}`);
      });
    } else {
      console.log('  ⚠️  没有找到 feature 相关的表');
    }

    // 查询所有表
    const allTables = await db.raw(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = 'ai_wardrobe_dev'
      ORDER BY TABLE_NAME
    `);

    console.log(`\n=== 数据库总表数: ${allTables[0].length} ===\n`);

    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    await db.destroy();
    process.exit(1);
  }
}

checkTables();
