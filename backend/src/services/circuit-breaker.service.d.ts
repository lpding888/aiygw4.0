declare const circuitBreakerService: {
  getCircuitBreaker: (name: string, config?: any) => any;
  execute: (
    name: string,
    operation: () => Promise<any>,
    fallback?: ((error: any) => Promise<any>) | null,
    config?: any
  ) => Promise<any>;
  getAllCircuitBreakerStates: () => any;
  getCircuitBreakerState: (name: string) => any;
  openCircuitBreaker: (name: string, reason?: string) => boolean;
  closeCircuitBreaker: (name: string) => boolean;
  resetCircuitBreaker: (name: string) => boolean;
  getStats: () => any;
  cleanupInactiveCircuitBreakers: (inactiveThresholdMs: number) => number;
  healthCheck: () => Promise<{ status: string } & Record<string, any>>;
};

export default circuitBreakerService;
