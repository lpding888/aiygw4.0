import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'src/db/migrations');

const files = fs.readdirSync(migrationsDir);
const jsFiles = files.filter(f => f.endsWith('.js'));

console.log(`找到 ${jsFiles.length} 个 .js 文件`);

let renamed = 0;
jsFiles.forEach(file => {
  const oldPath = path.join(migrationsDir, file);
  const newPath = path.join(migrationsDir, file.replace(/\.js$/, '.cjs'));

  try {
    fs.renameSync(oldPath, newPath);
    renamed++;
  } catch (error) {
    console.error(`重命名失败: ${file}`, error.message);
  }
});

console.log(`✅ 成功重命名 ${renamed} 个文件`);
