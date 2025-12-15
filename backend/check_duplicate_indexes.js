import knexConfig from './knexfile.js';
import knex from 'knex';

const db = knex(knexConfig.development);

async function checkDuplicateIndexes() {
  try {
    console.log('🔍 开始检查重复索引...\n');
    
    // 获取所有表名
    const tables = await db.raw('SHOW TABLES');
    const tableNames = Object.values(tables[0]).map(row => Object.values(row)[0]);
    
    const duplicates = [];
    const redundantIndexes = [];
    
    for (const table of tableNames) {
      // 获取表的所有索引
      const indexes = await db.raw(`SHOW INDEX FROM ${table}`);
      const indexInfo = indexes[0];
      
      // 按索引名分组，获取每个索引的列组合
      const indexMap = {};
      for (const idx of indexInfo) {
        if (!indexMap[idx.Key_name]) {
          indexMap[idx.Key_name] = {
            columns: [],
            unique: idx.Non_unique === 0
          };
        }
        indexMap[idx.Key_name].columns[idx.Seq_in_index - 1] = idx.Column_name;
      }
      
      // 转换为数组便于比较
      const indexList = Object.entries(indexMap).map(([name, info]) => ({
        name,
        columns: info.columns.join(','),
        unique: info.unique
      }));
      
      // 检查完全相同的索引（相同列组合）
      const seen = new Map();
      for (const idx of indexList) {
        if (seen.has(idx.columns)) {
          duplicates.push({
            table,
            index1: seen.get(idx.columns),
            index2: idx.name,
            columns: idx.columns
          });
        } else {
          seen.set(idx.columns, idx.name);
        }
      }
      
      // 检查冗余索引（一个索引是另一个索引的前缀）
      for (let i = 0; i < indexList.length; i++) {
        for (let j = 0; j < indexList.length; j++) {
          if (i === j) continue;
          const idx1 = indexList[i];
          const idx2 = indexList[j];
          
          // 跳过PRIMARY键
          if (idx1.name === 'PRIMARY' || idx2.name === 'PRIMARY') continue;
          
          // 如果idx1是idx2的前缀，则idx1可能是冗余的
          if (idx2.columns.startsWith(idx1.columns + ',')) {
            // 除非idx1是唯一索引而idx2不是
            if (idx1.unique && !idx2.unique) continue;
            
            redundantIndexes.push({
              table,
              redundantIndex: idx1.name,
              coveredBy: idx2.name,
              redundantColumns: idx1.columns,
              coveringColumns: idx2.columns
            });
          }
        }
      }
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📌 完全重复的索引（相同列组合）');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (duplicates.length === 0) {
      console.log('✅ 没有发现完全重复的索引\n');
    } else {
      for (const dup of duplicates) {
        console.log(`❌ 表 ${dup.table}:`);
        console.log(`   索引 "${dup.index1}" 和 "${dup.index2}" 是重复的`);
        console.log(`   列组合: ${dup.columns}`);
        console.log(`   建议: 删除其中一个索引\n`);
      }
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⚠️ 可能冗余的索引（被其他索引覆盖）');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (redundantIndexes.length === 0) {
      console.log('✅ 没有发现冗余索引\n');
    } else {
      for (const red of redundantIndexes) {
        console.log(`⚠️ 表 ${red.table}:`);
        console.log(`   索引 "${red.redundantIndex}" (${red.redundantColumns})`);
        console.log(`   被索引 "${red.coveredBy}" (${red.coveringColumns}) 覆盖`);
        console.log(`   说明: 查询可以使用更大的复合索引的前缀部分\n`);
      }
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 总结');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   完全重复索引: ${duplicates.length} 个`);
    console.log(`   可能冗余索引: ${redundantIndexes.length} 个`);
    
  } catch (error) {
    console.error('检查时出错:', error);
  } finally {
    await db.destroy();
  }
}

checkDuplicateIndexes();
