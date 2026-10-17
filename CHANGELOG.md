# 📝 Changelog

All notable changes to the Receipt Manager project will be documented in this file.

## [Unreleased]

### Changed
- **Purchases sheet amounts**: rows appended from this version on hold each item's Line amount (unit price × quantity, plus its share of the receipt's tax, tip and discounts) in ILS, rounded to the cent, instead of the unit price. A new sheet calls that column "Amount (NIS)". An existing sheet keeps its "Price (NIS)" header, so from this version on its new rows hold the Line amount under that old header, while earlier rows still hold the unit price; nothing already written is changed (ADR-0001). "Original Amount" is the Line amount in the receipt's currency, and "Exchange Rate" is the fixed fallback (3.7 USD, 4.0 EUR) when the receipt has no rate.
- **Session totals**: category and label totals on a receipt now include each item's share of tax and tip, so they add up to the receipt total.
- **Monthly summary**: a USD or EUR receipt with no exchange rate now converts at the fixed fallback rate instead of 1, and a receipt with no total uses its subtotal plus tax and tip.

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
