# 🔥 Firebase Setup & Security

This document outlines the Firebase configuration and security rules for the Receipt Manager project.

## 🏗 Firestore Structure

The application uses a single collection, `sessions`, to store all receipt data.

### `sessions` Collection
- **Path**: `/sessions/{sessionId}`
- **Fields**:
  - `id`: string (required)
  - `userId`: string (required) - Matches the owner's UID.
  - `storeName`: string (required)
  - `createdAt`: timestamp/string (required)
  - `items`: array of `ReceiptItem` objects.
  - `people`: array of `Person` objects.
  - `tax`, `tip`, `total`: numbers.
  - `imageUrl`: string (base64).
  - `driveFileId`, `driveLink`: strings.

## 🔒 Security Rules (`firestore.rules`)

The security rules enforce strict data isolation and validation.

### Core Principles
1.  **Default Deny**: All read/write access is denied by default.
2.  **Ownership-Based Access**: Users can only read, create, update, or delete documents where `userId` matches their own `request.auth.uid`.
3.  **Authentication Required**: No unauthenticated access is permitted.
4.  **Data Validation**: 
    -   `create` and `update` operations are validated against a schema.
    -   Required fields must exist.
    -   Data types (string, number, array) are strictly checked.
    -   String lengths and array sizes are limited to prevent DoS attacks.
5.  **Immutable Fields**: Fields like `userId` and `createdAt` cannot be modified after creation.

### Example Rule Snippet
```javascript
match /sessions/{sessionId} {
  allow read: if isOwner(resource.data.userId);
  allow create: if isAuthenticated() && 
                isValidSession(request.resource.data) && 
                isOwner(request.resource.data.userId);
  allow update: if isOwner(resource.data.userId) && 
                isValidSession(request.resource.data) && 
                request.resource.data.userId == resource.data.userId;
  allow delete: if isOwner(resource.data.userId);
}
```

## 🔑 Authentication

The project uses **Firebase Authentication** with **Google Sign-In**.
- **Provider**: `google.com`
- **Flow**: `signInWithPopup` (preferred for iframe environments).
- **User Profile**: User metadata (display name, email, photo) is stored in the `users` collection (if implemented) or accessed via `auth.currentUser`.

## 🛠 Setup Instructions

1.  **Create a Firebase Project**: Go to the [Firebase Console](https://console.firebase.google.com/).
2.  **Enable Firestore**: Create a database in "Production Mode".
3.  **Enable Authentication**: Enable the "Google" sign-in provider.
4.  **Deploy Rules**: Use the Firebase CLI or copy the contents of `firestore.rules` into the console.
5.  **Configure Client**: Update `firebase-applet-config.json` with your project's configuration.

## 🧪 Testing Rules

You can test security rules using the **Firebase Emulator Suite** or the **Rules Playground** in the Firebase Console.
-   Test as an unauthenticated user (should fail).
-   Test as User A reading User B's data (should fail).
-   Test as User A reading their own data (should succeed).
-   Test creating a document with missing required fields (should fail).
