/**
 * 移除写死的 AI 功能卡片（model_pose12 / video_generate）。
 *
 * 设计目标：
 * - 不再在系统内置固定 AI 链路，功能必须由人工配置或 AI 规划生成。
 * - 这里采用“软删除 + 禁用”的方式，保证线上已有任务不会因为缺表/缺配置而中断。
 */

exports.up = async function (knex) {
  const now = new Date();
  const fixedFeatureKeys = ['model_pose12', 'video_generate'];

  // 1) 软删除并禁用固定功能
  await knex('feature_definitions').whereIn('feature_key', fixedFeatureKeys).update({
    is_enabled: false,
    is_active: false,
    is_public: false,
    deleted_at: now,
    updated_at: now
  });

  // 2) 兼容旧数据：同时按 feature_id 再兜一遍
  await knex('feature_definitions').whereIn('feature_id', fixedFeatureKeys).update({
    is_enabled: false,
    is_active: false,
    is_public: false,
    deleted_at: now,
    updated_at: now
  });
};

exports.down = async function () {
  // 不自动恢复固定 AI 功能，避免回滚后又出现写死链路。
};
