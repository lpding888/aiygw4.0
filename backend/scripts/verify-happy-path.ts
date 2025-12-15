
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Config
const API_BASE = 'http://127.0.0.1:4000/api';
const ADMIN_EMAIL = 'admin@aiygw.com';
const ADMIN_PASSWORD = 'admin123';

async function main() {
    console.log('🚀 Starting API-based Happy Path Verification (Empty Payload)...');

    try {
        // 1. Login
        console.log(`🔑 Logging in as ${ADMIN_EMAIL}...`);
        const loginRes = await fetch(`${API_BASE}/auth/login/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        });

        if (!loginRes.ok) {
            // ... err handling
            throw new Error('Login failed');
        }
        const loginData = await loginRes.json() as any;
        const token = loginData.data?.access_token;
        if (!token) throw new Error('No token');
        console.log('✅ Login Successful.');

        // 2. Define Empty Payload
        const pipeline = {
            nodes: [],
            edges: []
        };

        const input = {};

        // 3. Trigger Test Execution
        console.log('📡 Sending Test Pipeline Request...');
        const testRes = await fetch(`${API_BASE}/admin/pipelines/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ pipeline, input })
        });

        if (!testRes.ok) {
            const text = await testRes.text();
            throw new Error(`Test Request Failed: ${testRes.status} ${testRes.statusText}\n${text}`);
        }

        const testJson = await testRes.json() as any;
        console.log('✅ Test Pipeline Dispatched:', testJson);
        console.log('🎉 Verification Successful (Empty Pipeline accepted)!');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    } finally {
        console.log('👋 Done.');
    }
}

main();
