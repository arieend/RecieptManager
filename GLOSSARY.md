# Glossary

**Session**: one parsed receipt, as stored in Firestore: store, date, ReceiptItems, People, tax, tip, total, currency and exchange rate to ILS. The name is historical (from bill-splitting sessions); in this codebase it always means a receipt. _Avoid_: bill, transaction.

**Draft Session**: a Session produced by Receipt intake that has not been persisted yet. It has a client-generated UUID, which it keeps once saved (saving is an upsert by that ID), and its `imageUrl` holds the prepared image as a data URL, whose mime prefix is the source of truth for the file type.

**ReceiptItem**: one line on a receipt: name, unit price, quantity, category, labels, and the People it is assigned to.

**Person**: someone an item's cost can be assigned to within a Session.

**Household person**: the default Person (`person-family`, named `משפחה`) that every Draft Session starts with; all items are assigned to it initially.

**Receipt intake**: the module that turns one input (an uploaded `File` or a camera data URL) into a Draft Session: image preparation, receipt parsing, date parsing, and mapping. One receipt per call; batching belongs to the caller. Fails with a typed kind (`unreadable-file`, `parse-failed`).

**Receipt parser**: the seam inside Receipt intake that turns a prepared image into Gemini's raw receipt JSON. Adapters: Gemini (production), fixture responses (tests). Cleaning up the raw JSON is Receipt intake's job, not the parser's.

**Session store**: the module that persists a user's Sessions: `save` (an upsert by the Session's own ID that returns what was persisted), `remove` (succeeds even if the Session was never saved), `removeAll` and `subscribe` (newest first). It shrinks the image to fit Firestore's document limit, dropping it only when Drive has a copy. Fails with a typed kind (`quota-exceeded`, `write-failed`, `subscribe-failed`). Adapters: Firestore (production), in-memory (tests). Cloud sync to Drive and Sheets is not the store's job; Receipt filing does it before calling `save`.

**Receipt filing**: the module that files a Session in one call: cloud sync to Drive and Sheets when it applies (there is a Drive token, and either the image is not on Drive yet or Sheets sync is on), then `save` through the Session store with the returned links merged in. A sync failure doesn't stop the save; the outcome reports it as a typed kind (`drive-auth-expired`, `sheets-disabled`, `sync-failed`), along with any spreadsheet ID that sync had to find or create. The caller turns those into toasts and settings updates. Session store failures pass through. Sync and store are injected: `syncToCloud` and the Firestore-backed store in production, a fake sync and the in-memory adapter in tests.
