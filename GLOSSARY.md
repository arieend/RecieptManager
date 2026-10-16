# Glossary

**Session**: one parsed receipt, as stored in Firestore: store, date, ReceiptItems, People, tax, tip, total, currency and exchange rate to ILS. The name is historical (from bill-splitting sessions); in this codebase it always means a receipt. _Avoid_: bill, transaction.

**Draft Session**: a Session produced by Receipt intake that has not been persisted yet. It has a client-generated ID and its `imageUrl` holds the prepared image as a data URL, whose mime prefix is the source of truth for the file type.

**ReceiptItem**: one line on a receipt: name, unit price, quantity, category, labels, and the People it is assigned to.

**Person**: someone an item's cost can be assigned to within a Session.

**Household person**: the default Person (`person-family`, named `משפחה`) that every Draft Session starts with; all items are assigned to it initially.

**Receipt intake**: the module that turns one input (an uploaded `File` or a camera data URL) into a Draft Session: image preparation, receipt parsing, date parsing, and mapping. One receipt per call; batching belongs to the caller. Fails with a typed kind (`unreadable-file`, `parse-failed`).

**Receipt parser**: the seam inside Receipt intake that turns a prepared image into Gemini's raw receipt JSON. Adapters: Gemini (production), fixture responses (tests). Cleaning up the raw JSON is Receipt intake's job, not the parser's.
