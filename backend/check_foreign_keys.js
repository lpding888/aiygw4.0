import knexConfig from './knexfile.js';
import knex from 'knex';

const db = knex(knexConfig.development);

async function checkForeignKeys() {
    try {
        console.log('🔍 开始检查外键完整性...\n');

        // 获取所有表名
        const tables = await db.raw('SHOW TABLES');
        const tableNames = Object.values(tables[0]).map(row => Object.values(row)[0]);
        const tableSet = new Set(tableNames);

        // 获取所有外键信息
        const allForeignKeys = await db.raw(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM 
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE 
        TABLE_SCHEMA = DATABASE() AND 
        REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `);

        const foreignKeys = allForeignKeys[0];

        console.log('═══════════════════════════════════════════════════════════');
        console.log('📌 所有外键约束');
        console.log('═══════════════════════════════════════════════════════════\n');

        const issues = [];
        const validFKs = [];

        let currentTable = '';
        for (const fk of foreignKeys) {
            if (fk.TABLE_NAME !== currentTable) {
                currentTable = fk.TABLE_NAME;
                console.log(`\n📋 表: ${currentTable}`);
            }

            const refExists = tableSet.has(fk.REFERENCED_TABLE_NAME);
            const status = refExists ? '✅' : '❌';

            console.log(`   ${status} ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
            console.log(`      约束名: ${fk.CONSTRAINT_NAME}`);

            if (!refExists) {
                issues.push({
                    table: fk.TABLE_NAME,
                    column: fk.COLUMN_NAME,
                    constraint: fk.CONSTRAINT_NAME,
                    referencedTable: fk.REFERENCED_TABLE_NAME,
                    referencedColumn: fk.REFERENCED_COLUMN_NAME
                });
            } else {
                validFKs.push(fk);
            }
        }

        console.log('\n');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('❌ 外键引用不存在的表');
        console.log('═══════════════════════════════════════════════════════════\n');

        if (issues.length === 0) {
            console.log('✅ 所有外键引用的表都存在\n');
        } else {
            for (const issue of issues) {
                console.log(`❌ 表 ${issue.table}:`);
                console.log(`   列 ${issue.column} 引用了不存在的表 ${issue.referencedTable}`);
                console.log(`   约束名: ${issue.constraint}\n`);
            }
        }

        // 检查外键数据完整性（引用值是否存在）
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔗 检查外键数据完整性（是否有悬空引用）');
        console.log('═══════════════════════════════════════════════════════════\n');

        const orphanedRecords = [];

        for (const fk of validFKs) {
            try {
                // 检查是否有记录引用了不存在的父记录
                const orphaned = await db.raw(`
          SELECT COUNT(*) as count 
          FROM ?? t
          WHERE t.?? IS NOT NULL 
          AND NOT EXISTS (
            SELECT 1 FROM ?? r WHERE r.?? = t.??
          )
        `, [
                    fk.TABLE_NAME,
                    fk.COLUMN_NAME,
                    fk.REFERENCED_TABLE_NAME,
                    fk.REFERENCED_COLUMN_NAME,
                    fk.COLUMN_NAME
                ]);

                const count = orphaned[0][0].count;
                if (count > 0) {
                    orphanedRecords.push({
                        table: fk.TABLE_NAME,
                        column: fk.COLUMN_NAME,
                        referencedTable: fk.REFERENCED_TABLE_NAME,
                        count
                    });
                }
            } catch (e) {
                // 某些表可能有问题，跳过
            }
        }

        if (orphanedRecords.length === 0) {
            console.log('✅ 没有发现悬空的外键引用\n');
        } else {
            for (const orphan of orphanedRecords) {
                console.log(`⚠️ 表 ${orphan.table}:`);
                console.log(`   有 ${orphan.count} 条记录的 ${orphan.column} 引用了不存在的 ${orphan.referencedTable} 记录\n`);
            }
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('📊 总结');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`   外键约束总数: ${foreignKeys.length} 个`);
        console.log(`   引用不存在表: ${issues.length} 个`);
        console.log(`   悬空引用问题: ${orphanedRecords.length} 个表`);

    } catch (error) {
        console.error('检查时出错:', error);
    } finally {
        await db.destroy();
    }
}

checkForeignKeys();
