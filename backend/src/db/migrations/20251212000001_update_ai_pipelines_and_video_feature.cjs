/**
 * 统一 Pipeline Schema steps 格式（旧 steps 迁到运行期格式）。
 *
 * 注意：不再内置任何固定 AI 链路（model_pose12 / video_generate），
 * 这些应由人工配置或 AI 规划生成。
 */

exports.up = async function (knex) {
  const now = new Date();

  // ---------- Pipeline Schemas (v1) ----------
  const pipelineUpdates = [
    {
      pipeline_id: 'basic_clean_pipeline',
      steps: [
        {
          type: 'SYNC_IMAGE_PROCESS',
          provider_ref: 'tencent_ci_basic_clean',
          timeout: 30000,
          retry_policy: { maxAttempts: 2, delayMs: 1000 }
        }
      ]
    }
  ];

  for (const pipeline of pipelineUpdates) {
    const exists = await knex('pipeline_schemas')
      .where('pipeline_id', pipeline.pipeline_id)
      .first();

    if (exists) {
      await knex('pipeline_schemas')
        .where('pipeline_id', pipeline.pipeline_id)
        .update({
          steps: JSON.stringify(pipeline.steps),
          updated_at: now
        });
    } else {
      await knex('pipeline_schemas').insert({
        pipeline_id: pipeline.pipeline_id,
        steps: JSON.stringify(pipeline.steps),
        created_at: now,
        updated_at: now
      });
    }
  }
};

exports.down = async function (knex) {
  // 不回滚，避免引入固定 AI 链路。
};
