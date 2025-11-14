#!/usr/bin/env tsx
/**
 * 迁移审计脚本
 * 1. 确保只有 src/db/migrations 目录包含迁移脚本
 * 2. 检测重复的迁移名称（忽略时间戳）
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const canonicalMigrationDir = path.resolve(projectRoot, 'src/db/migrations');

const ignoreDirs = new Set([
  'node_modules',
  '.git',
  'dist',
  '.turbo',
  '.next',
  'logs'
]);

type DuplicateBucket = Record<string, string[]>;

async function walkForStrayMigrations(
  dir: string,
  stray: string[]
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (
      entry.name === 'migrations' &&
      path.resolve(fullPath) !== canonicalMigrationDir
    ) {
      stray.push(fullPath);
      continue;
    }

    await walkForStrayMigrations(fullPath, stray);
  }
}

async function collectDuplicates(): Promise<DuplicateBucket> {
  const duplicates: DuplicateBucket = {};
  const items = await readdir(canonicalMigrationDir, {
    withFileTypes: true
  });

  for (const entry of items) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith('.js') && !name.endsWith('.ts')) continue;
    const normalized = name.replace(/^\d+_/, '');
    if (!duplicates[normalized]) {
      duplicates[normalized] = [];
    }
    duplicates[normalized].push(path.join('src/db/migrations', name));
  }

  return duplicates;
}

async function main(): Promise<void> {
  const strayDirs: string[] = [];
  await walkForStrayMigrations(projectRoot, strayDirs);

  const duplicates = await collectDuplicates();
  const duplicateEntries = Object.entries(duplicates).filter(
    ([, files]) => files.length > 1
  );

  let hasError = false;

  if (strayDirs.length > 0) {
    hasError = true;
    console.error('⚠️ 发现非规范迁移目录:');
    strayDirs
      .sort()
      .forEach((dir) => console.error(`  - ${path.relative(projectRoot, dir)}`));
  }

  if (duplicateEntries.length > 0) {
    hasError = true;
    console.error('\n⚠️ 发现命名重复的迁移文件（去除时间戳后相同）:');
    duplicateEntries.forEach(([suffix, files]) => {
      console.error(`\n  • ${suffix}`);
      files.forEach((file) =>
        console.error(`    - ${path.relative(projectRoot, file)}`)
      );
    });
  }

  if (hasError) {
    console.error(
      '\n请先处理上述问题，再继续运行 knex migrate 或提交代码。'
    );
    process.exitCode = 1;
    return;
  }

  console.log('✅ 迁移目录审计通过，未检测到冗余目录或重复文件。');
}

main().catch((error) => {
  console.error('迁移审计脚本执行失败:', error);
  process.exitCode = 1;
});
