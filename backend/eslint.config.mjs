import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.js', '**/*.d.ts']
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...tseslint.configs.strict.rules,

      // ========== 类型安全规则 ==========
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true
      }],

      // ========== 命名规范规则 ==========
      '@typescript-eslint/naming-convention': [
        'warn',
        // 变量使用camelCase
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        // 函数使用camelCase
        { selector: 'function', format: ['camelCase'] },
        // 类使用PascalCase
        { selector: 'class', format: ['PascalCase'] },
        // 接口使用PascalCase
        { selector: 'interface', format: ['PascalCase'] },
        // 类型别名使用PascalCase
        { selector: 'typeAlias', format: ['PascalCase'] },
        // 枚举使用PascalCase
        { selector: 'enum', format: ['PascalCase'] },
        // 枚举成员使用UPPER_CASE
        { selector: 'enumMember', format: ['UPPER_CASE'] },
        // 私有成员可以有下划线前缀
        { selector: 'memberLike', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'allow' }
      ],

      // ========== 代码质量规则 ==========
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',

      // ========== Prettier集成 ==========
      'prettier/prettier': 'warn'
    }
  },
  eslintPluginPrettierRecommended
];

