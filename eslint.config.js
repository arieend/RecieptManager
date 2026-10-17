// Mechanical checks only; `tsc --noEmit` already covers types. No style rules.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'dev-dist/**', 'node_modules/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
  {
    // Services hold the domain seams (Session store, Receipt intake, Receipt filing); narrow `unknown` instead.
    files: ['src/services/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
);
