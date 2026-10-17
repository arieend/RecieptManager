/** The keys predate this module; keeping them keeps already signed-in users connected. */
const TOKEN_KEY = 'drive_token';
const TIMESTAMP_KEY = 'drive_token_timestamp';

/**
 * Google tokens last an hour; we drop them after 55 minutes to be safe. Firebase doesn't expose
 * the token's real `expires_in`, so the lifetime is counted from when the token was stored.
 */
const LIFETIME_MS = 55 * 60 * 1000;

export interface GoogleAccessDeps {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  now: () => number;
}

/**
 * Holds the user's Google OAuth access token for Drive and Sheets: storage, expiry and invalidation.
 * It doesn't sign the user in: sign-in popups must start from a click, so the login flow hands it the token.
 */
export const createGoogleAccess = ({ storage, now }: GoogleAccessDeps) => {
  const clear = () => {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(TIMESTAMP_KEY);
  };

  const store = (token: string) => {
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(TIMESTAMP_KEY, String(now()));
  };

  /** The token, or null when there is none, it has no timestamp, or it has expired (which also clears it). */
  const current = (): string | null => {
    const token = storage.getItem(TOKEN_KEY);
    const storedAt = parseInt(storage.getItem(TIMESTAMP_KEY) ?? '', 10);
    if (!token || Number.isNaN(storedAt)) return null;
    if (now() - storedAt >= LIFETIME_MS) {
      clear();
      return null;
    }
    return token;
  };

  /** Google rejected the token; the user has to sign in again. */
  const invalidate = clear;

  return { store, current, invalidate, clear };
};

export type GoogleAccess = ReturnType<typeof createGoogleAccess>;
