import 'dotenv/config';
import mysql from 'mysql2/promise';

// Explicitly load .env from backend root
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const inspectTable = async () => {
  console.log('--- Inspecting provider_endpoints ---');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ai_photo',
  });

  try {
    const [rows] = await connection.execute('DESCRIBE provider_endpoints');
    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
};

inspectTable();
