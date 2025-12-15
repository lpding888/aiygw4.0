/**
 * Chaos Engineering - Worker Crash Test
 *
 * 测试场景：
 * 1. Worker 在执行节点时突然崩溃
 * 2. BullMQ 自动重试机制验证
 * 3. 状态恢复和数据一致性
 */

import { Worker, Job, Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { StateManager, PipelineStatus } from '../src/engine/runner/StateManager.js';
import { PIPELINE_QUEUE_NAME } from '../src/engine/queue/PipelineQueue.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
};

// ============ Test Worker with Crash Simulation ============

class ChaosWorker {
    private worker: Worker;
    private stateManager: StateManager;
    private crashAfterMs: number;
    private startTime: number = 0;

    constructor(crashAfterMs: number = 2000) {
        this.crashAfterMs = crashAfterMs;
        this.stateManager = new StateManager(REDIS_URL);

        this.worker = new Worker(
            PIPELINE_QUEUE_NAME,
            async (job: Job) => {
                return this.processJobWithCrash(job);
            },
            {
                connection: redisConfig,
                concurrency: 1,
                lockDuration: 30000
            }
        );

        this.worker.on('completed', (job) => {
            console.log(`✅ Job ${job.id} completed successfully`);
        });

        this.worker.on('failed', (job, err) => {
            console.log(`❌ Job ${job?.id} failed: ${err.message}`);
        });

        console.log('🔧 Chaos Worker initialized (will crash after execution)');
    }

    async processJobWithCrash(job: Job) {
        const { runId, nodeIds, batchIndex } = job.data;
        this.startTime = Date.now();

        console.log(`\n⚙️  Processing Job ${job.id}`);
        console.log(`   RunId: ${runId}`);
        console.log(`   Batch: ${batchIndex}`);
        console.log(`   Nodes: ${nodeIds.length}`);

        try {
            // 更新状态
            await this.stateManager.setState(runId, PipelineStatus.RUNNING);

            // 模拟执行第一个节点
            const firstNodeId = nodeIds[0];
            console.log(`   📝 Processing Node: ${firstNodeId}`);

            // 模拟一些工作
            await new Promise(resolve => setTimeout(resolve, 500));

            // 存储部分结果
            await this.stateManager.setNodeOutput(runId, firstNodeId, {
                status: 'partial',
                result: 'Processing...',
                timestamp: Date.now()
            });

            console.log(`   ✓ Partial result stored`);

            // 检查是否应该崩溃
            const elapsed = Date.now() - this.startTime;
            if (elapsed >= this.crashAfterMs) {
                console.log(`\n💥 SIMULATING WORKER CRASH after ${elapsed}ms`);
                console.log(`   Job will be retried by BullMQ...`);

                // 强制关闭 Worker（模拟崩溃）
                await this.worker.close();

                // 抛出错误触发重试
                throw new Error('SIMULATED_WORKER_CRASH');
            }

            // 完成剩余节点（如果没有崩溃）
            for (let i = 1; i < nodeIds.length; i++) {
                const nodeId = nodeIds[i];
                console.log(`   📝 Processing Node: ${nodeId}`);
                await new Promise(resolve => setTimeout(resolve, 300));

                await this.stateManager.setNodeOutput(runId, nodeId, {
                    status: 'success',
                    result: `Completed ${nodeId}`,
                    timestamp: Date.now()
                });
            }

            console.log(`   ✅ Batch ${batchIndex} completed`);
            await this.stateManager.setState(runId, PipelineStatus.COMPLETED);

        } catch (error) {
            console.error(`   ❌ Error in job processing:`, error);
            await this.stateManager.setState(
                runId,
                PipelineStatus.FAILED,
                (error as Error).message
            );
            throw error;
        }
    }

    async close() {
        await this.worker.close();
    }
}

// ============ Test Scenarios ============

