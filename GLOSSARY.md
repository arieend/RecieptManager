# Glossary

**Session**: one parsed receipt, as stored in Firestore: store, date, ReceiptItems, People, tax, tip, total, currency and exchange rate to ILS. The name is historical (from bill-splitting sessions); in this codebase it always means a receipt. _Avoid_: bill, transaction.

**Draft Session**: a Session produced by Receipt intake that has not been persisted yet. It has a client-generated UUID, which it keeps once saved (saving is an upsert by that ID), and its `imageUrl` holds the prepared image as a data URL, whose mime prefix is the source of truth for the file type. A USD or EUR Draft Session always starts with an Unconfirmed rate.

**ReceiptItem**: one line on a receipt: name, unit price, quantity, category, labels, and the People it is assigned to.

**Person**: someone an item's cost can be assigned to within a Session.

**Household person**: the default Person (`person-family`, named `משפחה`) that every Draft Session starts with; all items are assigned to it initially.

**Receipt intake**: the module that turns one input (an uploaded `File` or a camera data URL) into a Draft Session: image preparation, receipt parsing, date parsing, mapping, and the Rate lookup for a USD or EUR receipt's date. One receipt per call; batching belongs to the caller. Fails with a typed kind (`unreadable-file`, `parse-failed`).

**Receipt parser**: the seam inside Receipt intake that turns a prepared image into Gemini's raw receipt JSON. Adapters: Gemini (production), fixture responses (tests). Cleaning up the raw JSON is Receipt intake's job, not the parser's.

**Session store**: the module that persists a user's Sessions: `save` (an upsert by the Session's own ID that returns what was persisted), `remove` (succeeds even if the Session was never saved), `removeAll` and `subscribe` (newest first). It shrinks the image to fit Firestore's document limit, dropping it only when Drive has a copy. Fails with a typed kind (`quota-exceeded`, `write-failed`, `subscribe-failed`). Adapters: Firestore (production), in-memory (tests). Cloud sync to Drive and Sheets is not the store's job; Receipt filing does it before calling `save`.

**Money**: the module that owns every amount derived from a Session: its rate to ILS, each ReceiptItem's line amount, the Session total, and conversion to the display currency. It always returns a number: a Session's own rate when it has one (confirmed or not), otherwise the Fallback rate. A Session saved before rates were confirmed counts as confirmed, and if its rate is missing, 0 or exactly 1 it gets the Fallback rate, so its amounts still match the rows already in its Purchases sheet. _Avoid_: price (for a line amount), NIS total.

**Unconfirmed rate**: a USD or EUR Session's rate to ILS that the user has not accepted yet, whether it is a suggestion from the Rate lookup or unknown. The user confirms it in ParsingReview, by accepting or editing the rate in SessionView, or by setting it by chat. ILS Sessions never have one. _Avoid_: estimated rate, guessed rate.

**Rate lookup**: the module that gives the published exchange rate to ILS for a receipt's date, from the European Central Bank's reference rates, on the last business day on or before that date, or nothing when it can't be had. It never fails. Adapters: Frankfurter (production), a fake answering from a table (tests). It is a suggestion; it does not confirm the rate. _Avoid_: current rate, live rate.

**Fallback rate**: the fixed rate to ILS (3.7 for USD, 4.0 for EUR). Used only for Sessions saved before rates were confirmed, for showing amounts while a rate is unknown, and for converting to the display currency. Never written to the Purchases sheet for a new Session.

**Line amount**: what one ReceiptItem cost: unit price × quantity, plus its share of the Session's tax, tip and discounts (the Session total divided by the subtotal). A Session's line amounts add up to its total. Given in the Session's own currency and in ILS.

**Purchases sheet**: the user's Google Sheets spreadsheet that receipts are appended to, one row per ReceiptItem, and the module that owns it: its columns (each defined once, header and value together), finding or creating it by name, matching its existing date format, and the link to each appended row. Writes to the tab its date detection found, not always the first. Existing sheets keep their header row; only a newly created sheet gets the current headers.

**Receipt filing**: the module that files a Session in one call: cloud sync to Drive and Sheets when it applies (there is a Drive token, and either the image is not on Drive yet or Sheets sync is on), then `save` through the Session store with the returned links merged in. A Session with an Unconfirmed rate is saved (and uploaded to Drive) but gets no Purchases sheet rows until its rate is confirmed. A sync failure doesn't stop the save, and a Drive upload that finished before Sheets failed is still saved with its links, so the next save doesn't upload the image again; the outcome reports the failure as a typed kind (`drive-auth-expired`, `sheets-disabled`, `sync-failed`), along with any spreadsheet ID that sync had to find or create. The caller turns those into toasts and settings updates. Session store failures pass through. Sync and store are injected: `syncToCloud` and the Firestore-backed store in production, a fake sync and the in-memory adapter in tests.
