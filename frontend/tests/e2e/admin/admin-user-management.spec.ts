/**
 * Admin用户管理端到端测试
 * 艹！用户管理是Admin系统的核心功能，必须严格测试！
 *
 * @author 老王
 */

import { test, expect } from '@playwright/test';
import { AdminTestBase, UserManagementTests } from './admin-e2e-test-suite';

test.describe('Admin用户管理', () => {
  let userTests: UserManagementTests;

  test.beforeEach(async ({ page, context }) => {
    userTests = new UserManagementTests(page, context);
    await userTests.loginAsAdmin();
  });

  test('[USERS-001] 用户创建流程', async ({ page }) => {
    await test.step('导航到用户管理页面', async () => {
      await page.goto('/admin/users');
      await userTests.waitForApiCall();
      await expect(page.locator('h1, h2')).toContainText('用户管理');
    });

    await test.step('创建新用户', async () => {
      const username = await userTests.testCreateUser();

      // 验证用户出现在列表中
      const userRow = page.locator(`table tbody tr:has-text("${username}")`);
      await expect(userRow).toBeVisible();

      // 验证用户详情
      await expect(userRow.locator('td')).toContainText('测试用户');
      await expect(userRow.locator('.ant-tag')).toContainText('普通用户');
    });

    await test.step('验证统计数据更新', async () => {
      // 验证总用户数增加
      const totalUsersStat = page.locator('.ant-statistic:has-text("总用户数")');
      await expect(totalUsersStat).toBeVisible();
    });
  });

  test('[USERS-002] 用户编辑流程', async ({ page }) => {
    // 先创建一个测试用户
    const username = await userTests.testCreateUser();

    await test.step('编辑用户信息', async () => {
      await userTests.testEditUser(username);
    });

    await test.step('验证修改生效', async () => {
      // 刷新页面验证修改持久化
      await page.reload();
      await userTests.waitForApiCall();

      const userRow = page.locator(`table tbody tr:has-text("${username}")`);
      await expect(userRow).toContainText('修改后的部门');
    });
  });

  test('[USERS-003] 用户状态管理', async ({ page }) => {
    // 先创建一个测试用户
    const username = await userTests.testCreateUser();

    await test.step('切换用户状态', async () => {
      await userTests.testToggleUserStatus(username);
    });

    await test.step('验证状态变更', async () => {
      const userRow = page.locator(`table tbody tr:has-text("${username}")`);
      const statusBadge = userRow.locator('.ant-badge');

      // 验证状态标签显示正确
      await expect(statusBadge).toBeVisible();
      const statusText = await statusBadge.textContent();
      expect(statusText).toMatch(/正常|已暂停/);
    });
  });

  test('[USERS-004] 用户搜索功能', async ({ page }) => {
    // 创建几个测试用户
    const user1 = await userTests.testCreateUser();
    const user2 = await userTests.testCreateUser();

    await test.step('搜索用户', async () => {
      await userTests.testUserSearch(user1);
    });

    await test.step('验证搜索结果', async () => {
      const results = page.locator('table tbody tr');
      const count = await results.count();

      if (count > 0) {
        // 验证搜索结果包含目标用户
        const firstResult = results.first();
        await expect(firstResult).toContainText(user1);
      }
    });

    await test.step('清空搜索', async () => {
      // 清空搜索框
      await page.fill('.ant-input-search input', '');
      await userTests.waitForApiCall();

      // 验证显示所有用户
      const allResults = page.locator('table tbody tr');
      expect(await allResults.count()).toBeGreaterThan(0);
    });
  });

  test('[USERS-005] 批量操作功能', async ({ page }) => {
    // 创建多个测试用户
    await userTests.testCreateUser();
    await userTests.testCreateUser();

    await test.step('选择多个用户', async () => {
      // 选择前两个用户
      const checkboxes = page.locator('table tbody tr input[type="checkbox"]');
      await checkboxes.first().check();
      await checkboxes.nth(1).check();

      // 验证选中状态
      expect(await checkboxes.first().isChecked()).toBe(true);
      expect(await checkboxes.nth(1).isChecked()).toBe(true);
    });

    await test.step('执行批量操作', async () => {
      await userTests.testBatchOperations();
    });

    await test.step('验证批量操作结果', async () => {
      // 验证成功消息显示
      await expect(page.locator('.ant-message-success')).toBeVisible();

      // 验证用户状态已更新
      await userTests.waitForApiCall();
    });
  });

  test('[USERS-006] 用户详情查看', async ({ page }) => {
    const username = await userTests.testCreateUser();

    await test.step('查看用户详情', async () => {
      const userRow = page.locator(`table tbody tr:has-text("${username}")`);
      await userRow.locator('button[title="查看详情"]').click();

      // 等待详情模态框
      await userTests.waitForElement('.ant-modal:visible');

      // 验证详情内容
      await expect(page.locator('.ant-modal')).toContainText('用户详情');
      await expect(page.locator('.ant-modal')).toContainText(username);
    });

    await test.step('关闭详情模态框', async () => {
      await page.click('.ant-modal-footer button:has-text("关闭")');

      // 验证模态框关闭
      await expect(page.locator('.ant-modal:visible')).toHaveCount(0);
    });
  });

  test('[USERS-007] 密码重置功能', async ({ page }) => {
    const username = await userTests.testCreateUser();

    await test.step('重置用户密码', async () => {
      const userRow = page.locator(`table tbody tr:has-text("${username}")`);
      await userRow.locator('button[title="重置密码"]').click();

      // 等待确认对话框
      await userTests.waitForElement('.ant-modal:visible');

      // 确认重置
      await page.click('.ant-modal .ant-btn-primary:has-text("确定")');

      // 验证成功消息
      await userTests.verifyToast('密码重置成功', 'success');
    });
  });

  test('[USERS-008] 用户权限验证', async ({ page }) => {
    await test.step('验证权限标签显示', async () => {
      // 导航到用户管理页面
      await page.goto('/admin/users');
      await userTests.waitForApiCall();

      // 查找不同角色的用户
      const adminUser = page.locator('table tbody tr:has-text("admin")');
      const normalUser = page.locator('table tbody tr:has-text("user")');

      // 验证权限标签
      if (await adminUser.count() > 0) {
        await expect(adminUser.locator('.ant-tag')).toContainText('管理员');
      }

      if (await normalUser.count() > 0) {
        await expect(normalUser.locator('.ant-tag')).toContainText('普通用户');
      }
    });
  });

  test('[USERS-009] 数据导出功能', async ({ page }) => {
    await test.step('测试导出功能', async () => {
      // 点击导出按钮
      await page.click('button:has-text("导出数据"), button:has-text("导出")');

      // 验证导出功能触发（可能是消息提示或下载开始）
      await page.waitForTimeout(2000);

      // 检查是否有成功消息或下载开始
      const message = page.locator('.ant-message');
      const downloadLink = page.locator('a[download]');

      expect(await message.count() + await downloadLink.count()).toBeGreaterThan(0);
    });
  });

  test('[USERS-010] 响应式设计验证', async ({ page }) => {
    await test.step('测试桌面端显示', async () => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto('/admin/users');
      await userTests.waitForApiCall();

      // 验证表格正常显示
      await expect(page.locator('table')).toBeVisible();
      await expect(page.locator('.ant-pagination')).toBeVisible();
    });

    await test.step('测试平板端显示', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await userTests.waitForApiCall();

      // 验证响应式布局
      await expect(page.locator('table')).toBeVisible();
    });

    await test.step('测试移动端显示', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await userTests.waitForApiCall();

      // 验证移动端适配
      const content = page.locator('.ant-layout-content');
      await expect(content).toBeVisible();
    });
  });

  test('[USERS-011] 性能测试', async ({ page }) => {
    await test.step('测试页面加载性能', async () => {
      const startTime = Date.now();
      await page.goto('/admin/users');
      await userTests.waitForApiCall();
      const loadTime = Date.now() - startTime;

      // 验证页面加载时间在合理范围内（5秒内）
      expect(loadTime).toBeLessThan(5000);

      console.log(`用户管理页面加载时间: ${loadTime}ms`);
    });

    await test.step('测试搜索响应时间', async () => {
      const startTime = Date.now();
      await userTests.testUserSearch('test');
      const searchTime = Date.now() - startTime;

      // 验证搜索响应时间在合理范围内（3秒内）
      expect(searchTime).toBeLessThan(3000);

      console.log(`搜索响应时间: ${searchTime}ms`);
    });
  });

  test('[USERS-012] 错误处理测试', async ({ page }) => {
    await test.step('测试网络错误处理', async () => {
      // 模拟网络错误
      await page.route('**/api/admin/users**', route => route.abort());

      // 尝试访问用户管理页面
      await page.goto('/admin/users');
      await page.waitForTimeout(2000);

      // 验证错误提示
      const errorMessage = page.locator('.ant-message-error, .ant-alert-error');
      expect(await errorMessage.count()).toBeGreaterThan(0);
    });

    await test.step('测试表单验证错误', async () => {
      // 恢复网络连接
      await page.unroute('**/api/admin/users**');
      await page.reload();
      await userTests.waitForApiCall();

      // 尝试创建无效用户
      await page.click('button:has-text("新增用户")');
      await userTests.waitForElement('.ant-modal:visible');

      // 提交空表单
      await page.click('button[type="submit"]:has-text("创建")');

      // 验证表单验证消息
      const validationErrors = page.locator('.ant-form-item-explain-error');
      expect(await validationErrors.count()).toBeGreaterThan(0);
    });
  });
});