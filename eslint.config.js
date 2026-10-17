// Mechanical checks only; `tsc --noEmit` already covers types. No style rules.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'dev-dist/**', 'node_modules/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    // Narrow `unknown` instead, the way the Session store and Receipt intake do.
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
);
