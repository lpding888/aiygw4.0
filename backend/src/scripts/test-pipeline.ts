import { db } from '../config/database.js';
import pipelineEngine from '../services/pipelineEngine.service.js';
import logger from '../utils/logger.js';
import { VariableMapper } from '../utils/variableMapper.js';

// 模拟一个测试任务
async function runTest() {
  logger.info('====== 开始 Pipeline 新架构测试 ======');

  try {
    // 1. 准备测试数据：插入一个测试用的 Feature 和 Pipeline
    // 这个 Pipeline 模拟一个简单的 "通用生图" 流程
    const testPipelineId = 'test_pipeline_' + Date.now();
    const testFeatureId = 'test_feature_' + Date.now();

    // 定义一个基于 RunningHub 的工作流步骤
    // 注意：这里的 workflowId 是 RunningHub 真实的 "AI模特" ID (从旧代码里抄来的)
    // 关键点：参数全是动态映射的 {{input.imageUrl}}
    const pipelineSteps = [
      {
        type: 'RUNNINGHUB_WORKFLOW',
        provider_ref: 'runninghub_main', // 对应 Provider 实例
        params: {
          workflowId: '1982694711750213634', // 比如这是 "AI模特" 的 webappId
          nodeInfoList: [
            {
              nodeId: '103', // Prompt 节点
              fieldName: 'text',
              fieldValue: 'A fashion model in street style, full body shot' // 这里写死了，实际可以是 {{input.prompt}}
            },
            {
              nodeId: '74', // Image 节点
              fieldName: 'image',
              fieldValue: '{{input.imageKey}}' // <--- 关键：这里使用了变量映射！
            }
          ]
        }
      }
    ];

    logger.info('1. 正在插入测试配置数据...');

    // 插入 Pipeline Schema
    await db('pipeline_schemas').insert({
      pipeline_id: testPipelineId,
      name: '测试通用工作流',
      steps: JSON.stringify(pipelineSteps),
      created_by: 'system',
      status: 'active'
    });

    // 插入 Feature Definition
    await db('feature_definitions').insert({
      feature_id: testFeatureId,
      feature_key: testFeatureId,
      name: '测试功能',
      display_name: '测试功能',
      category: 'test',
      is_enabled: true,
      pipeline_schema_ref: testPipelineId,
      quota_cost: 0
    });

    logger.info(`   -> Feature ID: ${testFeatureId}`);
    logger.info(`   -> Pipeline ID: ${testPipelineId}`);

    // 2. 模拟创建一个任务
    const taskId = 'task_test_' + Date.now();
    logger.info(`2. 正在创建模拟任务 taskId=${taskId}...`);

    await db('tasks').insert({
      id: taskId,
      user_id: 'system_test',
      feature_id: testFeatureId,
      status: 'pending',
      type: 'pipeline_test',
      created_at: new Date(),
      updated_at: new Date()
    });

    // 3. 准备输入数据
    // 假设用户上传了一张图，key 是 "test-image.jpg"
    const inputData = {
      imageKey: 'test-image.jpg',
      prompt: 'Cool guy'
    };

    logger.info('3. 开始执行引擎 (Dry Run)...');
    logger.info('   -> 输入数据:', inputData);
    logger.info('   -> 预期：VariableMapper 应该把 {{input.imageKey}} 替换为 "test-image.jpg"');

    // 4. 调用引擎
    // 注意：为了不真的扣费和调 API (省钱)，我们这里只验证 "变量映射" 是否成功
    // 我们通过 hack 这里的 VariableMapper 来验证

    const context = { input: inputData, steps: [] };
    const mappedParams = VariableMapper.map(pipelineSteps[0].params, context);

    logger.info('4. 验证变量映射结果:');
    console.log(JSON.stringify(mappedParams, null, 2));

    const resultNodeInfo = (mappedParams as any).nodeInfoList.find((n: any) => n.nodeId === '74');

    if (resultNodeInfo.fieldValue === 'test-image.jpg') {
      logger.info('✅ 测试通过！变量 {{input.imageKey}} 成功被替换成了 "test-image.jpg"');
    } else {
      logger.error('❌ 测试失败！变量没有被正确替换。');
    }

    // 清理测试数据
    await db('tasks').where('id', taskId).del();
    await db('feature_definitions').where('feature_id', testFeatureId).del();
    await db('pipeline_schemas').where('pipeline_id', testPipelineId).del();
    logger.info('5. 测试数据清理完毕');
  } catch (error) {
    logger.error('测试过程发生错误:', error);
  } finally {
    process.exit(0);
  }
}

runTest();
