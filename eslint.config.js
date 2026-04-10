import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/blockchain/lib/**',
      '*.config.js',
      '*.config.ts',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended (type-checked rules disabled for speed)
  ...tseslint.configs.recommended,

  // Vue essential rules
  ...pluginVue.configs['flat/essential'],

  // Vue files: use vue-eslint-parser
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Project-specific rules (aligned with .cursorrules)
  {
    files: ['**/*.{ts,tsx,vue,js}'],
    rules: {
      // Enforce single quotes (from .cursorrules)
      quotes: ['warn', 'single', { avoidEscape: true }],

      // Arrow function params always in parens (from .cursorrules)
      'arrow-parens': ['warn', 'always'],

      // Prefer named exports (from .cursorrules)
      'no-restricted-exports': ['warn', { restrictDefaultExports: { direct: true } }],

      // TypeScript-specific
      '@typescript-eslint/no-explicit-any': 'off', // Too many existing usages
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Vue
      'vue/multi-word-component-names': 'off',

      // General quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  }
)
