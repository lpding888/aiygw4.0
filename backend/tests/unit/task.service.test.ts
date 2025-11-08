// 艹！必须在import之前Mock外部SDK（setup.ts已经Mock了winston）
jest.mock('tencentcloud-sdk-nodejs', () => ({
  default: {},
  scf: {
    v20180416: {
      Client: jest.fn().mockImplementation(() => ({
        Invoke: jest.fn().mockResolvedValue({
          Result: { RetMsg: JSON.stringify({ success: true }) }
        })
      }))
    }
  },
  ims: {
    v20201229: {
      Client: jest.fn().mockImplementation(() => ({
        ImageModeration: jest.fn().mockResolvedValue({ Suggestion: 'Pass' })
      }))
    },
    v20200307: {
      Client: jest.fn().mockImplementation(() => ({
        ImageModeration: jest.fn().mockResolvedValue({ Suggestion: 'Pass' })
      }))
    }
  }
}));

jest.mock('cos-nodejs-sdk-v5', () => {
  return jest.fn().mockImplementation(() => ({
    putObject: jest.fn(),
    getObject: jest.fn()
  }));
});

import taskService from '../../src/services/task.service.js';

// 🟢 已修复：在测试文件内Mock SDK，setup.ts Mock了winston
describe('TaskService helpers', () => {
  it('returns quota cost for known task types', () => {
    expect((taskService as any).getQuotaCost('basic_clean')).toBeGreaterThan(0);
  });

  it('falls back to default quota cost when task type unknown', () => {
    const cost = (taskService as any).getQuotaCost('unknown_type');
    expect(cost).toBe(1);
  });

  it('maps task type labels with fallback', () => {
    const label = (taskService as any).getTaskTypeLabel('video_generate');
    expect(label).toContain('视频');

    const fallback = (taskService as any).getTaskTypeLabel('custom');
    expect(fallback).toBe('custom');
  });
});
