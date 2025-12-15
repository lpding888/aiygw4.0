/**
 * 初始化功能定义数据（新版 Feature Catalog）
 */

exports.seed = async function seed(knex) {
  // 1. 清空现有数据（仅删除存在的表）
  // 检查表是否存在再删除
  const hasFeatureDeps = await knex.schema.hasTable('feature_dependencies');
  const hasFeatureVersions = await knex.schema.hasTable('feature_versions');
  const hasFeatureStats = await knex.schema.hasTable('feature_usage_stats');
  const hasFeaturePerms = await knex.schema.hasTable('feature_permissions');
  const hasFeatureConfigs = await knex.schema.hasTable('feature_configurations');

  if (hasFeatureDeps) await knex('feature_dependencies').del();
  if (hasFeatureVersions) await knex('feature_versions').del();
  if (hasFeatureStats) await knex('feature_usage_stats').del();
  if (hasFeaturePerms) await knex('feature_permissions').del();
  if (hasFeatureConfigs) await knex('feature_configurations').del();

  await knex('feature_definitions').del();
  await knex('form_schemas').del();
  await knex('pipeline_schemas').del();

  // 2. 插入 Form Schemas
  await knex('form_schemas').insert([
    {
      schema_id: 'basic_clean_form',
      fields: JSON.stringify([
        {
          field_name: 'inputImage',
          field_type: 'image',
          label: '上传服装图片',
          required: true,
          validation: {
            maxSize: 10485760,
            allowedFormats: ['jpg', 'jpeg', 'png', 'webp']
          },
          mapping: {
            target: 'inputImageUrl',
            transform: 'cosUrl'
          }
        }
      ])
    },
    {
      schema_id: 'model_pose12_form',
      fields: JSON.stringify([
        {
          field_name: 'inputImage',
          field_type: 'image',
          label: '上传服装图片',
          required: true,
          validation: {
            maxSize: 10485760,
            allowedFormats: ['jpg', 'jpeg', 'png', 'webp']
          },
          mapping: {
            target: 'inputImageUrl',
            transform: 'cosUrl'
          }
        },
        {
          field_name: 'modelGender',
          field_type: 'radio',
          label: '模特性别',
          required: true,
          options: [
            { value: 'male', label: '男' },
            { value: 'female', label: '女' }
          ],
          default: 'female',
          mapping: {
            target: 'params.modelGender'
          }
        }
      ])
    }
  ]);

  // 3. 插入 Pipeline Schemas
  await knex('pipeline_schemas').insert([
    {
      pipeline_id: 'basic_clean_pipeline',
      steps: JSON.stringify([
        {
          step_id: 'image_clean',
          step_type: 'sync',
          provider: 'tencent_ci',
          action: 'background_removal',
          timeout: 30000,
          retry: {
            max_attempts: 2,
            delay: 1000
          }
        }
      ])
    },
    {
      pipeline_id: 'model_pose12_pipeline',
      steps: JSON.stringify([
        {
          step_id: 'ai_model_generation',
          step_type: 'async',
          provider: 'runninghub',
          action: 'model_pose_12',
          timeout: 180000,
          retry: {
            max_attempts: 3,
            delay: 5000
          },
          polling: {
            interval: 10000,
            max_duration: 300000
          }
        }
      ])
    }
  ]);

  const now = new Date();

  // 4. 插入 Feature Definitions（包含新字段）
  await knex('feature_definitions').insert([
    {
      feature_id: 'basic_clean',
      feature_key: 'basic_clean',
      display_name: '基础抠图',
      name: '基础抠图',
      category: 'image_processing',
      description: '快速去除图片背景，生成透明底或白底商品图',
      is_enabled: true,
      plan_required: 'free',
      access_scope: 'plan',
      quota_cost: 1,
      rate_limit_policy: 'hourly:30',
      output_type: 'singleImage',
      save_to_asset_library: true,
      form_schema_ref: 'basic_clean_form',
      pipeline_schema_ref: 'basic_clean_pipeline',
      type: 'basic',
      is_active: true,
      is_public: true,
      tags: JSON.stringify(['background_removal', 'starter']),
      metadata: JSON.stringify({
        complexity: 'low',
        avgDurationMs: 8000
      }),
      icon: 'magic',
      version: '1.0.0',
      requirements: JSON.stringify({ membership: 'free' }),
      limits: JSON.stringify({ daily: 30 }),
      pricing: JSON.stringify({ quota_cost: 1 }),
      released_at: now
    },
    {
      feature_id: 'model_pose12',
      feature_key: 'model_pose12',
      display_name: 'AI模特上身',
      name: 'AI模特上身',
      category: 'ai_generation',
      description: '智能生成12张AI模特穿搭效果图，多角度展示',
      is_enabled: true,
      plan_required: 'member',
      access_scope: 'plan',
      quota_cost: 1,
      rate_limit_policy: 'hourly:10',
      output_type: 'multiImage',
      save_to_asset_library: true,
      form_schema_ref: 'model_pose12_form',
      pipeline_schema_ref: 'model_pose12_pipeline',
      type: 'premium',
      is_active: true,
      is_public: true,
      tags: JSON.stringify(['ai_model', 'pose12']),
      metadata: JSON.stringify({
        complexity: 'high',
        avgDurationMs: 45000
      }),
      icon: 'user-switch',
      version: '1.0.0',
      requirements: JSON.stringify({ membership: 'member' }),
      limits: JSON.stringify({ daily: 10 }),
      pricing: JSON.stringify({ quota_cost: 1 }),
      released_at: now
    }
  ]);

  const [basicFeature] = await knex('feature_definitions')
    .where('feature_key', 'basic_clean')
    .select('id');
  const [modelFeature] = await knex('feature_definitions')
    .where('feature_key', 'model_pose12')
    .select('id');

  if (!basicFeature || !modelFeature) {
    throw new Error('Feature definitions insert failed');
  }

  // 5. 配置项 (仅当表存在时)
  if (hasFeatureConfigs) {
    await knex('feature_configurations').insert([
      {
        feature_id: basicFeature.id,
        config_key: 'output_background',
        config_value: 'white',
        data_type: 'string',
        description: '输出背景颜色',
        is_required: true,
        default_value: 'white',
        sort_order: 1
      },
      {
        feature_id: basicFeature.id,
        config_key: 'enhance_edges',
        config_value: 'true',
        data_type: 'boolean',
        description: '是否开启边缘优化',
        is_required: false,
        default_value: 'true',
        sort_order: 2
      },
      {
        feature_id: modelFeature.id,
        config_key: 'pose_count',
        config_value: '12',
        data_type: 'number',
        description: '生成姿势数量',
        is_required: true,
        default_value: '12',
        sort_order: 1
      },
      {
        feature_id: modelFeature.id,
        config_key: 'model_gender',
        config_value: 'female',
        data_type: 'string',
        description: '默认模特性别',
        is_required: true,
        default_value: 'female',
        enum_values: JSON.stringify([
          { label: '女', value: 'female' },
          { label: '男', value: 'male' }
        ]),
        sort_order: 2
      }
    ]);
  }

  // 6. 权限设置 (仅当表存在时)
  if (hasFeaturePerms) {
    await knex('feature_permissions').insert([
      {
        feature_id: basicFeature.id,
        permission_type: 'membership',
        permission_value: 'free',
        access_level: 'read',
        is_granted: true
      },
      {
        feature_id: modelFeature.id,
        permission_type: 'membership',
        permission_value: 'member',
        access_level: 'read',
        is_granted: true
      }
    ]);
  }

  // 7. 版本信息 (仅当表存在时)
  if (hasFeatureVersions) {
    await knex('feature_versions').insert([
      {
        feature_id: basicFeature.id,
        version: '1.0.0',
        release_type: 'major',
        changelog: '初始版本',
        config_changes: JSON.stringify({}),
        is_current: true,
        is_stable: true,
        released_at: now,
        released_by: 'system'
      },
      {
        feature_id: modelFeature.id,
        version: '1.0.0',
        release_type: 'major',
        changelog: '初始版本',
        config_changes: JSON.stringify({}),
        is_current: true,
        is_stable: true,
        released_at: now,
        released_by: 'system'
      }
    ]);
  }

  // 8. 功能依赖 (仅当表存在时)
  if (hasFeatureDeps) {
    await knex('feature_dependencies').insert([
      {
        feature_id: modelFeature.id,
        depends_on_feature_id: basicFeature.id,
        dependency_type: 'suggested',
        description: '建议先完成基础抠图以获得更好的模特效果',
        is_active: true
      }
    ]);
  }

  console.log('✓ 功能目录（含配置/权限）数据初始化完成！');
};
