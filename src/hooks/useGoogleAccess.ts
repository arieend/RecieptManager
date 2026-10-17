import { useState } from 'react';
import type { GoogleAccess } from '../services/googleAccess';

/**
 * Google access as React state. `token` drives what the UI shows (connected or not); code that
 * calls Google uses `current()`, which asks the module, so a token that expired while the app was
 * open isn't used and `token` follows to null.
 */
export const useGoogleAccess = (access: GoogleAccess) => {
  const [token, setToken] = useState(() => access.current());

  const current = () => {
    const next = access.current();
    setToken(next);
    return next;
  };

  const store = (next: string) => {
    access.store(next);
    setToken(next);
  };

  const invalidate = () => {
    access.invalidate();
    setToken(null);
  };

  const clear = () => {
    access.clear();
    setToken(null);
  };

  return { token, current, store, invalidate, clear };
};
