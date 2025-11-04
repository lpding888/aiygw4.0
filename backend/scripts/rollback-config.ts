#!/usr/bin/env ts-node
/**
 * 配置回滚CLI工具
 * 艹，这个憨批脚本用于回滚配置到历史快照，秒级生效！
 *
 * 使用方法：
 *   node -r ts-node/register scripts/rollback-config.ts --scope provider --key endpoint_1
 *   node -r ts-node/register scripts/rollback-config.ts --snapshot-id abc123 --yes
 *
 * 功能：
 * - 列出指定scope/key的所有快照
 * - 选择目标快照执行回滚
 * - 通过Pub/Sub广播配置失效
 * - 支持--yes自动确认（生产环境慎用）
 */

import db from '../src/db/connection';
import { pubSubService } from '../src/pubsub';
import logger from '../src/utils/logger';
import * as readline from 'readline';

/**
 * 配置快照类型
 */
interface ConfigSnapshot {
  id: string;
  scope: string;
  key: string;
  version: string;
  data: any;
  action: string;
  description: string | null;
  created_by: number | null;
  created_at: Date;
}

/**
 * CLI参数
 */
interface CLIArgs {
  scope?: string;
  key?: string;
  snapshotId?: string;
  yes: boolean;
  help: boolean;
}

/**
 * 解析命令行参数
 */
function parseArgs(): CLIArgs {
  const args: CLIArgs = { yes: false, help: false };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--scope') {
      args.scope = process.argv[++i];
    } else if (arg === '--key') {
      args.key = process.argv[++i];
    } else if (arg === '--snapshot-id') {
      args.snapshotId = process.argv[++i];
    }
  }

  return args;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
配置回滚CLI工具

用法:
  node -r ts-node/register scripts/rollback-config.ts [options]

选项:
  --scope <scope>          配置作用域（provider/announcement/banner等）
  --key <key>              配置key（可选）
  --snapshot-id <id>       直接指定快照ID回滚（跳过选择）
  --yes, -y                自动确认（跳过二次确认）
  --help, -h               显示帮助信息

示例:
  # 列出provider作用域的所有快照并选择回滚
  node -r ts-node/register scripts/rollback-config.ts --scope provider

  # 回滚特定key的配置
  node -r ts-node/register scripts/rollback-config.ts --scope provider --key endpoint_1

  # 直接回滚指定快照（自动确认）
  node -r ts-node/register scripts/rollback-config.ts --snapshot-id abc123 --yes

注意事项:
  ⚠️  回滚操作会立即生效，所有进程1秒内同步
  ⚠️  生产环境建议先不加--yes，二次确认后再执行
  ⚠️  回滚操作会记录到快照表（action=rollback）
