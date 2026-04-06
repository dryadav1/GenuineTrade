# GenuineTrade Deployment Guide

This guide deploys GenuineTrade as a public web platform that works on desktop and mobile browsers.

## Recommended Stack

- Frontend: Vercel
- Backend API + Socket.io: Render
- Database: MongoDB Atlas

## What Users Will Open

- Public app URL: `https://app.your-domain.com`
- Mobile access: open the same URL in Chrome, Safari, or any mobile browser

## Pre-Deploy Checklist

1. Rotate any development secrets before going public.
2. Create a MongoDB Atlas cluster and confirm your deployment provider can reach it.
3. Decide your public domains.
   - Example frontend: `https://app.genuinetrade.example`
   - Example backend: `https://api.genuinetrade.example`
4. Copy the production env templates:
   - [backend/.env.production.example](../backend/.env.production.example)
   - [frontend/.env.production.example](../frontend/.env.production.example)

## Deploy Backend on Render

You can deploy manually in the Render dashboard or start from [render.yaml](../render.yaml).

### Render Service Settings

- Service type: Web Service
- Runtime: Node
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm run start`
- Health check path: `/api/health`

### Required Backend Environment Variables

- `NODE_ENV=production`
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL=https://app.your-domain.com`
- `FRONTEND_URL=https://app.your-domain.com`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### Optional but Important Backend Variables

- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TWILIO_WHATSAPP_NUMBER`
- `MSG91_AUTH_KEY`
- `MSG91_TEMPLATE_ID`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CHECKOUT_SUCCESS_URL=https://app.your-domain.com/profile`
- `STRIPE_CHECKOUT_CANCEL_URL=https://app.your-domain.com/profile`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

### Backend Post-Deploy Check

Open:

- `https://api.your-domain.com/api/health`

It should return a JSON health response.

## Deploy Frontend on Vercel

Create a Vercel project and point the project root to `frontend`.

### Vercel Project Settings

- Framework preset: Next.js
- Root directory: `frontend`
- Build command: `npm run build`
- Install command: `npm install`

### Required Frontend Environment Variable

- `NEXT_PUBLIC_API_URL=https://api.your-domain.com/api`

### Frontend Post-Deploy Check

Open:

- `https://app.your-domain.com`

Then test:

- signup or admin login
- dashboard load
- messages load
- `/api/health` from the backend

## Important Realtime and CORS Notes

The frontend uses `NEXT_PUBLIC_API_URL` both for REST requests and to derive the Socket.io base URL. That means:

- `NEXT_PUBLIC_API_URL` must point to the public backend URL
- `CLIENT_URL` on the backend must include the final frontend domain

If you later add preview domains, add them as a comma-separated list in `CLIENT_URL`.

## KYC Storage Warning

KYC documents are currently stored on the backend filesystem in `backend/uploads`.

For a real public deployment, do one of these:

1. Attach a persistent disk to the backend service and mount it where Render keeps app files.
2. Move document storage to S3 or GCS, which is the better long-term production path.

If you skip this, uploaded KYC files can disappear after service rebuilds or restarts.

## Mobile Access

Once the frontend is deployed, the same public URL works on mobile:

- buyers can browse and log in from mobile browsers
- exporters can respond from mobile browsers
- admin can review operational screens from mobile browsers

This is a hosted responsive web app, not a native Android or iPhone app.

## Production Readiness Before Inviting Real Users

1. Configure real OTP and email providers. The local development OTP fallback is disabled in production.
2. Replace all development secrets and test payment keys.
3. Use a strong `JWT_SECRET`.
4. Use HTTPS-only public domains.
5. Verify Stripe and Razorpay webhook URLs after deployment.
6. Test signup, verify email, OTP login, KYC upload, RFQ flow, and messaging end to end.

## Suggested Domain Layout

- Frontend: `app.your-domain.com`
- Backend: `api.your-domain.com`

That keeps browser CORS, API routing, and mobile sharing straightforward.
