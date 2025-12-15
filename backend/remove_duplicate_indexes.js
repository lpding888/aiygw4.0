import knexConfig from './knexfile.js';
import knex from 'knex';

const db = knex(knexConfig.development);

async function verifyAndRemoveDuplicateIndexes() {
    try {
        console.log('🔍 开始详细验证重复索引...\n');

        // 获取所有表名
        const tables = await db.raw('SHOW TABLES');
        const tableNames = Object.values(tables[0]).map(row => Object.values(row)[0]);

        const duplicatesToRemove = [];

        for (const table of tableNames) {
            // 获取表的所有索引
            const indexes = await db.raw(`SHOW INDEX FROM \`${table}\``);
            const indexInfo = indexes[0];

            // 按索引名分组，获取每个索引的详细信息
            const indexMap = {};
            for (const idx of indexInfo) {
                if (!indexMap[idx.Key_name]) {
                    indexMap[idx.Key_name] = {
                        columns: [],
                        unique: idx.Non_unique === 0,
                        indexType: idx.Index_type,
                        nullable: idx.Null === 'YES'
                    };
                }
                indexMap[idx.Key_name].columns[idx.Seq_in_index - 1] = idx.Column_name;
            }

            // 转换为数组便于比较
            const indexList = Object.entries(indexMap).map(([name, info]) => ({
                name,
                columns: info.columns.join(','),
                unique: info.unique,
                indexType: info.indexType
            }));

            // 检查完全相同的索引（相同列组合）
            const seen = new Map();
            for (const idx of indexList) {
                if (idx.name === 'PRIMARY') continue; // 跳过主键

                const key = `${idx.columns}:${idx.unique}:${idx.indexType}`;
                if (seen.has(key)) {
                    const existing = seen.get(key);
                    // 决定保留哪个索引（优先保留命名更规范的）
                    let toKeep, toRemove;

                    // 优先保留 idx_ 开头的（命名规范），或者保留更短的名字
                    if (idx.name.startsWith('idx_') && !existing.name.startsWith('idx_')) {
                        toKeep = idx;
                        toRemove = existing;
                    } else if (!idx.name.startsWith('idx_') && existing.name.startsWith('idx_')) {
                        toKeep = existing;
                        toRemove = idx;
                    } else if (idx.name.length < existing.name.length) {
                        toKeep = idx;
                        toRemove = existing;
                    } else {
                        toKeep = existing;
                        toRemove = idx;
                    }

                    duplicatesToRemove.push({
                        table,
                        indexToRemove: toRemove.name,
                        indexToKeep: toKeep.name,
                        columns: idx.columns,
                        unique: idx.unique,
                        indexType: idx.indexType
                    });

                    // 更新 seen 保留的索引
                    seen.set(key, toKeep);
                } else {
                    seen.set(key, idx);
                }
            }
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('📋 详细验证结果 - 确认要删除的重复索引');
        console.log('═══════════════════════════════════════════════════════════\n');

        if (duplicatesToRemove.length === 0) {
            console.log('✅ 没有发现完全重复的索引\n');
            await db.destroy();
            return;
        }

        // 按表分组显示
        const byTable = {};
        for (const dup of duplicatesToRemove) {
            if (!byTable[dup.table]) {
                byTable[dup.table] = [];
            }
            byTable[dup.table].push(dup);
        }

        for (const [table, dups] of Object.entries(byTable)) {
            console.log(`\n📋 表: ${table}`);
            console.log('─'.repeat(50));
            for (const dup of dups) {
                console.log(`  ❌ 删除: "${dup.indexToRemove}"`);
                console.log(`  ✅ 保留: "${dup.indexToKeep}"`);
                console.log(`     列: ${dup.columns}`);
                console.log(`     类型: ${dup.indexType}, 唯一: ${dup.unique ? '是' : '否'}`);
                console.log('');
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔧 开始删除重复索引...');
        console.log('═══════════════════════════════════════════════════════════\n');

        let successCount = 0;
        let failCount = 0;

        for (const dup of duplicatesToRemove) {
            try {
                // 再次确认索引存在
                const checkIndex = await db.raw(
                    'SHOW INDEX FROM ?? WHERE Key_name = ?',
                    [dup.table, dup.indexToRemove]
                );

                if (checkIndex[0].length === 0) {
                    console.log(`⏭️  跳过 ${dup.table}.${dup.indexToRemove} (索引不存在)`);
                    continue;
                }

                // 确认保留的索引存在
                const checkKeep = await db.raw(
                    'SHOW INDEX FROM ?? WHERE Key_name = ?',
                    [dup.table, dup.indexToKeep]
                );

                if (checkKeep[0].length === 0) {
                    console.log(`⚠️  跳过 ${dup.table}.${dup.indexToRemove} (保留的索引 ${dup.indexToKeep} 不存在)`);
                    continue;
                }

                // 执行删除
                await db.raw('ALTER TABLE ?? DROP INDEX ??', [dup.table, dup.indexToRemove]);
                console.log(`✅ 已删除 ${dup.table}.${dup.indexToRemove}`);
                successCount++;

            } catch (error) {
                console.log(`❌ 删除 ${dup.table}.${dup.indexToRemove} 失败: ${error.message}`);
                failCount++;
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 执行结果');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`   成功删除: ${successCount} 个索引`);
        console.log(`   删除失败: ${failCount} 个索引`);
        console.log(`   原计划删除: ${duplicatesToRemove.length} 个索引`);

    } catch (error) {
        console.error('执行时出错:', error);
    } finally {
        await db.destroy();
    }
}

verifyAndRemoveDuplicateIndexes();
