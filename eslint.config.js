// Mechanical checks only; `tsc --noEmit` already covers types. No style rules.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // .claude/ holds agent worktrees: other branches' code, not this checkout's.
  { ignores: ['dist/**', 'coverage/**', 'dev-dist/**', 'node_modules/**', '.claude/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    // Narrow `unknown` instead, the way the Session store and Receipt intake do.
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
);
