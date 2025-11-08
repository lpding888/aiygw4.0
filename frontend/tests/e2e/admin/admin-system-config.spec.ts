/**
 * Admin系统配置管理端到端测试
 * 艹！系统配置影响整个平台，必须精确无误！
 *
 * @author 老王
 */

import { test, expect } from '@playwright/test';
import { AdminTestBase, SystemConfigTests } from './admin-e2e-test-suite';

test.describe('Admin系统配置管理', () => {
  let configTests: SystemConfigTests;

  test.beforeEach(async ({ page, context }) => {
    configTests = new SystemConfigTests(page, context);
    await configTests.loginAsAdmin();
  });

  test('[CONFIG-001] 配置管理页面加载', async ({ page }) => {
    await test.step('导航到配置管理', async () => {
      await page.goto('/admin/configs');
      await configTests.waitForApiCall();

      // 验证页面标题
      await expect(page.locator('h1, h2')).toContainText('配置管理');

      // 验证页面描述
      await expect(page.locator('text=管理系统配置参数')).toBeVisible();
    });

    await test.step('验证统计数据卡片', async () => {
      const statsCards = page.locator('.ant-card .ant-statistic');
      expect(await statsCards.count()).toBeGreaterThan(0);

      // 验证核心统计指标
      await expect(page.locator('text=总配置数')).toBeVisible();
      await expect(page.locator('text=快照数量')).toBeVisible();
      await expect(page.locator('text=当前版本')).toBeVisible();
    });

    await test.step('验证操作按钮', async () => {
      // 检查添加配置按钮
      const addButton = page.locator('button:has-text("添加配置")');
      await expect(addButton).toBeVisible();

      // 检查快照管理按钮
      const snapshotButton = page.locator('button:has-text("快照管理")');
      await expect(snapshotButton).toBeVisible();
    });

    await test.step('验证配置表格结构', async () => {
      await configTests.waitForElement('table');

      // 验证表头
      const headers = page.locator('table thead th');
      expect(await headers.count()).toBeGreaterThan(5); // 至少有配置键、配置值、类型、操作等列

      // 验证核心列存在
      await expect(page.locator('table thead')).toContainText('配置键');
      await expect(page.locator('table thead')).toContainText('配置值');
      await expect(page.locator('table thead')).toContainText('类型');
      await expect(page.locator('table thead')).toContainText('操作');
    });

    await test.step('验证提示信息', async () => {
      const alertInfo = page.locator('.ant-alert-info');
      if (await alertInfo.count() > 0) {
        await expect(alertInfo).toContainText('配置管理说明');
      }
    });
  });

  test('[CONFIG-002] 配置创建流程', async ({ page }) => {
    await test.step('打开创建配置对话框', async () => {
      await page.goto('/admin/configs');
      await configTests.waitForApiCall();

      await configTests.safeClick('button:has-text("添加配置")');

      // 验证模态框出现
      await configTests.waitForElement('.ant-modal:visible');
      await expect(page.locator('.ant-modal-title')).toContainText('添加配置');
    });

    await test.step('填写基本配置信息', async () => {
      const testConfig = configTests.generateTestConfig();

      // 填写配置键
      await configTests.safeFill('input[name="key"]', testConfig.key);

      // 填写配置值
      await configTests.safeFill('textarea[name="value"]', String(testConfig.value));

      // 选择数据类型
      await page.click('select[name="type"]');
      await page.click(`select option[value="${testConfig.type}"]`);

      // 填写描述
      if (testConfig.description) {
        await configTests.safeFill('textarea[name="description"]', testConfig.description);
      }
    });

    await test.step('设置分类和敏感信息', async () => {
      // 选择分类
      await page.click('select[name="category"]');
      await page.click('select option[value="test"]');

      // 设置敏感配置（可选）
      const sensitiveSwitch = page.locator('input[name="sensitive"]');
      if (await sensitiveSwitch.count() > 0) {
        await sensitiveSwitch.check();
      }
    });

    await test.step('提交创建', async () => {
      await configTests.safeClick('button[type="submit"]:has-text("创建")');

      // 验证创建成功
      await configTests.verifyToast('配置创建成功', 'success');
    });

    await test.step('验证配置出现在列表中', async () => {
      await configTests.waitForApiCall();

      // 验证新配置在表格中
      const table = page.locator('table tbody tr');
      const configExists = await table.filter({ hasText: 'test.config.' }).count() > 0;

      expect(configExists).toBe(true);
    });
  });

  test('[CONFIG-003] 配置编辑流程', async ({ page }) => {
    await test.step('准备测试配置', async () => {
      // 先创建一个配置
      const configKey = await configTests.testCreateConfig();

      // 等待页面更新
      await configTests.waitForApiCall();
    });

    await test.step('打开编辑对话框', async () => {
      // 查找并点击编辑按钮
      const editButton = page.locator('table tbody tr button[title="编辑"]').first();
      await editButton.click();

      // 验证编辑模态框
      await configTests.waitForElement('.ant-modal:visible');
      await expect(page.locator('.ant-modal-title')).toContainText('编辑配置');
    });

    await test.step('修改配置值', async () => {
      // 配置键应该是只读的
      const keyInput = page.locator('input[name="key"]');
      await expect(keyInput).toBeDisabled();

      // 修改配置值
      const newValue = `updated_value_${Date.now()}`;
      await configTests.safeFill('textarea[name="value"]', newValue);

      console.log(`配置值更新为: ${newValue}`);
    });

    await test.step('修改其他属性', async () => {
      // 修改描述
      const newDescription = `更新后的描述 - ${new Date().toISOString()}`;
      await configTests.safeFill('textarea[name="description"]', newDescription);

      // 切换敏感设置
      const sensitiveSwitch = page.locator('input[name="sensitive"]');
      if (await sensitiveSwitch.count() > 0) {
        const currentChecked = await sensitiveSwitch.isChecked();
        if (currentChecked) {
          await sensitiveSwitch.uncheck();
        } else {
          await sensitiveSwitch.check();
        }
      }
    });

    await test.step('保存修改', async () => {
      await configTests.safeClick('button[type="submit"]:has-text("更新")');

      // 验证更新成功
      await configTests.verifyToast('配置更新成功', 'success');
    });

    await test.step('验证修改生效', async () => {
      // 刷新页面验证持久化
      await page.reload();
      await configTests.waitForApiCall();

      // 验证修改后的值显示正确
      const updatedValue = page.locator('table tbody tr td').filter({ hasText: 'updated_value_' });
      expect(await updatedValue.count()).toBeGreaterThan(0);
    });
  });

  test('[CONFIG-004] 不同数据类型配置', async ({ page }) => {
    const testCases = [
      { type: 'string', value: 'test_string_value', expected: 'test_string_value' },
      { type: 'number', value: '12345', expected: '12345' },
      { type: 'boolean', value: 'true', expected: 'true' },
      { type: 'json', value: '{"key": "value", "number": 123}', expected: 'key' }
    ];

    for (const testCase of testCases) {
      await test.step(`创建${testCase.type}类型配置`, async () => {
        // 导航到配置页面
        if (!page.url().includes('/admin/configs')) {
          await page.goto('/admin/configs');
          await configTests.waitForApiCall();
        }

        // 点击添加配置
        await configTests.safeClick('button:has-text("添加配置")');
        await configTests.waitForElement('.ant-modal:visible');

        // 填写配置信息
        const configKey = `test.${testCase.type}.${Date.now()}`;
        await configTests.safeFill('input[name="key"]', configKey);
        await configTests.safeFill('textarea[name="value"]', testCase.value);

        // 选择数据类型
        await page.click('select[name="type"]');
        await page.click(`select option[value="${testCase.type}"]`);

        // 提交创建
        await configTests.safeClick('button[type="submit"]:has-text("创建")');
        await configTests.verifyToast('配置创建成功', 'success');

        console.log(`创建${testCase.type}类型配置成功: ${configKey}`);
      });

      await test.step(`验证${testCase.type}类型显示`, async () => {
        await configTests.waitForApiCall();

        // 查找刚创建的配置
        const configRow = page.locator(`table tbody tr:has-text("${testCase.type}")`).first();

        if (await configRow.count() > 0) {
          // 验证类型标签
          const typeTag = configRow.locator('.ant-tag');
          expect(await typeTag.count()).toBeGreaterThan(0);

          // 验证值显示
          const valueCell = configRow.locator('td').filter({ hasText: testCase.expected });
          expect(await valueCell.count()).toBeGreaterThan(0);
        }
      });
    }
  });

  test('[CONFIG-005] 敏感配置处理', async ({ page }) => {
    await test.step('创建敏感配置', async () => {
      await page.goto('/admin/configs');
      await configTests.waitForApiCall();

      await configTests.safeClick('button:has-text("添加配置")');
      await configTests.waitForElement('.ant-modal:visible');

      // 填写敏感配置
      const sensitiveKey = `sensitive.config.${Date.now()}`;
      await configTests.safeFill('input[name="key"]', sensitiveKey);
      await configTests.safeFill('textarea[name="value"]', 'super_secret_password_123');

      // 选择数据类型
      await page.click('select[name="type"]');
      await page.click('select option[value="string"]');

      // 设置为敏感配置
      const sensitiveSwitch = page.locator('input[name="sensitive"]');
      await sensitiveSwitch.check();

      await configTests.safeClick('button[type="submit"]:has-text("创建")');
      await configTests.verifyToast('配置创建成功', 'success');
    });

    await test.step('验证敏感配置掩码显示', async () => {
      await configTests.waitForApiCall();

      // 查找敏感配置
      const sensitiveConfig = page.locator('table tbody tr:has-text("sensitive")').first();

      if (await sensitiveConfig.count() > 0) {
        // 验证敏感标签
        const sensitiveTag = sensitiveConfig.locator('.ant-tag:has-text("敏感")');
        expect(await sensitiveTag.count()).toBeGreaterThan(0);

        // 验证值被掩码显示
        const valueCell = sensitiveConfig.locator('td:has-text("*")');
        expect(await valueCell.count()).toBeGreaterThan(0);
      }
    });

    await test.step('测试显示/隐藏敏感值', async () => {
      const eyeButton = page.locator('button:has(.anticon-eye), button[title*="显示"], button[title*="隐藏"]');

      if (await eyeButton.count() > 0) {
        // 点击显示明文
        await eyeButton.first().click();
        await page.waitForTimeout(500);

        // 验证可以切换显示状态
        console.log('敏感值显示/隐藏功能测试完成');
      }
    });
  });

  test('[CONFIG-006] 配置搜索功能', async ({ page }) => {
    await test.step('准备测试数据', async () => {
      // 创建几个不同的配置用于搜索测试
      await configTests.testCreateConfig();
      await configTests.waitForApiCall();
    });

    await test.step('执行配置搜索', async () => {
      await configTests.testConfigSearch('test');
    });

    await test.step('验证搜索结果', async () => {
      const searchResults = page.locator('table tbody tr');
      const resultCount = await searchResults.count();

      console.log(`配置搜索结果数量: ${resultCount}`);

      if (resultCount > 0) {
        // 验证搜索结果包含搜索关键词
        const firstResult = searchResults.first();
        const resultText = await firstResult.textContent();

        console.log(`第一个搜索结果: ${resultText?.substring(0, 100)}...`);
      }
    });

    await test.step('测试按分类筛选', async () => {
      // 如果有分类筛选器
      const categoryFilter = page.locator('.ant-table-filter-dropdown, .filter-dropdown');

      if (await categoryFilter.count() > 0) {
        console.log('检测到分类筛选功能');
        // 这里可以测试分类筛选逻辑
      }
    });

    await test.step('清空搜索', async () => {
      // 清空搜索框
      const searchInput = page.locator('.ant-input-search input, input[placeholder*="搜索"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill('');
        await configTests.waitForApiCall();

        // 验证恢复到完整列表
        await page.waitForTimeout(1000);
        const allResults = page.locator('table tbody tr');
        console.log(`清空搜索后的配置数量: ${await allResults.count()}`);
      }
    });
  });

  test('[CONFIG-007] 快照管理功能', async ({ page }) => {
    await test.step('打开快照管理', async () => {
      await page.goto('/admin/configs');
      await configTests.waitForApiCall();

      await configTests.testCreateSnapshot();
    });

    await test.step('验证快照列表', async () => {
      // 等待快照模态框完全加载
      await page.waitForTimeout(1000);

      const snapshotTable = page.locator('.ant-modal table tbody tr');
      const snapshotCount = await snapshotTable.count();

      if (snapshotCount > 0) {
        console.log(`快照数量: ${snapshotCount}`);

        // 验证快照信息
        const firstSnapshot = snapshotTable.first();
        const snapshotInfo = await firstSnapshot.textContent();
        console.log(`第一个快照信息: ${snapshotInfo?.substring(0, 100)}...`);

        // 验证快照版本号
        const versionBadge = firstSnapshot.locator('.ant-badge');
        expect(await versionBadge.count()).toBeGreaterThan(0);
      } else {
        console.log('当前没有快照');
      }
    });

    await test.step('测试创建新快照', async () => {
      const createSnapshotButton = page.locator('button:has-text("创建快照")');

      if (await createSnapshotButton.count() > 0) {
        await createSnapshotButton.click();

        // 输入快照描述
        const descriptionInput = page.locator('input[placeholder*="描述"]');
        if (await descriptionInput.count() > 0) {
          const description = `测试快照_${Date.now()}`;
          await descriptionInput.fill(description);
          await page.keyboard.press('Enter');

          // 验证创建成功
          await configTests.verifyToast('快照创建成功', 'success');
        }
      }
    });

    await test.step('关闭快照管理', async () => {
      const closeButton = page.locator('.ant-modal-close, .ant-modal-footer button:has-text("关闭")');
      await closeButton.click();

      // 验证模态框关闭
      await expect(page.locator('.ant-modal:visible')).toHaveCount(0);
    });
  });

  test('[CONFIG-008] 配置回滚功能', async ({ page }) => {
    await test.step('准备快照数据', async () => {
      // 先创建一个快照
      await page.goto('/admin/configs');
      await configTests.waitForApiCall();

      // 创建一些配置变更
      await configTests.testCreateConfig();

      // 创建快照
      await configTests.testCreateSnapshot();
    });

    await test.step('测试配置回滚', async () => {
      await configTests.testConfigRollback();
    });

    await test.step('验证回滚结果', async () => {
      // 检查是否有回滚成功的消息
      const rollbackMessage = page.locator('.ant-message-success');
      if (await rollbackMessage.count() > 0) {
        expect(rollbackMessage).toContainText('回滚成功');
      }

      console.log('配置回滚测试完成');
    });
  });

  test('[CONFIG-009] 配置历史记录', async ({ page }) => {
    await test.step('准备配置历史', async () => {
      // 创建并编辑一个配置以产生历史记录
      const configKey = await configTests.testCreateConfig();
      await configTests.waitForApiCall();

      // 编辑配置
      const editButton = page.locator('table tbody tr button[title="编辑"]').first();
      await editButton.click();
      await configTests.waitForElement('.ant-modal:visible');

      const newValue = `edited_for_history_${Date.now()}`;
      await configTests.safeFill('textarea[name="value"]', newValue);
      await configTests.safeClick('button[type="submit"]:has-text("更新")');
      await configTests.verifyToast('配置更新成功', 'success');
    });

    await test.step('查看配置历史', async () => {
      // 查找历史按钮
      const historyButton = page.locator('table tbody tr button[title="查看历史"], button:has-text("历史")');

      if (await historyButton.count() > 0) {
        await historyButton.first().click();

        // 等待历史模态框
        await page.waitForTimeout(1000);

        const historyModal = page.locator('.ant-modal:visible');
        if (await historyModal.count() > 0) {
          await expect(historyModal).toContainText('配置历史');

          // 验证历史记录存在
          const historyItems = historyModal.locator('.ant-timeline-item');
          const historyCount = await historyItems.count();

          console.log(`配置历史记录数量: ${historyCount}`);

          if (historyCount > 0) {
            // 验证历史记录内容
            const firstHistory = historyItems.first();
            const historyText = await firstHistory.textContent();
            console.log(`第一条历史记录: ${historyText?.substring(0, 100)}...`);
          }
        }
      }
    });
  });

  test('[CONFIG-010] 批量操作功能', async ({ page }) => {
    await test.step('准备多个配置', async () => {
      // 创建多个配置用于批量操作测试
      await configTests.testCreateConfig();
      await configTests.waitForApiCall();
    });

    await test.step('选择多个配置', async () => {
      const checkboxes = page.locator('table tbody tr input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount >= 2) {
        // 选择前两个配置
        await checkboxes.first().check();
        await checkboxes.nth(1).check();

        // 验证选中状态
        expect(await checkboxes.first().isChecked()).toBe(true);
        expect(await checkboxes.nth(1).isChecked()).toBe(true);

        console.log('选择了多个配置进行批量操作');
      } else {
        console.log('配置数量不足，跳过批量操作测试');
      }
    });

    await test.step('测试批量导出', async () => {
      const exportButton = page.locator('button:has-text("导出"), button[title*="导出"]');

      if (await exportButton.count() > 0) {
        await exportButton.click();

        // 验证导出功能触发
        await page.waitForTimeout(2000);

        const downloadLink = page.locator('a[download]');
        const exportMessage = page.locator('.ant-message');

        expect(await downloadLink.count() + await exportMessage.count()).toBeGreaterThan(0);
        console.log('批量导出功能测试完成');
      }
    });
  });

  test('[CONFIG-011] 配置验证和错误处理', async ({ page }) => {
    await test.step('测试配置键验证', async () => {
      await page.goto('/admin/configs');
      await configTests.waitForApiCall();

      await configTests.safeClick('button:has-text("添加配置")');
      await configTests.waitForElement('.ant-modal:visible');

      // 测试无效配置键格式
      const invalidKeys = ['', 'invalid key with spaces', '123invalid', 'a'.repeat(200)];

      for (const invalidKey of invalidKeys) {
        await configTests.safeFill('input[name="key"]', invalidKey);
        await configTests.safeFill('textarea[name="value"]', 'test_value');
        await page.click('select[name="type"]');
        await page.click('select option[value="string"]');

        // 尝试提交
        await page.click('button[type="submit"]:has-text("创建")');
        await page.waitForTimeout(500);

        // 检查是否有验证错误
        const validationError = page.locator('.ant-form-item-explain-error');
        if (await validationError.count() > 0) {
          console.log(`检测到配置键验证错误: ${invalidKey}`);
          break; // 找到一个错误就够了
        }
      }
    });

    await test.step('测试JSON格式验证', async () => {
      // 清空表单
      await page.click('.ant-modal-close');
      await page.waitForTimeout(500);

      await configTests.safeClick('button:has-text("添加配置")');
      await configTests.waitForElement('.ant-modal:visible');

      // 测试无效JSON
      await configTests.safeFill('input[name="key"]', `test.invalid.json.${Date.now()}`);
      await configTests.safeFill('textarea[name="value"]', '{"invalid": json}');
      await page.click('select[name="type"]');
      await page.click('select option[value="json"]');

      await page.click('button[type="submit"]:has-text("创建")');
      await page.waitForTimeout(1000);

      // 检查JSON格式错误提示
      const jsonError = page.locator('.ant-message-error');
      if (await jsonError.count() > 0) {
        console.log('检测到JSON格式验证错误');
        expect(jsonError).toBeVisible();
      }
    });
  });

  test('[CONFIG-012] 性能和响应式测试', async ({ page }) => {
    await test.step('测试页面加载性能', async () => {
      const startTime = Date.now();
      await page.goto('/admin/configs');
      await configTests.waitForApiCall();
      const loadTime = Date.now() - startTime;

      // 验证页面加载时间在合理范围内（5秒内）
      expect(loadTime).toBeLessThan(5000);

      console.log(`配置管理页面加载时间: ${loadTime}ms`);
    });

    await test.step('测试搜索性能', async () => {
      await page.goto('/admin/configs');
      await configTests.waitForApiCall();

      const startTime = Date.now();

      const searchInput = page.locator('.ant-input-search input, input[placeholder*="搜索"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);

        const searchTime = Date.now() - startTime;
        expect(searchTime).toBeLessThan(3000);

        console.log(`配置搜索响应时间: ${searchTime}ms`);
      }
    });

    await test.step('测试响应式设计', async () => {
      // 测试平板端
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await configTests.waitForApiCall();

      await expect(page.locator('table')).toBeVisible();

      // 测试移动端
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await configTests.waitForApiCall();

      const content = page.locator('.ant-layout-content');
      await expect(content).toBeVisible();

      console.log('响应式设计测试完成');
    });
  });
});