declare const providerRegistryService: {
  initialize: (builtinProviders?: Record<string, unknown>) => Promise<void>;
  getRegisteredProviders: () => any[];
  getAllProviderStates: () => any;
  isProviderRegistered: (name: string) => boolean;
  execute: (providerName: string, methodName: string, args?: any[], options?: any) => Promise<any>;
  healthCheck: () => Promise<{ status: string } & Record<string, any>>;
};

export default providerRegistryService;
