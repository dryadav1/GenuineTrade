# GenuineTrade

GenuineTrade is a self-onboarding B2B platform MVP for exporters and buyers. Users create accounts, complete role-based profiles, upload verification documents, and track their review status from a limited-access dashboard. Admins review all onboarding submissions, approve or reject users, and assign trust badges.

## Stack

- Frontend: Next.js App Router + Tailwind CSS
- Backend: Node.js + Express.js
- Database: MongoDB + Mongoose
- Authentication: JWT + bcrypt

## Project Structure

```text
GenuineTrade/
  frontend/
    src/app/
      (marketing)/
      (workspace)/
      admin/
    src/components/
    src/lib/
  backend/
    src/controllers/
    src/middleware/
    src/models/
    src/routes/
    src/services/
    src/utils/
```

## Main Routes

- `GET /signup`
- `GET /login`
- `GET /complete-profile`
- `GET /dashboard`
- `GET /admin`

## Backend API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:userId/review`

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create the backend env file.

Copy `backend/.env.example` to `backend/.env`.

3. Create the frontend env file.

Copy `frontend/.env.local.example` to `frontend/.env.local`.

4. Fill in the required backend variables.

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=replace-with-a-long-secret
CLIENT_URL=http://localhost:3000
ADMIN_EMAIL=admin@genuinetrade.com
ADMIN_PASSWORD=ChangeThisStrongPassword
ADMIN_NAME=GenuineTrade Admin
PHONE_OTP_TTL_SECONDS=300
OTP_SEND_RATE_LIMIT_WINDOW_MS=900000
OTP_SEND_RATE_LIMIT_MAX=5
OTP_VERIFY_RATE_LIMIT_WINDOW_MS=900000
OTP_VERIFY_RATE_LIMIT_MAX=10
REQUIRE_PHONE_VERIFICATION=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
MSG91_AUTH_KEY=
MSG91_TEMPLATE_ID=
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
JSON_BODY_LIMIT=15mb
```

5. Start the backend.

```bash
npm run dev --workspace backend
```

6. Start the frontend in a second terminal.

```bash
npm run dev --workspace frontend
```

7. Open the app.

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5000/api/health`

## Default Admin Account

The backend bootstraps an admin account using the values from `backend/.env`. Use those credentials on the login page after the server starts successfully.

## Current Onboarding Flow

1. A user signs up as an exporter or buyer.
2. The app redirects to `/complete-profile`.
3. The completed profile is stored in MongoDB with:
   - `status: pending`
   - `badge: none`
4. The user verifies their phone number with OTP before saving the profile when `REQUIRE_PHONE_VERIFICATION=true`.
5. The dashboard shows limited access while verification is pending.
6. Admin reviews the user, updates status, and assigns a badge.

## Notes

- Exporter uploads are stored under `backend/uploads/onboarding`.
- OTP SMS can be delivered through Twilio or MSG91. In non-production mode, the backend falls back to a local debug code if no SMS provider is configured.
- `REQUIRE_PHONE_VERIFICATION` defaults to `true` in production and `false` elsewhere if you do not set it explicitly.
- MongoDB Atlas access must allow your current IP address, or the backend will fail to start.
- Pending and rejected users can still edit their profile and resubmit for review.
