import knexConfig from './knexfile.js';
import knex from 'knex';

const db = knex(knexConfig.development);

async function removeRedundantNonUniqueIndexes() {
    try {
        console.log('🔍 查找并删除与唯一索引重复的普通索引...\n');

        // 获取所有表名
        const tables = await db.raw('SHOW TABLES');
        const tableNames = Object.values(tables[0]).map(row => Object.values(row)[0]);

        const toRemove = [];

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

            // 找出相同列组合的索引
            const columnGroups = {};
            for (const idx of indexList) {
                if (idx.name === 'PRIMARY') continue;

                if (!columnGroups[idx.columns]) {
                    columnGroups[idx.columns] = [];
                }
                columnGroups[idx.columns].push(idx);
            }

            // 如果同一列组合有唯一索引和普通索引，删除普通索引
            for (const [columns, indexes] of Object.entries(columnGroups)) {
                if (indexes.length > 1) {
                    const uniqueIdx = indexes.find(i => i.unique);
                    const nonUniqueIdxs = indexes.filter(i => !i.unique);

                    if (uniqueIdx && nonUniqueIdxs.length > 0) {
                        for (const idx of nonUniqueIdxs) {
                            toRemove.push({
                                table,
                                indexToRemove: idx.name,
                                indexToKeep: uniqueIdx.name,
                                columns,
                                reason: '唯一索引已存在，普通索引冗余'
                            });
                        }
                    }
                }
            }
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('📋 将要删除的冗余普通索引');
        console.log('═══════════════════════════════════════════════════════════\n');

        if (toRemove.length === 0) {
            console.log('✅ 没有发现冗余索引\n');
            await db.destroy();
            return;
        }

        // 按表分组显示
        const byTable = {};
        for (const item of toRemove) {
            if (!byTable[item.table]) {
                byTable[item.table] = [];
            }
            byTable[item.table].push(item);
        }

        for (const [table, items] of Object.entries(byTable)) {
            console.log(`\n📋 表: ${table}`);
            console.log('─'.repeat(50));
            for (const item of items) {
                console.log(`  ❌ 删除普通索引: "${item.indexToRemove}"`);
                console.log(`  ✅ 保留唯一索引: "${item.indexToKeep}"`);
                console.log(`     列: ${item.columns}`);
                console.log('');
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔧 开始删除冗余索引...');
        console.log('═══════════════════════════════════════════════════════════\n');

        let successCount = 0;
        let failCount = 0;

        for (const item of toRemove) {
            try {
                // 确认索引存在
                const checkIndex = await db.raw(
                    'SHOW INDEX FROM ?? WHERE Key_name = ?',
                    [item.table, item.indexToRemove]
                );

                if (checkIndex[0].length === 0) {
                    console.log(`⏭️  跳过 ${item.table}.${item.indexToRemove} (索引不存在)`);
                    continue;
                }

                // 确认保留的唯一索引存在
                const checkKeep = await db.raw(
                    'SHOW INDEX FROM ?? WHERE Key_name = ?',
                    [item.table, item.indexToKeep]
                );

                if (checkKeep[0].length === 0) {
                    console.log(`⚠️  跳过 ${item.table}.${item.indexToRemove} (唯一索引 ${item.indexToKeep} 不存在)`);
                    continue;
                }

                // 执行删除
                await db.raw('ALTER TABLE ?? DROP INDEX ??', [item.table, item.indexToRemove]);
                console.log(`✅ 已删除 ${item.table}.${item.indexToRemove}`);
                successCount++;

            } catch (error) {
                console.log(`❌ 删除 ${item.table}.${item.indexToRemove} 失败: ${error.message}`);
                failCount++;
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 执行结果');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`   成功删除: ${successCount} 个冗余索引`);
        console.log(`   删除失败: ${failCount} 个索引`);
        console.log(`   原计划删除: ${toRemove.length} 个索引`);

    } catch (error) {
        console.error('执行时出错:', error);
    } finally {
        await db.destroy();
    }
}

removeRedundantNonUniqueIndexes();
