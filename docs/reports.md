# Public reports API

## Data storage

- Database: MongoDB (Mongoose)
- Images: Cloudinary (via `CLOUDINARY_*` env vars)
- Push notifications: Firebase Cloud Messaging (FCM) via `firebase-admin` (optional)

## Endpoints

### Create report (public)

- `POST /api/reports/public-pet` (multipart/form-data)
- Fields:
  - `firstName` (required)
  - `lastName` (required)
  - `phoneNumber` (required)
  - `petStatus` (required: `lost|found`)
  - `location` (required)
  - `description` (optional)
  - `photo` (required file)
- Response:
  - `{ report: { id, firstName, petStatus, location, description, photoUrl, createdAt, reactions, commentsCount, flagsCount } }`

### Fetch reports feed (public)

- `GET /api/reports/public?page=1&limit=8`
- Response:
  - `{ items: Report[], nextPage: number | null }`

### Comments (public)

- `POST /api/reports/:reportId/comments`
- Body: `{ name?: string, text: string }`
- `GET /api/reports/:reportId/comments?page=1&limit=20`
- Response: `{ items: Comment[], nextPage: number | null }`

### Reactions (public)

- `POST /api/reports/:reportId/reactions`
- Body: `{ reaction: "like" | "heart" | "help" | "seen" | "helped", clientId?: string }`
- Response: `{ reactions, myReaction }`

### Flag content (public)

- `POST /api/reports/:reportId/flag`
- Body: `{ reason: string, details?: string }`

### Notifications (public token registration)

- `POST /api/notifications/register`
- Body: `{ token: string, platform?: "web"|"ios"|"android", userAgent?: string }`

### Notifications (public Web Push subscription)

- `POST /api/notifications/webpush/subscribe`
- Body: `{ subscription: PushSubscription, platform?: string, userAgent?: string }`

### Notifications (public Web Push public key)

- `GET /api/notifications/webpush/public-key`
- Response: `{ publicKey: string }`

### Notifications (public Web Push unsubscribe)

- `POST /api/notifications/webpush/unsubscribe`
- Body: `{ endpoint: string }`

### Notifications (admin broadcast helper)

- `POST /api/notifications/broadcast` (requires Bearer token with `isAdmin=true`)
- Body: `{ title?: string, body?: string, data?: object }`

## Env vars

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (stringified service account JSON, optional)
- `REPORT_AUTOHIDE_FLAGS` (0 disables auto-hide)
- `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_CONTACT` (optional, enables browser/PWA push)

Generate VAPID keys:
- `npm run vapid:generate`
