# 🛠 Development Guide

This guide provides technical details for developers working on the Receipt Manager project.

## 🏗 Architecture Overview

Receipt Manager is a React Single Page Application (SPA) that leverages Firebase for its backend and Google APIs for AI and cloud storage.

### Data Flow

Terms (Session, Draft Session, Receipt intake, …) are defined in [`GLOSSARY.md`](GLOSSARY.md). Each step names the module that owns it:

1.  **Receipt intake** (`services/receiptIntake.ts`): an upload or camera capture becomes a Draft Session. Image preparation (`utils/imageUtils.ts` → `prepareReceiptImage`) the Gemini receipt parser (`services/geminiService.ts`) and the Rate lookup (`services/rateLookup.ts` → `createFrankfurterRateLookup`) are passed in from `App.tsx`.
2.  **Review and edit** (`components/ParsingReview.tsx`, `components/SessionView.tsx`): the user checks the draft, assigns items, adjusts totals.
3.  **Receipt filing** (`services/receiptFiling.ts`): `App.tsx` → `saveSession` files the Session in one call, then turns the outcome into toasts and settings updates.
    1.  **Cloud sync** (`services/syncService.ts`), when there is a Drive token and either the image is not on Drive yet or Sheets sync is on: the receipt image goes to Google Drive (`services/driveService.ts`), then one row per ReceiptItem to the **Purchases sheet** (`services/purchasesSheet.ts`, over the Google Sheets adapter in `services/googleSheetsAdapter.ts`). `App.tsx` → `handleConnectSpreadsheet` finds or creates the spreadsheet through the same module. A Drive upload that finished is kept even if Sheets then fails.
    2.  **Save** through the **Session store** (`services/sessionStore.ts`), with the Drive and Sheets links merged in, even if sync failed. Production writes to Firestore (`sessions` collection) via `services/firestoreSessionAdapter.ts`.

## 📊 Data Models

### `Session`
The core data structure representing a single receipt scanning session.
- `id`: Unique identifier (timestamp-based).
- `userId`: Firebase UID of the owner.
- `storeName`: Extracted store name.
- `items`: Array of `ReceiptItem`.
- `people`: Array of `Person`.
- `total`, `tax`, `tip`: Financial totals.
- `imageUrl`: Base64 representation of the receipt (for local display).
- `driveFileId`, `driveLink`: Cloud storage references.

### `ReceiptItem`
- `id`: Unique identifier.
- `name`: Item description.
- `price`: Unit price.
- `quantity`: Number of items.
- `assignedTo`: Array of `Person` IDs.
- `category`, `labels`: AI-generated metadata.

## 🤖 AI Integrations

### Gemini AI (`services/geminiService.ts`)
We use `gemini-3-flash-preview` for its speed and accuracy in OCR and structured data extraction.
- **`parseReceiptImage`**: Extracts structured JSON from images/PDFs.
- **`interpretChatCommand`**: Uses natural language processing to map user commands (e.g., "Assign the pizza to John") to session actions.
- **`transcribeStoreName`**: Fallback for quick store name extraction.
- **`categorizeItems`**: Enhances item metadata with categories and labels.

## ☁️ Cloud Services

### Firebase
- **Authentication**: Google Sign-In is the primary provider.
- **Firestore**: Stores user sessions and profile metadata.
- **Security Rules**: Implements "Default Deny" and "Least Privilege" principles.

### Google Drive & Sheets
- **Drive**: Organizes receipts into folders by Year/Month/Day.
- **Sheets**: Creates a "Receipts Database" spreadsheet if one doesn't exist and appends new purchases.

## 🧪 Testing Strategy

### Unit Tests
- **Services**: Mocking API calls (Firebase, Google APIs) to test business logic in isolation.
- **Utils**: Testing pure functions like calculations and image processing.

### Component Tests
- **React Testing Library**: Testing UI components by simulating user interactions and asserting on rendered output.
- **Mocking**: Extensive use of `vi.mock` for external libraries and browser APIs (Camera, File Reader).

## 🌍 Localization

The app uses a custom translation system (`translations.ts`) supporting English (`en`) and Hebrew (`he`).
- **RTL Support**: The UI automatically flips layout and typography for Hebrew.
- **Dynamic Keys**: All UI strings are accessed via the `t` object derived from the current language state.

## 🛠 Useful Commands

- `npm run dev`: Start development server.
- `npm run build`: Build for production.
- `npm test`: Run all tests.
- `npm run lint`: Run TypeScript type checking.
- `npm run clean`: Remove build artifacts.

## 🌳 Worktrees

A new git worktree (including agent worktrees under `.claude/worktrees/`) has no `node_modules`, so `npm run check` and the pre-push hook can't run there. As long as `package.json` matches the main checkout's, link that checkout's `node_modules` instead of reinstalling. From PowerShell:

`New-Item -ItemType Junction -Path <worktree>\node_modules -Target <main checkout>\node_modules`

If the dependencies differ, run `npm ci` in the worktree. Before `git worktree remove`, delete the junction with `cmd /c rmdir <worktree>\node_modules`. That removes only the link, so the main checkout's `node_modules` can't be touched by a recursive delete.
