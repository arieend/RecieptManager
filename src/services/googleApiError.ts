/** A failed Drive or Sheets API call, with the HTTP status so a 401 (an expired Google access token) can be told apart. */
export class GoogleApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
  }
}
