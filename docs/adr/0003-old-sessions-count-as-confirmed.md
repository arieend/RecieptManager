# Old Sessions count as confirmed; Unconfirmed rates never reach the Purchases sheet

Sessions now record whether the user has confirmed their rate to ILS. Sessions saved before that have no such record, and many USD/EUR ones hold a rate of 1, which Receipt intake stored when Gemini returned no rate. We read them as confirmed and keep Money's rule for them alone: a missing, 0 or exactly-1 rate gets the Fallback rate. We don't migrate Firestore and we don't ask the user to confirm receipts that are already filed. Their rows are already in the Purchases sheet at the Fallback rate, and ADR-0001 means we never correct those rows. Asking for a rate now would make the app's totals disagree with the sheet it already wrote. New Sessions don't follow the "exactly 1 means missing" rule: they record an unknown rate as unknown.

Receipt filing never writes Purchases sheet rows for a Session whose rate is unconfirmed. That Session is saved and uploaded to Drive, but its rows wait until the rate is confirmed. The alternative was to file it now and correct it later. That fails because every save appends a Session's rows again and existing rows are never rewritten, so a corrected rate would sit next to the wrong rows instead of replacing them.

## Consequences

- A single upload is confirmed in ParsingReview before it is filed, so auto-save is unchanged.
- In a batch upload, a USD/EUR receipt is saved with an Unconfirmed rate and is not on the sheet until the user confirms it in SessionView and saves. History marks it, and the end-of-batch toast says how many are waiting.
- The "exactly 1 means missing" rule can't be removed while old Sessions exist.
