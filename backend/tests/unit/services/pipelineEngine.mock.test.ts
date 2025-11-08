// 艹！在import之前Mock SDK（setup.ts已经Mock了winston和tencentcloud）
jest.mock('cos-nodejs-sdk-v5', () => {
  return jest.fn().mockImplementation(() => ({
    putObject: jest.fn(),
    getObject: jest.fn()
  }));
});

import pipelineEngine from '../../../src/services/pipelineEngine.service.js';

// 🟢 已修复：setup.ts Mock了全部SDK，现在可以正常测试
describe('PipelineEngine parseSteps', () => {
  const engine = pipelineEngine as any;

  it('parses JSON schema string into pipeline steps', () => {
    const steps = engine.parseSteps('[{"type":"provider","provider_ref":"mock"}]');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ type: 'provider', provider_ref: 'mock' });
  });

  it('returns empty array when schema is invalid JSON', () => {
    const steps = engine.parseSteps('not-json');
    expect(steps).toEqual([]);
  });
});
