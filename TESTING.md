# 🧪 Testing Guide

This guide explains the testing strategy and how to run tests for the Receipt Manager project.

## 🛠 Testing Framework

We use **Vitest** for unit and integration testing, and **React Testing Library** for component testing.

### Key Tools
- **Vitest**: Fast, Vite-native test runner.
- **React Testing Library**: Testing UI components by simulating user behavior.
- **jsdom**: Browser environment simulation for Node.js.
- **@testing-library/jest-dom**: Custom matchers for DOM assertions.

## 📋 Running Tests

### All Tests
Run all tests in the project:
```bash
npm test
```

### Specific File
Run tests for a specific file:
```bash
npx vitest run src/services/configService.test.ts
```

### Watch Mode
Keep tests running and re-run on changes:
```bash
npx vitest
```

## 🏗 Testing Strategy

### Unit Tests (`services`, `utils`)
We test pure functions and business logic in isolation.
- **Mocks**: We mock external APIs (Firebase, Google APIs) to ensure tests are fast and deterministic.
- **Coverage**: We aim for 100% coverage on all service functions and utility helpers.

### Recorded Gemini responses
Receipt intake tests run over every real Gemini response saved in `src/services/__fixtures__/gemini/`. To add one (needs `GEMINI_API_KEY` in `.env`):
```bash
npm run capture:gemini -- path/to/receipt.jpg hebrew-supermarket
```
Check the JSON before committing: it contains real receipt data.

### Component Tests (`components`)
We test UI components by simulating user interactions and asserting on the rendered output.
- **Mocking `motion`**: We mock the `motion` library to avoid animation-related issues in tests.
- **Mocking Browser APIs**: We mock `navigator.mediaDevices` (Camera), `FileReader`, and `URL.createObjectURL`.
- **Accessibility**: We use `aria-label` and `role` for robust element selection.

### App Flow Tests (`App.test.tsx`)
These render the whole app and drive it the way a user does. Firebase, Gemini and `syncToCloud` are mocked at the top of the file, and the mocked Firebase auth signs the user in. `test/appFlow.ts` holds the steps:
- `signInWithDrive()` gives App a fresh Google access token, so saves sync instead of skipping sync.
- `uploadReceipt()` picks a receipt in the upload input, which parses it and opens ParsingReview.
- `confirmReview()` confirms ParsingReview, which opens SessionView and auto-saves.

Write one when a bug or feature spans App's wiring: a module's own tests can't see how App calls it.

## 📝 Writing New Tests

1.  **Create a `.test.tsx` or `.test.ts` file** next to the file you're testing.
2.  **Mock external dependencies** using `vi.mock`.
3.  **Use `describe` and `it` blocks** to organize your tests.
4.  **Use `render` and `screen`** from `@testing-library/react` for component tests.
5.  **Use `expect`** for assertions.

### Example Component Test
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './ui/Base';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click Me</Button>);
    fireEvent.click(screen.getByText('Click Me'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

## 📊 Coverage Reports

You can generate a coverage report to see which parts of the codebase are tested:
```bash
npm run test:coverage
```
CI runs this on every PR and fails if coverage of `src/services` or `src/utils` drops below the floors in `vite.config.ts` (`test.coverage.thresholds`). The floors start at current coverage; raise them when you add tests.
