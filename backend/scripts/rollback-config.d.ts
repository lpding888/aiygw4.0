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
/**
 * 主函数
 */
declare function main(): Promise<void>;
export { main as rollbackConfig };
//# sourceMappingURL=rollback-config.d.ts.map
