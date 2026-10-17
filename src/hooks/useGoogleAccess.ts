import { useState } from 'react';
import type { GoogleAccess } from '../services/googleAccess';

/**
 * Google access as React state: the token as it was on mount, kept in step as the token is stored,
 * invalidated or cleared. Expiry is checked on mount, like before the module existed.
 */
export const useGoogleAccess = (access: GoogleAccess) => {
  const [token, setToken] = useState(() => access.current());

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

  return { token, store, invalidate, clear };
};