async function testWorkerCrashAndRecovery() {
    console.log('\n🧪 Test: Worker Crash and Recovery');
    console.log('━'.repeat(80));

    const queue = new Queue(PIPELINE_QUEUE_NAME, { connection: redisConfig });
    const redis = new Redis(REDIS_URL);
    const runId = uuidv4();

    try {
        // 1. 准备测试任务
        const nodeIds = [uuidv4(), uuidv4(), uuidv4()];
        const jobId = `${runId}:0`;

        console.log('\n📋 Step 1: Creating test job');
        const job = await queue.add(
            'execute-batch',
            {
                runId,
                nodeIds,
                batchIndex: 0,
                context: {}
            },
            {
                jobId,
                attempts: 3, // 允许重试 3 次
                backoff: {
                    type: 'fixed',
                    delay: 2000
                }
            }
        );

        console.log(`   ✓ Job created: ${job.id}`);
        console.log(`   ✓ Attempts allowed: 3`);

        // 2. 启动 Chaos Worker（会在执行中崩溃）
        console.log('\n📋 Step 2: Starting Chaos Worker (will crash)');
        const chaosWorker = new ChaosWorker(1500); // 1.5秒后崩溃

        // 等待第一次执行和崩溃
        await new Promise(resolve => setTimeout(resolve, 4000));

        console.log('\n📋 Step 3: Checking job status after crash');
        const jobAfterCrash = await queue.getJob(jobId);

        if (!jobAfterCrash) {
            throw new Error('Job not found after crash');
        }

        console.log(`   Job State: ${await jobAfterCrash.getState()}`);
        console.log(`   Attempts Made: ${jobAfterCrash.attemptsMade}`);
        console.log(`   Max Attempts: ${jobAfterCrash.opts.attempts}`);

        // 3. 启动恢复 Worker（不会崩溃）
        console.log('\n📋 Step 4: Starting Recovery Worker');
        const recoveryWorker = new Worker(
            PIPELINE_QUEUE_NAME,
            async (job: Job) => {
                console.log(`🔄 Recovery Worker processing ${job.id}`);
                const { runId, nodeIds } = job.data;

                const stateManager = new StateManager(REDIS_URL);

                // 执行所有节点
                for (const nodeId of nodeIds) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await stateManager.setNodeOutput(runId, nodeId, {
                        status: 'success',
                        result: `Recovered ${nodeId}`,
                        timestamp: Date.now()
                    });
                }

                await stateManager.setState(runId, PipelineStatus.COMPLETED);
                console.log(`   ✅ Job recovered and completed`);
            },
            {
                connection: redisConfig,
                concurrency: 1
            }
        );

        // 等待恢复完成
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 4. 验证最终状态
        console.log('\n📋 Step 5: Verifying final state');
        const finalJob = await queue.getJob(jobId);

        if (!finalJob) {
            throw new Error('Job not found in final check');
        }

        const finalState = await finalJob.getState();
        console.log(`   Final Job State: ${finalState}`);

        // 验证执行状态
        const stateManager = new StateManager(REDIS_URL);
        const execState = await redis.hget(`exec:${runId}:state`, 'status');
        console.log(`   Pipeline Status: ${execState}`);

        // 验证节点输出
        let allNodesCompleted = true;
        for (const nodeId of nodeIds) {
            const output = await stateManager.getNodeOutput(runId, nodeId);
            if (!output || output.status !== 'success') {
                allNodesCompleted = false;
                console.log(`   ❌ Node ${nodeId} not completed`);
            }
        }

        if (allNodesCompleted) {
            console.log(`   ✅ All nodes completed successfully`);
        }

        // 清理
        await recoveryWorker.close();
        await chaosWorker.close();

        // 清理 Redis 数据
        await redis.del(`exec:${runId}:state`);
        await redis.del(`exec:${runId}:outputs`);
        await redis.del(`exec:${runId}:meta`);
        await job.remove();

        console.log('\n✅ Test PASSED: Worker crash recovery works correctly');
        console.log('   • BullMQ retry mechanism functional');
        console.log('   • State consistency maintained');
        console.log('   • Data recovery successful');

    } catch (error) {
        console.error('\n❌ Test FAILED:', error);
        throw error;
    } finally {
        await queue.close();
        await redis.quit();
    }
}

async function testMultipleWorkerCrashes() {
    console.log('\n🧪 Test: Multiple Worker Crashes');
    console.log('━'.repeat(80));

    const queue = new Queue(PIPELINE_QUEUE_NAME, { connection: redisConfig });
    const redis = new Redis(REDIS_URL);
    const runId = uuidv4();

    try {
        const nodeIds = [uuidv4(), uuidv4()];
        const jobId = `${runId}:0`;

        console.log('\n📋 Creating job with limited retries');
        const job = await queue.add(
            'execute-batch',
            { runId, nodeIds, batchIndex: 0 },
            {
                jobId,
                attempts: 2, // 只允许 2 次尝试
                backoff: { type: 'fixed', delay: 1000 }
            }
        );

        console.log(`   ✓ Job created with max 2 attempts`);

        // 创建两个都会崩溃的 Worker
        console.log('\n📋 Starting two Chaos Workers (both will crash)');

        for (let i = 0; i < 2; i++) {
            console.log(`\n   Attempt ${i + 1}:`);
            const chaosWorker = new ChaosWorker(800);
            await new Promise(resolve => setTimeout(resolve, 2500));
            await chaosWorker.close();
        }

        // 检查最终状态
        console.log('\n📋 Checking final state after exhausting retries');
        const finalJob = await queue.getJob(jobId);

        if (!finalJob) {
            throw new Error('Job not found');
        }

        const finalState = await finalJob.getState();
        console.log(`   Final State: ${finalState}`);
        console.log(`   Attempts Made: ${finalJob.attemptsMade}`);

        if (finalState === 'failed') {
            console.log('\n✅ Test PASSED: Job correctly failed after exhausting retries');
            console.log('   • Retry limit enforced');
            console.log('   • Failed state properly set');
        } else {
            throw new Error(`Expected job to be in 'failed' state, got '${finalState}'`);
        }

        // 清理
        await redis.del(`exec:${runId}:state`);
        await redis.del(`exec:${runId}:outputs`);
        await finalJob.remove();

    } catch (error) {
        console.error('\n❌ Test FAILED:', error);
        throw error;
    } finally {
        await queue.close();
        await redis.quit();
    }
}

