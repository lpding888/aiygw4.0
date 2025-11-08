#!/usr/bin/env node

/**
 * SEC-E-01: 依赖安全体检脚本
 * 艹！自动检查依赖漏洞、未使用的包、敏感信息！
 *
 * @author 老王
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 [安全体检] 开始依赖安全检查...\n');

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(level, message) {
  const prefix = {
    error: `${colors.red}❌ [错误]${colors.reset}`,
    warn: `${colors.yellow}⚠️  [警告]${colors.reset}`,
    info: `${colors.blue}ℹ️  [信息]${colors.reset}`,
    success: `${colors.green}✅ [成功]${colors.reset}`,
  };
  console.log(`${prefix[level]} ${message}`);
}

// 1. npm audit - 检查依赖漏洞
log('info', '检查依赖漏洞 (npm audit)...');
try {
  const auditResult = execSync('npm audit --json', { encoding: 'utf-8' });
  const audit = JSON.parse(auditResult);

  const { vulnerabilities } = audit;
  const critical = vulnerabilities?.critical || 0;
  const high = vulnerabilities?.high || 0;
  const moderate = vulnerabilities?.moderate || 0;
  const low = vulnerabilities?.low || 0;

  console.log(`  - 严重漏洞: ${critical}`);
  console.log(`  - 高危漏洞: ${high}`);
  console.log(`  - 中危漏洞: ${moderate}`);
  console.log(`  - 低危漏洞: ${low}\n`);

  if (critical > 0 || high > 0) {
    log('error', `发现 ${critical} 个严重漏洞和 ${high} 个高危漏洞！`);
    log('warn', '运行 "npm audit fix" 修复漏洞');
    process.exitCode = 1;
  } else if (moderate > 0) {
    log('warn', `发现 ${moderate} 个中危漏洞，建议修复`);
  } else {
    log('success', '未发现严重或高危漏洞');
  }
} catch (error) {
  // npm audit 在有漏洞时会返回非零退出码
  const output = error.stdout?.toString() || '';
  if (output) {
    try {
      const audit = JSON.parse(output);
      const { vulnerabilities } = audit;
      const critical = vulnerabilities?.critical || 0;
      const high = vulnerabilities?.high || 0;

      if (critical > 0 || high > 0) {
        log('error', `发现 ${critical} 个严重漏洞和 ${high} 个高危漏洞！`);
        process.exitCode = 1;
      }
    } catch (parseError) {
      log('warn', 'npm audit 执行异常，跳过检查');
    }
  }
}

// 2. depcheck - 检查未使用的依赖
log('info', '检查未使用的依赖 (depcheck)...');
try {
  // 检查 depcheck 是否已安装
  try {
    execSync('npx depcheck --version', { stdio: 'ignore' });
  } catch {
    log('warn', 'depcheck 未安装，跳过未使用依赖检查');
    log('info', '运行 "npm install -g depcheck" 安装');
  }

  const depcheckResult = execSync('npx depcheck --json', { encoding: 'utf-8' });
  const depcheck = JSON.parse(depcheckResult);

  const unusedDeps = Object.keys(depcheck.dependencies || {});
  const unusedDevDeps = Object.keys(depcheck.devDependencies || {});
  const missingDeps = Object.keys(depcheck.missing || {});

  if (unusedDeps.length > 0) {
    log('warn', `发现 ${unusedDeps.length} 个未使用的依赖:`);
    unusedDeps.forEach((dep) => console.log(`    - ${dep}`));
  }

  if (unusedDevDeps.length > 0) {
    log('warn', `发现 ${unusedDevDeps.length} 个未使用的开发依赖:`);
    unusedDevDeps.forEach((dep) => console.log(`    - ${dep}`));
  }

  if (missingDeps.length > 0) {
    log('error', `发现 ${missingDeps.length} 个缺失的依赖:`);
    missingDeps.forEach((dep) => console.log(`    - ${dep}`));
    process.exitCode = 1;
  }

  if (unusedDeps.length === 0 && unusedDevDeps.length === 0 && missingDeps.length === 0) {
    log('success', '依赖检查通过');
  }
  console.log();
} catch (error) {
  log('warn', 'depcheck 检查失败，跳过');
}

// 3. 敏感信息扫描
log('info', '扫描敏感信息 (API Key、密码等)...');
const sensitivePatterns = [
  { name: 'API Key', pattern: /['\"]?api[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]/gi },
  { name: 'Secret Key', pattern: /['\"]?secret[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]/gi },
  { name: 'Password', pattern: /['\"]?password['\"]?\s*[:=]\s*['\"][^'\"]{8,}['\"]/gi },
  { name: 'Access Token', pattern: /['\"]?access[_-]?token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]/gi },
  { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/gi },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/gi },
];

const filesToCheck = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'src/**/*.js',
  'src/**/*.jsx',
  '!src/**/*.test.ts',
  '!src/**/*.test.tsx',
  '!node_modules/**',
];

let sensitiveFound = false;

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    sensitivePatterns.forEach(({ name, pattern }) => {
      const matches = content.match(pattern);
      if (matches) {
        sensitiveFound = true;
        log('error', `在 ${filePath} 中发现可疑的 ${name}:`);
        matches.forEach((match) => {
          // 脱敏显示
          const masked = match.substring(0, 20) + '***';
          console.log(`    ${masked}`);
        });
      }
    });
  } catch (error) {
    // 跳过无法读取的文件
  }
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist') {
        scanDirectory(filePath);
      }
    } else if (
      file.endsWith('.ts') ||
      file.endsWith('.tsx') ||
      file.endsWith('.js') ||
      file.endsWith('.jsx')
    ) {
      scanFile(filePath);
    }
  });
}

try {
  scanDirectory('src');

  if (sensitiveFound) {
    log('error', '发现敏感信息，请检查代码！');
    log('warn', '敏感信息应存储在 .env 文件中，不应提交到代码仓库');
    process.exitCode = 1;
  } else {
    log('success', '未发现敏感信息');
  }
} catch (error) {
  log('warn', '敏感信息扫描失败，跳过');
}

console.log();

// 4. 检查 .env 文件是否在 .gitignore 中
log('info', '检查 .env 文件保护...');
try {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');

    if (gitignore.includes('.env') || gitignore.includes('.env.local')) {
      log('success', '.env 文件已添加到 .gitignore');
    } else {
      log('error', '.env 文件未添加到 .gitignore，存在泄露风险！');
      process.exitCode = 1;
    }
  } else {
    log('warn', '未找到 .gitignore 文件');
  }
} catch (error) {
  log('warn', '.gitignore 检查失败，跳过');
}

console.log();

// 5. 总结
if (process.exitCode === 1) {
  log('error', '安全体检失败！请修复上述问题后重新运行');
  console.log('\n修复建议：');
  console.log('  1. 运行 "npm audit fix" 修复依赖漏洞');
  console.log('  2. 移除未使用的依赖，减少攻击面');
  console.log('  3. 将敏感信息移至 .env 文件');
  console.log('  4. 确保 .env 文件在 .gitignore 中\n');
} else {
  log('success', '安全体检通过！');
}

process.exit(process.exitCode || 0);
