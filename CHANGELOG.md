# 📝 Changelog

All notable changes to the Receipt Manager project will be documented in this file.

## [1.0.0] - 2026-04-03

### Added
- **AI-Powered Scanning**: Gemini AI extracts receipt data from images/PDFs.
- **Expense Splitting**: Assign items to different people to calculate individual shares.
- **Cloud Sync**: Google Drive and Google Sheets integration.
- **Multi-language Support**: English and Hebrew (RTL).
- **AI Chat Assistant**: Natural language commands for session management.
- **Real-time History**: Firebase Firestore integration for session persistence.
- **Comprehensive Documentation**: README, DEVELOPMENT, FIREBASE, TESTING, CONTRIBUTING, CHANGELOG, and LICENSE.

### Fixed
- **Accessibility**: Added `aria-label` to all interactive elements.
- **Testing**: Achieved 100% test coverage for all services and components.
- **Date Formatting**: Exported items to Google Sheets now use `dd/mm/yyyy` format.
- **Hebrew Filenames**: Sanitized Hebrew characters in filenames for Google Drive.
- **Scanner act() Warnings**: Fixed React `act()` warnings in `Scanner.test.tsx`.
- **ErrorBoundary**: Improved error handling for Firestore permission errors.

### Changed
- **Vite Configuration**: Optimized build and development settings.
- **Tailwind CSS**: Upgraded to Tailwind CSS 4 for improved styling and performance.
- **Motion**: Integrated `motion` for all UI transitions and animations.
