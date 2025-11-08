#!/usr/bin/env node

/**
 * 版本回滚脚本
 * 艹!快速切换前端应用版本!
 *
 * 使用方法:
 * node scripts/rollback-version.js --version=1.2.0
 * node scripts/rollback-version.js --version=1.2.0 --dry-run
 *
 * @author 老王
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(level, message) {
  const prefix = {
    error: `${colors.red}❌ [错误]${colors.reset}`,
    warn: `${colors.yellow}⚠️  [警告]${colors.reset}`,
    info: `${colors.blue}ℹ️  [信息]${colors.reset}`,
    success: `${colors.green}✅ [成功]${colors.reset}`,
    step: `${colors.cyan}▶  [步骤]${colors.reset}`,
  };
  console.log(`${prefix[level]} ${message}`);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    version: '',
    dryRun: false,
    force: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--version=')) {
      options.version = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    }
  }

  return options;
}

/**
 * 检查版本格式
 */
function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

/**
 * 获取当前Git分支
 */
function getCurrentBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return branch;
  } catch (error) {
    return 'unknown';
  }
}

/**
 * 获取当前Commit Hash
 */
function getCurrentCommit() {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    return commit;
  } catch (error) {
    return 'unknown';
  }
}

/**
 * 查找版本对应的Git Tag
 */
function findVersionTag(version) {
  try {
    const tags = execSync('git tag -l', { encoding: 'utf-8' }).trim().split('\n');
    const targetTag = tags.find(tag => tag === `v${version}` || tag === version);
    return targetTag;
  } catch (error) {
    return null;
  }
}

/**
 * 检查Git仓库状态
 */
function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    return status === '';
  } catch (error) {
    return false;
  }
}

/**
 * 备份package.json
 */
function backupPackageJson() {
  const packagePath = path.join(process.cwd(), 'package.json');
  const backupPath = path.join(process.cwd(), 'package.json.backup');

  fs.copyFileSync(packagePath, backupPath);
  log('info', `已备份 package.json → package.json.backup`);
}

/**
 * 执行版本回滚
 */
function rollbackVersion(version, dryRun = false) {
  log('step', `开始回滚到版本: ${version}`);

  const tag = findVersionTag(version);
  if (!tag) {
    throw new Error(`未找到版本 ${version} 对应的Git标签`);
  }

  log('info', `找到版本标签: ${tag}`);

  if (dryRun) {
    log('warn', '模拟模式: 以下操作不会实际执行');
  }

  // 步骤1: 备份当前package.json
  log('step', '步骤1/6: 备份package.json');
  if (!dryRun) {
    backupPackageJson();
  }

  // 步骤2: 切换到目标版本
  log('step', `步骤2/6: 切换到版本 ${tag}`);
  if (!dryRun) {
    execSync(`git checkout ${tag}`, { stdio: 'inherit' });
  }

  // 步骤3: 清理node_modules
  log('step', '步骤3/6: 清理node_modules');
  if (!dryRun) {
    if (fs.existsSync('node_modules')) {
      fs.rmSync('node_modules', { recursive: true, force: true });
    }
  }

  // 步骤4: 安装依赖
  log('step', '步骤4/6: 安装依赖');
  if (!dryRun) {
    execSync('npm ci', { stdio: 'inherit' });
  }

  // 步骤5: 构建
  log('step', '步骤5/6: 构建项目');
  if (!dryRun) {
    execSync('npm run build', { stdio: 'inherit' });
  }

  // 步骤6: 验证
  log('step', '步骤6/6: 验证构建');
  if (!dryRun) {
    if (!fs.existsSync('.next')) {
      throw new Error('构建失败: .next目录不存在');
    }
  }

  log('success', `版本回滚完成: ${version}`);
}

/**
 * 主函数
 */
function main() {
  console.log('='.repeat(60));
  console.log(`${colors.magenta}前端版本回滚脚本${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  const startTime = Date.now();

  try {
    // 解析参数
    const options = parseArgs();

    if (!options.version) {
      log('error', '缺少 --version 参数');
      console.log('\n使用方法:');
      console.log('  node scripts/rollback-version.js --version=1.2.0');
      console.log('  node scripts/rollback-version.js --version=1.2.0 --dry-run');
      console.log('  node scripts/rollback-version.js --version=1.2.0 --force');
      process.exit(1);
    }

    // 验证版本格式
    if (!validateVersion(options.version)) {
      log('error', `版本号格式不正确: ${options.version}`);
      log('info', '正确格式: x.y.z (例如: 1.2.0)');
      process.exit(1);
    }

    // 获取当前信息
    const currentBranch = getCurrentBranch();
    const currentCommit = getCurrentCommit().substring(0, 7);

    log('info', `当前分支: ${currentBranch}`);
    log('info', `当前Commit: ${currentCommit}`);
    log('info', `目标版本: ${options.version}`);
    log('info', `模式: ${options.dryRun ? '模拟模式（不会实际执行）' : '真实模式'}`);
    console.log('');

    // 检查Git状态
    if (!options.force && !checkGitStatus()) {
      log('error', 'Git工作区有未提交的更改');
      log('warn', '请先提交或暂存更改，或使用 --force 参数强制执行');
      process.exit(1);
    }

    // 执行回滚
    rollbackVersion(options.version, options.dryRun);

    const duration = (Date.now() - startTime) / 1000;
    console.log('');
    log('success', `总耗时: ${duration.toFixed(2)}秒`);

    if (options.dryRun) {
      console.log('');
      log('warn', '模拟模式: 未实际执行操作');
      log('info', '如要实际执行，请去掉 --dry-run 参数');
    } else {
      console.log('');
      log('success', '回滚完成！请重启前端服务');
      log('info', '重启命令: pm2 restart frontend');
    }

  } catch (error) {
    console.log('');
    log('error', '回滚失败:');
    console.error(colors.red + error.message + colors.reset);

    if (!options.dryRun) {
      log('warn', '回滚失败，建议执行以下操作:');
      log('info', '1. git checkout main');
      log('info', '2. npm ci');
      log('info', '3. npm run build');
    }

    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(60));
}

// 运行
main();
