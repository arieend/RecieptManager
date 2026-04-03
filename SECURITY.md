# 🛡 Security Policy

We take the security of the Receipt Manager project seriously. This document explains our security policy and how to report vulnerabilities.

## 🏗 Security Architecture

The application is built with security in mind, following these principles:
- **Default Deny**: All access is denied by default.
- **Least Privilege**: Users are granted only the minimum permissions required.
- **Data Isolation**: Users can only access their own data.
- **Input Sanitization**: All user input is sanitized before being processed or stored.
- **Secure API Keys**: Third-party API keys are managed securely and never exposed in client-side code where possible.

## 🔒 Reporting a Vulnerability

If you find a security vulnerability, please do NOT open a public issue. Instead, please report it privately by emailing the project maintainers at [your-email@example.com].

We will acknowledge your report within 48 hours and provide a timeline for a fix. We ask that you follow responsible disclosure practices and give us time to address the issue before making it public.

## 🛡 Security Rules (`firestore.rules`)

The security rules for Firestore are a critical part of our security architecture. They enforce strict data isolation and validation.

### Key Rules
- Users can only read, create, update, or delete documents where `userId` matches their own `request.auth.uid`.
- No unauthenticated access is permitted.
- Data types and required fields are strictly checked.
- String lengths and array sizes are limited to prevent DoS attacks.

## 🔑 Authentication

The project uses **Firebase Authentication** with **Google Sign-In**.
- **Provider**: `google.com`
- **Flow**: `signInWithPopup` (preferred for iframe environments).
- **User Profile**: User metadata is accessed via `auth.currentUser`.

## 🛠 Security Best Practices

- **Keep Dependencies Up-to-Date**: Regularly update npm packages to the latest versions.
- **Review Security Rules**: Regularly review and test Firestore security rules.
- **Monitor API Usage**: Monitor API usage for any unusual activity.
- **Use HTTPS**: Always serve the application over HTTPS.

Thank you for helping us keep the Receipt Manager project secure!
