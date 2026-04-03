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

### Component Tests (`components`)
We test UI components by simulating user interactions and asserting on the rendered output.
- **Mocking `motion`**: We mock the `motion` library to avoid animation-related issues in tests.
- **Mocking Browser APIs**: We mock `navigator.mediaDevices` (Camera), `FileReader`, and `URL.createObjectURL`.
- **Accessibility**: We use `aria-label` and `role` for robust element selection.

### Integration Tests (`App.test.tsx`)
We test the main application flow, including:
- **Authentication**: Simulating login/logout states.
- **Scanning**: Mocking the camera capture and AI parsing flow.
- **History**: Verifying that past sessions are correctly rendered from Firestore.

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
npx vitest run --coverage
```
*(Note: Requires `c8` or `istanbul` coverage provider to be installed)*
