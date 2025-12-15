import knexConfig from './knexfile.js';
import knex from 'knex';

// 使用开发环境配置
const db = knex(knexConfig.development);

async function checkAllTables() {
  try {
    console.log('🔍 开始全面检查数据库表结构...');
    
    // 获取所有表名
    const tables = await db.raw('SHOW TABLES');
    const tableNames = Object.values(tables[0]).map(row => Object.values(row)[0]);
    
    console.log(`\n📊 数据库中共有 ${tableNames.length} 个表`);
    
    const issues = [];
    const optimizations = [];
    
    for (const table of tableNames) {
      console.log(`\n🔬 检查 ${table} 表...`);
      
      // 检查表结构
      const columns = await db.raw(`DESCRIBE ${table}`);
      const columnInfo = columns[0];
      
      // 检查索引
      const indexes = await db.raw(`SHOW INDEX FROM ${table}`);
      const indexInfo = indexes[0];
      
      // 检查外键
      const foreignKeys = await db.raw(`
        SELECT 
          CONSTRAINT_NAME, 
          COLUMN_NAME, 
          REFERENCED_TABLE_NAME, 
          REFERENCED_COLUMN_NAME 
        FROM 
          INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE 
          TABLE_SCHEMA = DATABASE() AND 
          TABLE_NAME = '${table}' AND 
          CONSTRAINT_NAME != 'PRIMARY' AND 
          REFERENCED_TABLE_NAME IS NOT NULL
      `);
      const foreignKeyInfo = foreignKeys[0];
      
      // 1. 检查是否有主键
      const hasPrimaryKey = columnInfo.some(col => col.Key === 'PRI');
      if (!hasPrimaryKey) {
        issues.push(`❌ ${table} 表没有主键`);
      }
      
      // 2. 检查主键类型
      const primaryKeyCols = columnInfo.filter(col => col.Key === 'PRI');
      if (primaryKeyCols.length > 1) {
        optimizations.push(`⚠️ ${table} 表使用了复合主键，考虑使用单一主键`);
      }
      
      // 3. 检查是否有自增主键
      const hasAutoIncrement = columnInfo.some(col => col.Extra.includes('auto_increment'));
      if (!hasAutoIncrement && primaryKeyCols.length === 1) {
        const pkType = primaryKeyCols[0].Type;
        if (!pkType.includes('varchar') && !pkType.includes('char')) {
          optimizations.push(`⚠️ ${table} 表的主键不是自增的，考虑使用自增主键`);
        }
      }
      
      // 4. 检查索引数量
      const indexNames = [...new Set(indexInfo.map(idx => idx.Key_name))];
      const uniqueIndexCount = indexInfo.filter(idx => idx.Non_unique === 0).length;
      
      if (indexNames.length > 10) {
        optimizations.push(`⚠️ ${table} 表索引数量过多 (${indexNames.length}个)，可能影响写入性能`);
      }
      
      // 5. 检查是否有外键约束
      if (foreignKeyInfo.length > 0) {
        console.log(`   外键约束: ${foreignKeyInfo.map(fk => `${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`).join(', ')}`);
      }
      
      // 6. 检查字段类型合理性
      for (const col of columnInfo) {
        // 检查字符串类型长度
        if (col.Type.startsWith('varchar')) {
          const length = parseInt(col.Type.match(/\d+/)[0]);
          if (length > 500) {
            optimizations.push(`⚠️ ${table} 表的 ${col.Field} 字段 varchar 长度过大 (${length})，考虑使用 text 类型`);
          }
        }
        
        // 检查是否有 NOT NULL 约束
        if (col.Null === 'YES' && col.Key !== '' && !col.Field.includes('deleted_at')) {
          optimizations.push(`⚠️ ${table} 表的索引字段 ${col.Field} 允许为 NULL，考虑添加 NOT NULL 约束`);
        }
        
        // 检查时间戳字段
        if (col.Type === 'timestamp' && !col.Extra.includes('DEFAULT_GENERATED')) {
          optimizations.push(`⚠️ ${table} 表的 ${col.Field} 时间戳字段没有默认值，考虑添加 DEFAULT CURRENT_TIMESTAMP`);
        }
      }
      
      // 7. 检查是否有 updated_at 字段
      const hasUpdatedAt = columnInfo.some(col => col.Field === 'updated_at');
      if (!hasUpdatedAt && !table.startsWith('knex_')) {
        optimizations.push(`⚠️ ${table} 表缺少 updated_at 字段，建议添加`);
      }
      
      // 8. 检查是否有 created_at 字段
      const hasCreatedAt = columnInfo.some(col => col.Field === 'created_at');
      if (!hasCreatedAt && !table.startsWith('knex_')) {
        optimizations.push(`⚠️ ${table} 表缺少 created_at 字段，建议添加`);
      }
      
      // 9. 检查索引覆盖度
      const indexedColumns = new Set(indexInfo.map(idx => idx.Column_name));
      const allColumns = new Set(columnInfo.map(col => col.Field));
      const unindexedColumns = [...allColumns].filter(col => !indexedColumns.has(col) && col !== 'created_at' && col !== 'updated_at');
      
      if (unindexedColumns.length > 0 && unindexedColumns.length < allColumns.size / 2) {
        optimizations.push(`⚠️ ${table} 表有 ${unindexedColumns.length} 个字段没有索引，考虑为常用查询字段添加索引`);
      }
      
      // 10. 检查是否有重复索引
      const indexColumnMap = {};
      for (const idx of indexInfo) {
        const key = `${idx.Key_name}_${idx.Seq_in_index}`;
        if (!indexColumnMap[idx.Key_name]) {
          indexColumnMap[idx.Key_name] = [];
        }
        indexColumnMap[idx.Key_name].push(idx.Column_name);
      }
      
      // 简单检查重复索引（相同列顺序）
      const indexSignatures = [];
      for (const [name, columns] of Object.entries(indexColumnMap)) {
        const sig = columns.join(',');
        if (indexSignatures.includes(sig)) {
          issues.push(`❌ ${table} 表存在重复索引，列组合为: ${sig}`);
        } else {
          indexSignatures.push(sig);
        }
      }
      
      // 11. 检查外键引用的表是否存在
      for (const fk of foreignKeyInfo) {
        if (!tableNames.includes(fk.REFERENCED_TABLE_NAME)) {
          issues.push(`❌ ${table} 表的外键 ${fk.COLUMN_NAME} 引用了不存在的表 ${fk.REFERENCED_TABLE_NAME}`);
        }
      }
      
      // 12. 检查是否有软删除字段
      const hasDeletedAt = columnInfo.some(col => col.Field === 'deleted_at');
      if (!hasDeletedAt && !table.startsWith('knex_') && !table.includes('_lock') && !table.includes('_history')) {
        optimizations.push(`ℹ️ ${table} 表没有软删除字段，考虑添加 deleted_at 字段支持软删除`);
      }
    }
    
    console.log('\n\n🔍 检查完成！');
    
    if (issues.length > 0) {
      console.log('\n❌ 发现的问题:');
      issues.forEach(issue => console.log(`   ${issue}`));
    } else {
      console.log('\n✅ 没有发现严重问题！');
    }
    
    if (optimizations.length > 0) {
      console.log('\n⚠️ 优化建议:');
      optimizations.forEach(opt => console.log(`   ${opt}`));
    } else {
      console.log('\n✅ 没有优化建议！');
    }
    
    console.log(`\n📋 总结:`);
    console.log(`   总表数: ${tableNames.length}`);
    console.log(`   发现问题: ${issues.length}个`);
    console.log(`   优化建议: ${optimizations.length}条`);
    
  } catch (error) {
    console.error('检查表结构时出错:', error);
  } finally {
    await db.destroy();
  }
}

checkAllTables();
