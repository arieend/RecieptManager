import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  const ThrowError = ({ message }: { message: string }) => {
    throw new Error(message);
  };

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test Child</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('renders error message when a child throws', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <ThrowError message="Test Error" />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Application Error')).toBeInTheDocument();
    expect(screen.getByText('Test Error')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('renders parsed firestore error message', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const firestoreError = JSON.stringify({
      operationType: 'get',
      path: 'sessions',
      error: 'Permission Denied'
    });
    
    render(
      <ErrorBoundary>
        <ThrowError message={firestoreError} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/Firestore Error: get on sessions failed. Permission Denied/i)).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('reloads the application when reload button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadMock = vi.fn();
    
    vi.stubGlobal('location', { reload: reloadMock });
    
    render(
      <ErrorBoundary>
        <ThrowError message="Test Error" />
      </ErrorBoundary>
    );
    
    const reloadBtn = screen.getByRole('button', { name: /Reload Application/i });
    fireEvent.click(reloadBtn);
    
    expect(reloadMock).toHaveBeenCalled();
    
    vi.unstubAllGlobals();
    consoleSpy.mockRestore();
  });
});
