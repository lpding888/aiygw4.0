// 艹！在import之前Mock SDK（setup.ts已经Mock了winston和tencentcloud）
jest.mock('cos-nodejs-sdk-v5', () => {
  return jest.fn().mockImplementation(() => ({
    putObject: jest.fn(),
    getObject: jest.fn()
  }));
});

import pipelineEngine from '../../../src/services/pipelineEngine.service.js';

// 🟢 已修复：setup.ts Mock了全部SDK，现在可以正常测试
describe('PipelineEngine timing helpers', () => {
  const engine = pipelineEngine as any;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sleep resolves after specified milliseconds', async () => {
    const sleepPromise = engine.sleep(1000);
    jest.advanceTimersByTime(1000);
    await expect(sleepPromise).resolves.toBeUndefined();
  });

  it('timeout rejects with custom message', async () => {
    const promise = engine.timeout(500, 'boom');
    jest.advanceTimersByTime(500);
    await expect(promise).rejects.toThrow('boom');
  });
});