`);
}

/**
 * 查询快照列表
 */
async function listSnapshots(scope: string, key?: string): Promise<ConfigSnapshot[]> {
  let query = db('config_snapshots')
    .where('scope', scope)
    .orderBy('created_at', 'desc');

  if (key) {
    query = query.where('key', key);
  }

  const snapshots = await query.select('*');

  return snapshots.map((s: any) => ({
    ...s,
    data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data,
  }));
}

/**
 * 根据ID查询快照
 */
async function getSnapshotById(snapshotId: string): Promise<ConfigSnapshot | null> {
  const snapshot = await db('config_snapshots')
    .where('id', snapshotId)
    .first();

  if (!snapshot) return null;

  return {
    ...snapshot,
    data: typeof snapshot.data === 'string' ? JSON.parse(snapshot.data) : snapshot.data,
  };
}

/**
 * 显示快照列表
 */
function displaySnapshots(snapshots: ConfigSnapshot[]) {
  console.log('\n可回滚的配置快照：\n');
  console.log('序号 | 快照ID | 作用域 | Key | 版本 | 操作 | 创建时间 | 说明');
  console.log('--------------------------------------------------------------------');

  snapshots.forEach((snapshot, index) => {
    const createdAt = new Date(snapshot.created_at).toLocaleString('zh-CN');
    const description = snapshot.description || '-';
    console.log(
      `${index + 1}. | ${snapshot.id.slice(0, 8)} | ${snapshot.scope} | ${snapshot.key} | ${snapshot.version} | ${snapshot.action} | ${createdAt} | ${description}`
    );
  });

  console.log('');
}

/**
 * 提示用户选择快照
 */
async function selectSnapshot(snapshots: ConfigSnapshot[]): Promise<ConfigSnapshot | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('请输入要回滚的快照序号（输入0取消）: ', (answer) => {
      rl.close();

      const index = parseInt(answer) - 1;

      if (index === -1) {
        resolve(null);
      } else if (index >= 0 && index < snapshots.length) {
        resolve(snapshots[index]);
      } else {
        console.log('❌ 无效的序号！');
        resolve(null);
      }
    });
  });
}

/**
 * 二次确认
 */
async function confirmRollback(snapshot: ConfigSnapshot): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n⚠️  即将回滚配置：');
    console.log(`   作用域: ${snapshot.scope}`);
    console.log(`   Key: ${snapshot.key}`);
    console.log(`   版本: ${snapshot.version}`);
    console.log(`   数据: ${JSON.stringify(snapshot.data, null, 2)}`);
    console.log('');

    rl.question('确认回滚？（输入 yes 确认）: ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * 执行回滚操作
 */
async function performRollback(snapshot: ConfigSnapshot): Promise<void> {
  const { scope, key, data, version } = snapshot;

  // 1. 获取目标表名（根据scope映射到实际表）
  const tableMap: Record<string, string> = {
    provider: 'provider_endpoints',
    announcement: 'system_configs',
    banner: 'system_configs',
    feature: 'feature_definitions',
    mcp: 'mcp_endpoints',
  };

  const targetTable = tableMap[scope];

  if (!targetTable) {
    throw new Error(`未知的配置作用域: ${scope}`);
  }

  // 2. 开启事务执行回滚
  await db.transaction(async (trx) => {
    // 2.1 更新目标表的配置
    await trx(targetTable)
      .where('id', key)
      .orWhere('key', key)
      .update({
        ...data,
        updated_at: new Date(),
      });

    // 2.2 记录回滚日志到快照表
    await trx('config_snapshots').insert({
      scope,
      key,
      version: `${version}-rollback-${Date.now()}`,
      data: JSON.stringify(data),
      action: 'rollback',
      description: `回滚到版本 ${version}`,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info(
      `[Rollback] 配置回滚成功: scope=${scope} key=${key} version=${version}`
    );
  });

  // 3. 广播配置失效（通过Pub/Sub）
  await pubSubService.publish({
    scope,
    key,
    version: `${version}-rollback`,
    timestamp: Date.now(),
  });

  logger.info(
    `[Rollback] 配置失效已广播: scope=${scope} key=${key}`
  );
}

/**
 * 主函数
 */
async function main() {
  const args = parseArgs();

  // 显示帮助
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log('🔧 配置回滚工具启动...\n');

  try {
    // 初始化Pub/Sub服务
    await pubSubService.initialize();

    let snapshot: ConfigSnapshot | null = null;

    // 场景1：直接通过快照ID回滚
    if (args.snapshotId) {
      console.log(`正在查询快照: ${args.snapshotId}...`);
      snapshot = await getSnapshotById(args.snapshotId);

      if (!snapshot) {
        console.log(`❌ 未找到快照: ${args.snapshotId}`);
        process.exit(1);
      }

      console.log('✅ 快照查询成功');
    }
    // 场景2：列出快照让用户选择
    else {
      if (!args.scope) {
        console.log('❌ 必须指定 --scope 或 --snapshot-id');
        showHelp();
        process.exit(1);
      }

      console.log(`正在查询 ${args.scope} 的配置快照...`);
      const snapshots = await listSnapshots(args.scope, args.key);

      if (snapshots.length === 0) {
        console.log(`❌ 未找到可回滚的快照: scope=${args.scope} key=${args.key || '全部'}`);
        process.exit(1);
      }

      console.log(`✅ 找到 ${snapshots.length} 个快照`);

      // 显示快照列表
      displaySnapshots(snapshots);

      // 用户选择快照
      snapshot = await selectSnapshot(snapshots);

      if (!snapshot) {
        console.log('❌ 回滚已取消');
        process.exit(0);
      }
    }

    // 二次确认（除非指定了--yes）
    if (!args.yes) {
      const confirmed = await confirmRollback(snapshot);

      if (!confirmed) {
        console.log('❌ 回滚已取消');
        process.exit(0);
      }
    }

    // 执行回滚
    console.log('\n⏳ 正在执行回滚...');
    await performRollback(snapshot);

    console.log('✅ 配置回滚成功！');
    console.log('📢 配置失效已广播，所有进程将在1秒内同步');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ 回滚失败:', error.message);
    logger.error('[Rollback] 回滚失败', error);
    process.exit(1);
  } finally {
    // 清理资源
    await pubSubService.disconnect();
    await db.destroy();
  }
}

// 执行主函数
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
}

export { main as rollbackConfig };
