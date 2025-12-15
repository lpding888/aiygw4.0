import knexConfig from './knexfile.js';
import knex from 'knex';

const db = knex(knexConfig.development);

async function detailedDuplicateCheck() {
    try {
        console.log('🔍 详细检查重复索引（只看列组合）...\n');

        // 获取所有表名
        const tables = await db.raw('SHOW TABLES');
        const tableNames = Object.values(tables[0]).map(row => Object.values(row)[0]);

        const duplicates = [];

        for (const table of tableNames) {
            // 获取表的所有索引
            const indexes = await db.raw(`SHOW INDEX FROM \`${table}\``);
            const indexInfo = indexes[0];

            // 按索引名分组
            const indexMap = {};
            for (const idx of indexInfo) {
                if (!indexMap[idx.Key_name]) {
                    indexMap[idx.Key_name] = {
                        columns: [],
                        unique: idx.Non_unique === 0,
                        indexType: idx.Index_type
                    };
                }
                indexMap[idx.Key_name].columns[idx.Seq_in_index - 1] = idx.Column_name;
            }

            // 转换为数组
            const indexList = Object.entries(indexMap).map(([name, info]) => ({
                name,
                columns: info.columns.join(','),
                unique: info.unique,
                indexType: info.indexType
            }));

            // 检查相同列组合的索引（不考虑唯一性差异）
            const seen = new Map();
            for (const idx of indexList) {
                if (idx.name === 'PRIMARY') continue;

                if (seen.has(idx.columns)) {
                    const existing = seen.get(idx.columns);
                    duplicates.push({
                        table,
                        index1: existing.name,
                        index1Unique: existing.unique,
                        index2: idx.name,
                        index2Unique: idx.unique,
                        columns: idx.columns
                    });
                } else {
                    seen.set(idx.columns, idx);
                }
            }
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('📋 完全重复的索引（相同列组合）');
        console.log('═══════════════════════════════════════════════════════════\n');

        if (duplicates.length === 0) {
            console.log('✅ 没有发现完全重复的索引\n');
        } else {
            for (const dup of duplicates) {
                console.log(`表 ${dup.table}:`);
                console.log(`  索引1: "${dup.index1}" (唯一: ${dup.index1Unique ? '是' : '否'})`);
                console.log(`  索引2: "${dup.index2}" (唯一: ${dup.index2Unique ? '是' : '否'})`);
                console.log(`  列: ${dup.columns}`);

                // 如果唯一性不同，则不是严格重复
                if (dup.index1Unique !== dup.index2Unique) {
                    console.log(`  ⚠️ 注意: 唯一性不同，一个是唯一索引，一个不是`);
                } else {
                    console.log(`  ✅ 确认: 可以安全删除其中一个`);
                }
                console.log('');
            }
        }

        console.log(`\n总计: ${duplicates.length} 个完全重复的索引组合`);

    } catch (error) {
        console.error('检查时出错:', error);
    } finally {
        await db.destroy();
    }
}

detailedDuplicateCheck();
