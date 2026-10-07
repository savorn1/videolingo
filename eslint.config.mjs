// Lint rules on top of Nuxt's recommended set (generated into .nuxt/eslint.config.mjs by @nuxt/eslint).
// Formatting is Prettier's job, so the style-only rules are off.
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['shared/api.generated.d.ts', 'test-results/**', 'playwright-report/**']
  },
  {
    rules: {
      // Style, left to Prettier and to the codebase's own habits.
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/use-v-on-exact': 'off',
      // The generic form and CRUD code (DynamicForm, fields/*, useCrudModals) works on untyped records.
      '@typescript-eslint/no-explicit-any': 'off',
      // Records used as maps are trimmed with delete.
      '@typescript-eslint/no-dynamic-delete': 'off',
      // Editor panels get a composable's state object as a prop and change its fields on purpose
      // (e.g. `edit.state.clips`); replacing a prop itself is still caught.
      'vue/no-mutating-props': ['error', { shallowOnly: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  },
  {
    // Plain JavaScript: the TypeScript version of the rule misreads it.
    files: ['**/*.mjs'],
    rules: { '@typescript-eslint/no-unused-vars': 'off', 'no-unused-vars': 'error' }
  }
)
