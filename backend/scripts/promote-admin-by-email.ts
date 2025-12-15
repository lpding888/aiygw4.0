import 'dotenv/config';
import knex from 'knex';
import { knexConfig } from '../src/config/knex-config';

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('请提供邮箱地址');
        process.exit(1);
    }

    const environment = (process.env.NODE_ENV ?? 'development') as keyof typeof knexConfig;
    const config = knexConfig[environment];
    const db = knex(config);

    try {
        console.log(`连接数据库 (${environment} 模式)...`);

        // 先查找用户
        const user = await db('users')
            .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
            .first();

        if (!user) {
            console.error(`找不到邮箱为 ${email} 的用户`);
            process.exit(1);
        }

        console.log(`找到用户: ID=${user.id}, 当前角色=${user.role}`);

        if (user.role === 'admin') {
            console.log('该用户已经是管理员了，无需操作');
            process.exit(0);
        }

        // 更新为管理员
        await db('users').where({ id: user.id }).update({ role: 'admin' });
        console.log(`✅ 用户 ${email} 已成功设置为管理员`);

    } catch (error) {
        console.error('操作失败:', error);
    } finally {
        await db.destroy();
    }
}

main();
