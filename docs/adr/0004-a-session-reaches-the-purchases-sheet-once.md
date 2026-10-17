# A Session reaches the Purchases sheet once

Receipt filing used to append a Session's rows every time it ran with Sheets sync on, so saving the same Session twice (auto-save after ParsingReview, then Save in SessionView) left two copies of every row. Now a Session's rows are appended once. A Session counts as on the Purchases sheet when its `spreadsheetLink` is non-empty: every successful append sets it, and nothing else does. Receipt filing never asks sync to write Sheets rows for such a Session, while Drive is unchanged: an image not on Drive yet is still uploaded. A Session not yet on the sheet (its Sheets write failed, it was filed while Sheets sync was off, or its rate was Unconfirmed) still gets its rows on a later save. A Session on an old spreadsheet stays on it, and is not copied to a newly chosen one.

Edits made after filing change only the app. ADR-0001 means we never rewrite rows, so the sheet keeps each Session's rows as first filed, and SessionView says so for a Session already on it.

The alternative was to append only the items added since filing. That needs a reliable per-item marker, and per-item `sheetsLink` isn't one: it is missing whenever the append returned no row span. It would still drop edits and deletions, because ADR-0001 forbids rewriting rows, so the sheet would be a mix of old and new values rather than a record of first filing.

This follows from ADR-0001, as ADR-0003 does. ADR-0003's reasoning that "every save appends a Session's rows again" describes the behaviour before this decision; its rule still holds, and an Unconfirmed rate is now the one way a Session's first filing defers its rows.

## Consequences

- `Session.spreadsheetLink` is the marker. No new field and no Firestore migration; old Sessions that have one are already on the sheet.
- There is no way to send a Session to the sheet again or to sync later edits. Duplicate rows written by earlier versions stay until the user deletes them by hand.
