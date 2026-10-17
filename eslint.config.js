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
  {
    // Money owns the rate rule (a USD or EUR rate of 0 or 1 counts as none); code elsewhere that computes
    // with a stored rate shows a different ILS amount for the same Session.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/utils/money.ts', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', {
        // `session.exchangeRate` or a destructured `exchangeRate` used in arithmetic, a fallback or JSX.
        selector: ":matches(BinaryExpression, LogicalExpression, JSXExpressionContainer) > :matches(MemberExpression[object.type='Identifier'][property.name='exchangeRate'], Identifier[name='exchangeRate'])",
        message: 'Get the rate from rateToIls, or the amount from toIls, sessionTotal or itemAmount, in src/utils/money.ts.',
      }, {
        // rateToIls may be the Fallback rate, which is never stored or confirmed for a new Session (ADR-0002).
        selector: [
          "Property[key.name='exchangeRate'] > CallExpression[callee.name='rateToIls']",
          "AssignmentExpression[left.property.name='exchangeRate'] > CallExpression[callee.name='rateToIls']",
          "CallExpression[callee.name=/^(set|update|confirm)\\w*Rate$/] > CallExpression[callee.name='rateToIls']",
        ].join(', '),
        message: 'A stored rate comes from the Rate lookup or the user. rateToIls may return the Fallback rate (ADR-0002); store session.exchangeRate or what the user typed.',
      }],
    },
  },
);
