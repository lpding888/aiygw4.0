
import { aiGateway } from '../services/ai-gateway.service.js';
import { db } from '../config/database.js';
import systemConfigService from '../services/systemConfig.service.js';

async function main() {
    console.log('=== Verifying Embedding Configuration ===');
    try {
        // 1. Set dummy config to verify protocol logic
        console.log('Setting temporary config...');
        await systemConfigService.set('AI_EMBEDDING_PROTOCOL', 'openai');
        await systemConfigService.set('AI_EMBEDDING_BASE_URL', 'https://api.openai.com/v1');
        await systemConfigService.set('AI_EMBEDDING_API_KEY', 'sk-test-dummy-key');
        await systemConfigService.set('AI_EMBEDDING_MODEL', 'text-embedding-3-small');

        // 2. Call embedding
        console.log('Calling aiGateway.embedDocuments(["Hello world"])...');

        try {
            const vectors = await aiGateway.embedDocuments(['Hello world']);
            console.log('Vectors received:', vectors.length);
        } catch (apiErr: any) {
            console.log('API Call Result:', apiErr.message);
            if (apiErr.message.includes('401') || apiErr.message.includes('status code 401')) {
                console.log('✅ SUCCESS: Connection attempted to OpenAI and correctly rejected (401 Unauthorized). Logic is working.');
            } else {
                console.log('⚠️ Warning: Unexpected error:', apiErr);
            }
        }

    } catch (err: any) {
        console.error('❌ Script Error:', err);
    } finally {
        console.log('Cleaning up...');
        await db.destroy();
    }
}

main();
