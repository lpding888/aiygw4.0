declare const buildingAIAdaptorService: {
  callAPI<T = unknown>(action: string, payload: Record<string, unknown>): Promise<T>;
  getSupportedFeatures(): string[];
  getStats(): Record<string, unknown>;
  resetStats(): void;
};

export default buildingAIAdaptorService;
