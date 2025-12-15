import 'dotenv/config';
import mysql from 'mysql2/promise';
import path from 'path';
import dotenv from 'dotenv';

// Explicitly load .env from backend root
dotenv.config({ path: 'backend/.env' });

const fixDeepSeek = async () => {
  console.log('Fixing DeepSeek provider type (Direct MySQL Connection)...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ai_photo'
  });

  try {
    // 1. Update DeepSeek
    const [result] = await connection.execute(
      "UPDATE provider_endpoints SET type = 'openai', description = 'DeepSeek (OpenAI Compatible)', updated_at = NOW() WHERE provider_ref = 'llm_deepseek'"
    );
    // @ts-ignore
    console.log('DeepSeek updated:', result.info);

    // 2. Update RunningHub
    const [result2] = await connection.execute(
      "UPDATE provider_endpoints SET type = 'runninghub', updated_at = NOW() WHERE provider_ref = 'img_runninghub'"
    );
    // @ts-ignore
    console.log('RunningHub updated:', result2.info);
  } catch (error) {
    console.error('Error updating providers:', error);
  } finally {
    await connection.end();
  }
};

fixDeepSeek();
