# 🛠 Development Guide

This guide provides technical details for developers working on the Receipt Manager project.

## 🏗 Architecture Overview

Receipt Manager is a React Single Page Application (SPA) that leverages Firebase for its backend and Google APIs for AI and cloud storage.

### Data Flow

1.  **Input**: User captures a receipt image or uploads a PDF.
2.  **Processing**:
    *   Images are resized and compressed client-side (`utils/imageUtils.ts`).
    *   The processed image/PDF is sent to Gemini AI (`services/geminiService.ts`) with a structured prompt.
    *   Gemini returns a JSON object containing extracted receipt data.
3.  **Session Management**:
    *   The extracted data is used to create a new `Session` object.
    *   Users can interact with the session (assign items, add people, adjust totals).
4.  **Synchronization**:
    *   Sessions are saved to Firestore (`sessions` collection).
    *   If enabled, the receipt file is uploaded to Google Drive (`services/driveService.ts`).
    *   Itemized data is appended to a Google Sheet (`services/sheetsService.ts`).

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
