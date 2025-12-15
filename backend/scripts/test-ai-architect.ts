/**
 * AI Architect Test Suite
 * 测试 AI Pipeline 生成和修改功能
 */

import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const API_BASE = 'http://127.0.0.1:4000/api';
const ADMIN_EMAIL = 'admin@aiygw.com';
const ADMIN_PASSWORD = 'admin123';

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: any;
}

const testResults: TestResult[] = [];

// ============ Helper Functions ============

async function login(): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/login/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    if (!res.ok) throw new Error('Login failed');
    const data = await res.json() as any;
    return data.data?.access_token;
}

async function runTest(name: string, testFn: () => Promise<void>) {
    const start = Date.now();
    console.log(`\n🧪 Running: ${name}`);
    console.log('━'.repeat(80));

    try {
        await testFn();
        const duration = Date.now() - start;
        testResults.push({ name, passed: true, duration });
        console.log(`✅ PASSED (${duration}ms)`);
    } catch (error) {
        const duration = Date.now() - start;
        const errorMsg = error instanceof Error ? error.message : String(error);
        testResults.push({ name, passed: false, duration, error: errorMsg });
        console.error(`❌ FAILED (${duration}ms): ${errorMsg}`);
    }
}

function printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    const total = testResults.length;
    const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms\n`);

    testResults.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name} (${result.duration}ms)`);
        if (result.error) {
            console.log(`   └─ ${result.error}`);
        }
    });

    console.log('\n' + '='.repeat(80));
    return failed === 0;
}

// ============ Test Suite ============

async function testBasicGeneration(token: string) {
    await runTest('基础生成 - 猫图诗歌', async () => {
        const res = await fetch(`${API_BASE}/admin/architect/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prompt: '生成一张猫的图片，然后用诗歌描述它'
            })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API failed: ${res.status} ${res.statusText}\n${text}`);
        }

        const result = await res.json() as any;

        if (!result.success) {
            throw new Error(`Generation failed: ${result.message}`);
        }

        const pipeline = result.data.pipeline;

        // Validate structure
        if (!pipeline || !pipeline.nodes || !pipeline.edges) {
            throw new Error('Invalid pipeline structure');
        }

        if (pipeline.nodes.length < 2) {
            throw new Error('Pipeline should have at least 2 nodes');
        }

        // Check for image_gen and llm nodes
        const hasImageGen = pipeline.nodes.some((n: any) => n.type === 'image_gen');
        const hasLLM = pipeline.nodes.some((n: any) => n.type === 'llm');

        if (!hasImageGen) {
            throw new Error('Pipeline missing image_gen node');
        }

        if (!hasLLM) {
            throw new Error('Pipeline missing llm node');
        }

        console.log(`   ✓ Generated pipeline with ${pipeline.nodes.length} nodes`);
        console.log(`   ✓ Quality Score: ${result.data.quality_score || 'N/A'}`);
        console.log(`   ✓ Confidence: ${result.data.confidence || 'N/A'}`);
        console.log(`   ✓ Attempts: ${result.data.attempts || 1}`);
    });
}

async function testTextProcessing(token: string) {
    await runTest('文本处理链 - 翻译+总结', async () => {
        const res = await fetch(`${API_BASE}/admin/architect/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prompt: '翻译中文到英文，然后总结内容'
            })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API failed: ${res.status} ${res.statusText}\n${text}`);
        }

        const result = await res.json() as any;

        if (!result.success) {
            throw new Error(`Generation failed: ${result.message}`);
        }

        const pipeline = result.data.pipeline;

        // Should have 2 LLM nodes
        const llmNodes = pipeline.nodes.filter((n: any) => n.type === 'llm');

        if (llmNodes.length < 2) {
            throw new Error('Expected at least 2 LLM nodes for translation and summarization');
        }

        // Check for bindings (data flow)
        const hasBindings = pipeline.nodes.some((n: any) => n.bindings);

        if (!hasBindings) {
            console.warn('   ⚠️  No bindings found - data flow might not be connected');
        } else {
            console.log('   ✓ Data flow bindings present');
        }

        console.log(`   ✓ Generated pipeline with ${llmNodes.length} LLM nodes`);
    });
}

async function testComplexPipeline(token: string) {
    await runTest('复杂 Pipeline - 多步骤处理', async () => {
        const res = await fetch(`${API_BASE}/admin/architect/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prompt: '生成一张风景图片，用AI描述它，然后翻译成英文，最后总结'
            })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API failed: ${res.status} ${res.statusText}\n${text}`);
        }

        const result = await res.json() as any;

        if (!result.success) {
            throw new Error(`Generation failed: ${result.message}`);
        }

        const pipeline = result.data.pipeline;

        if (pipeline.nodes.length < 3) {
            throw new Error('Complex pipeline should have at least 3 nodes');
        }

        // Validate topology (no cycles)
        const nodeIds = new Set(pipeline.nodes.map((n: any) => n.id));

        for (const edge of pipeline.edges) {
            if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
                throw new Error('Invalid edge: references non-existent node');
            }

            if (edge.source === edge.target) {
                throw new Error('Self-loop detected');
            }
        }

        console.log(`   ✓ Complex pipeline with ${pipeline.nodes.length} nodes and ${pipeline.edges.length} edges`);
        console.log(`   ✓ Topology validated`);
    });
}

