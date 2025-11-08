export declare function generateId(length?: number): string;
export declare function generateSeed(): number;
export declare function generateCode(length?: number): string;
export declare function generateOrderId(): string;
export declare function generateTaskId(): string;

declare const generator: {
  generateId: typeof generateId;
  generateSeed: typeof generateSeed;
  generateCode: typeof generateCode;
  generateOrderId: typeof generateOrderId;
  generateTaskId: typeof generateTaskId;
};

export default generator;
