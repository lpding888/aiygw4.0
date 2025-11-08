declare module '../utils/generator.js' {
  export function generateId(length?: number): string;
  export function generateSeed(): number;
  export function generateCode(length?: number): string;
  export function generateOrderId(): string;
  export function generateTaskId(): string;

  const generator: {
    generateId: typeof generateId;
    generateSeed: typeof generateSeed;
    generateCode: typeof generateCode;
    generateOrderId: typeof generateOrderId;
    generateTaskId: typeof generateTaskId;
  };

  export default generator;
}

declare module '../utils/generator' {
  export * from '../utils/generator.js';
  export { default } from '../utils/generator.js';
}