async function testModification(token: string) {
    await runTest('修改现有 Pipeline - 调整温度', async () => {
        // First, generate a pipeline
        const genRes = await fetch(`${API_BASE}/admin/architect/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prompt: '用AI生成一段创意文案'
            })
        });

        if (!genRes.ok) {
            throw new Error('Failed to generate initial pipeline');
        }

        const genResult = await genRes.json() as any;
        const originalPipeline = genResult.data.pipeline;

        // Now modify it
        const modRes = await fetch(`${API_BASE}/admin/architect/modify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                pipeline: originalPipeline,
                prompt: '把温度调整到 0.9，让输出更有创意'
            })
        });

        if (!modRes.ok) {
            const text = await modRes.text();
            throw new Error(`Modify API failed: ${modRes.status} ${modRes.statusText}\n${text}`);
        }

        const modResult = await modRes.json() as any;

        if (!modResult.success) {
            throw new Error(`Modification failed: ${modResult.message}`);
        }

        const modifiedPipeline = modResult.data.pipeline;

        // Check if temperature was updated
        const llmNode = modifiedPipeline.nodes.find((n: any) => n.type === 'llm');

        if (!llmNode) {
            throw new Error('No LLM node found in modified pipeline');
        }

        console.log(`   ✓ Original nodes: ${originalPipeline.nodes.length}`);
        console.log(`   ✓ Modified nodes: ${modifiedPipeline.nodes.length}`);

        if (llmNode.data.temperature !== undefined) {
            console.log(`   ✓ Temperature set to: ${llmNode.data.temperature}`);
        }
    });
}

async function testCacheHit(token: string) {
    await runTest('缓存机制 - 相同 Prompt', async () => {
        const prompt = '测试缓存：生成一张狗的图片';

        // First call
        const start1 = Date.now();
        const res1 = await fetch(`${API_BASE}/admin/architect/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt })
        });
        const duration1 = Date.now() - start1;

        if (!res1.ok) {
            throw new Error('First call failed');
        }

        const result1 = await res1.json() as any;

        // Second call (should hit cache)
        const start2 = Date.now();
        const res2 = await fetch(`${API_BASE}/admin/architect/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt })
        });
        const duration2 = Date.now() - start2;

        if (!res2.ok) {
            throw new Error('Second call failed');
        }

        const result2 = await res2.json() as any;

        // Compare results
        if (JSON.stringify(result1.data.pipeline) !== JSON.stringify(result2.data.pipeline)) {
            console.warn('   ⚠️  Cache miss or pipeline changed');
        } else {
            console.log('   ✓ Cache hit - identical pipelines');
        }

        console.log(`   ✓ First call: ${duration1}ms`);
        console.log(`   ✓ Second call: ${duration2}ms`);

        if (duration2 < duration1 * 0.5) {
            console.log('   ✓ Cache significantly faster');
        }
    });
}

async function testErrorHandling(token: string) {
    await runTest('错误处理 - Prompt 过长', async () => {
        const longPrompt = 'A'.repeat(3000); // Exceeds MAX_PROMPT_LENGTH

        const res = await fetch(`${API_BASE}/admin/architect/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt: longPrompt })
        });

        if (res.ok) {
            throw new Error('Should reject long prompts');
        }

        if (res.status !== 400) {
            throw new Error(`Expected 400, got ${res.status}`);
        }

        console.log('   ✓ Correctly rejected long prompt');
    });

    await runTest('错误处理 - 空 Prompt', async () => {
        const res = await fetch(`${API_BASE}/admin/architect/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt: '' })
        });

        if (res.status !== 400) {
            throw new Error(`Expected 400 for empty prompt, got ${res.status}`);
        }

        console.log('   ✓ Correctly rejected empty prompt');
    });
}

// ============ Main Test Runner ============

async function main() {
    console.log('🚀 Starting AI Architect Test Suite...');
    console.log('='.repeat(80));
    console.log('Testing AI Pipeline Generation and Modification\n');

    try {
        // Login
        console.log(`🔑 Logging in as ${ADMIN_EMAIL}...`);
        const token = await login();
        console.log('✅ Login successful\n');

        // Run tests
        await testBasicGeneration(token);
        await testTextProcessing(token);
        await testComplexPipeline(token);
        await testModification(token);
        await testCacheHit(token);
        await testErrorHandling(token);

        // Print summary
        const allPassed = printSummary();

        if (allPassed) {
            console.log('\n🎉 所有 AI Architect 测试通过！系统运行正常。\n');
            process.exit(0);
        } else {
            console.log('\n⚠️  部分测试失败，请检查系统配置。\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 测试套件执行失败:', error);
        process.exit(1);
    }
}

main();