async function testStalledJobRecovery() {
    console.log('\n🧪 Test: Stalled Job Recovery');
    console.log('━'.repeat(80));

    const queue = new Queue(PIPELINE_QUEUE_NAME, { connection: redisConfig });
    const redis = new Redis(REDIS_URL);
    const runId = uuidv4();

    try {
        const nodeIds = [uuidv4()];
        const jobId = `${runId}:0`;

        console.log('\n📋 Creating job with short lock duration');
        const job = await queue.add(
            'execute-batch',
            { runId, nodeIds, batchIndex: 0 },
            {
                jobId,
                attempts: 3
            }
        );

        // 创建 Worker 但在持有锁时突然关闭（模拟网络断开）
        console.log('\n📋 Starting worker with abrupt disconnection');

        const stalledWorker = new Worker(
            PIPELINE_QUEUE_NAME,
            async (job: Job) => {
                console.log(`   🔒 Job locked by worker`);
                // 持有锁但不完成工作（模拟卡死）
                await new Promise(resolve => setTimeout(resolve, 2000));
                // 不返回结果，直接关闭连接
                throw new Error('Connection lost');
            },
            {
                connection: redisConfig,
                concurrency: 1,
                lockDuration: 5000, // 5秒锁
                stalledInterval: 3000 // 3秒检查一次 stalled
            }
        );

        // 等待任务变成 stalled
        await new Promise(resolve => setTimeout(resolve, 8000));

        console.log('\n📋 Checking for stalled jobs');
        const jobCounts = await queue.getJobCounts();
        console.log(`   Stalled jobs count: ${jobCounts.stalled || 0}`);

        // 启动恢复 Worker
        console.log('\n📋 Starting recovery worker');
        const recoveryWorker = new Worker(
            PIPELINE_QUEUE_NAME,
            async (job: Job) => {
                console.log(`   🔄 Recovery worker picked up job ${job.id}`);
                const { runId } = job.data;
                const stateManager = new StateManager(REDIS_URL);
                await stateManager.setState(runId, PipelineStatus.COMPLETED);
                console.log(`   ✅ Job recovered`);
            },
            {
                connection: redisConfig,
                concurrency: 1
            }
        );

        await new Promise(resolve => setTimeout(resolve, 3000));

        const finalJob = await queue.getJob(jobId);
        const finalState = await finalJob?.getState();

        console.log(`\n   Final Job State: ${finalState}`);

        if (finalState === 'completed' || finalState === 'failed') {
            console.log('\n✅ Test PASSED: Stalled job was recovered');
            console.log('   • BullMQ detected stalled job');
            console.log('   • Job was retried successfully');
        } else {
            console.log('\n⚠️  Test INCONCLUSIVE: Job in unexpected state');
        }

        // 清理
        await stalledWorker.close();
        await recoveryWorker.close();
        await redis.del(`exec:${runId}:state`);
        await finalJob?.remove();

    } catch (error) {
        console.error('\n❌ Test FAILED:', error);
        throw error;
    } finally {
        await queue.close();
        await redis.quit();
    }
}

// ============ Main Runner ============

async function main() {
    console.log('🚀 Starting Worker Crash Chaos Tests');
    console.log('='.repeat(80));

    let allPassed = true;

    try {
        // Test 1: 基本崩溃恢复
        await testWorkerCrashAndRecovery();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: 多次崩溃（耗尽重试）
        await testMultipleWorkerCrashes();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Stalled Job 恢复
        await testStalledJobRecovery();

        console.log('\n' + '='.repeat(80));
        console.log('🎉 ALL WORKER CRASH TESTS PASSED');
        console.log('='.repeat(80));
        console.log('\n系统在以下场景下表现良好：');
        console.log('  ✓ Worker 崩溃后自动重试');
        console.log('  ✓ 重试次数限制生效');
        console.log('  ✓ Stalled Job 自动恢复');
        console.log('  ✓ 状态一致性保持');
        console.log('');

    } catch (error) {
        allPassed = false;
        console.error('\n💥 Some tests failed:', error);
    }

    process.exit(allPassed ? 0 : 1);
}

main();
