const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'src/db/migrations');

fs.readdir(migrationsDir, (err, files) => {
  if (err) {
    console.error('读取目录失败:', err);
    process.exit(1);
  }

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
});
