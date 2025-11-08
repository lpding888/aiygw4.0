// 🟢 已修复：在测试文件内Mock database，独立于setup.ts
const mockDb = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../src/config/database.js', () => {
  const knexMock: any = (...args: any[]) => mockDb(...args);
  knexMock.transaction = (...args: any[]) => mockTransaction(...args);
  return { db: knexMock };
});

import quotaService from '../../src/services/quota.service.js';

// 🟢 现在可以正常测试，database Mock独立配置
describe('QuotaService', () => {
  beforeEach(() => {
    mockDb.mockReset();
    mockTransaction.mockReset();
  });

  it('getQuota returns normalized info from database', async () => {
    const first = jest.fn().mockResolvedValue({
      quota_remaining: 5,
      isMember: true,
      quota_expireAt: null
    });
    const builder = {
      where: jest.fn().mockReturnThis(),
      first
    };
    mockDb.mockReturnValue(builder);

    const result = await quotaService.getQuota('user-100');

    expect(result).toEqual({ remaining: 5, isMember: true, expireAt: null });
    // 艹！quota.service用的是.where('id', userId)，不是.where({ id: userId })
    expect(builder.where).toHaveBeenCalledWith('id', 'user-100');
  });

  it('getTransactionStatus returns null when transaction not found', async () => {
    const first = jest.fn().mockResolvedValue(null);
    const builder = { where: jest.fn().mockReturnThis(), first };
    mockDb.mockReturnValue(builder);

    const status = await quotaService.getTransactionStatus('task-missing');

    expect(status).toBeNull();
  });
});
