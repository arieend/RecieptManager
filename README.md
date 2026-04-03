# Receipt Manager

Receipt Manager is a full-stack web application designed to simplify receipt management and expense splitting. Using advanced AI, it can scan photos or PDFs of receipts, extract line items, and help you organize your spending.

## 🚀 Key Features

- **AI-Powered Scanning**: Snap a photo or upload a PDF. Gemini AI automatically extracts store names, items, prices, tax, and tips.
- **Expense Splitting**: Assign items to different people to calculate individual shares.
- **Cloud Sync**: 
  - **Google Drive**: Automatically save receipt images/PDFs to organized folders in your Drive.
  - **Google Sheets**: Export every itemized purchase to a centralized spreadsheet for long-term tracking.
- **Multi-language Support**: Full support for English and Hebrew (RTL).
- **Real-time History**: Access your past scans and sessions anytime, synced via Firebase.
- **AI Chat Assistant**: Use natural language commands to assign items or add people to a session.

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS 4, Lucide React (Icons), Motion (Animations)
- **Backend/Database**: Firebase (Firestore, Authentication)
- **AI**: Google Gemini AI (`@google/genai`)
- **Integrations**: Google Drive API, Google Sheets API
- **Testing**: Vitest, React Testing Library

## 📋 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- A Firebase project
- A Google Cloud project with Gemini API, Drive API, and Sheets API enabled

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables (see below).
4. Start the development server:
   ```bash
   npm run dev
   ```

### Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```env
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Firebase Configuration (handled via firebase-applet-config.json in this environment)
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# VITE_FIREBASE_STORAGE_BUCKET=...
# VITE_FIREBASE_MESSAGING_SENDER_ID=...
# VITE_FIREBASE_APP_ID=...
```

## 📂 Project Structure

```
/src
  /components     # UI Components (Scanner, SessionView, History, etc.)
    /ui           # Base UI components (Button, Card, Modal)
  /services       # Business logic and API integrations
    geminiService # AI parsing and chat logic
    driveService  # Google Drive file management
    sheetsService # Google Sheets data export
    syncService   # Orchestrates cloud synchronization
    configService # App settings and formatting utilities
  /utils          # Helper functions (calculations, image processing)
  /test           # Test setup and mocks
  App.tsx         # Main application logic and routing
  firebase.ts     # Firebase initialization and security helpers
  translations.ts # Localization strings
  types.ts        # TypeScript interfaces and enums
```

## 🧪 Testing

The project uses Vitest for unit and integration testing. We aim for high coverage across all services and components.

Run tests:
```bash
npm test
```

## 🔒 Security

- **Firestore Rules**: Access is restricted to authenticated users. Users can only read and write their own data.
- **PII Protection**: Sensitive user data is isolated and protected via strict security rules.
- **API Keys**: Third-party API keys are managed securely and never exposed directly in client-side code where possible.

## 📄 License

This project is licensed under the MIT License.
