# GenuineTrade Platform Architecture

## Current Production Foundation

- `frontend`: Next.js App Router workspace with a shared SaaS shell, premium dashboards, notifications, and a messaging workspace
- `backend`: Express API server with Socket.io, JWT auth, modular controllers/routes, and payment adapters
- `mongodb`: primary operational store for onboarding, RFQs, matches, transactions, notifications, messages, and audit logs
- `cache`: Redis-ready cache abstraction with memory fallback for presence and realtime support

## Module Boundaries

- `auth`: JWT login, signup, current-user session
- `profiles`: exporter and buyer onboarding plus profile hydration
- `trust`: exporter verification workflow, checklist, notes, trust score, and audit events
- `demand`: RFQ creation, pagination, matching, and exporter opportunity views
- `matching`: deterministic ranking with normalized score components
- `payments`: provider routing, payment intents/orders, webhook processing, escrow-style transaction state machine
- `monetization`: Starter -> Professional -> Enterprise subscription engine, feature access control, and recurring billing orchestration
- `realtime`: Socket.io rooms for admins, users, and trade threads
- `notifications`: persisted notification center plus live pushes
- `messages`: buyer/exporter threads bound to RFQs or transactions
- `ops`: admin dashboard, activity feed, subscriptions, transactions, and audit logs

## Realtime Event Model

- `admin.activity`: platform events for onboarding, verification, RFQs, and payment milestones
- `presence:update`: active-user counts streamed to admin sockets
- `notification:new`: persisted notification pushed to a user room
- `notifications:count`: unread notification counter updates
- `message:new`: new thread message broadcast to the thread room
- `message:thread:update`: inbox refresh hint for recipients

## Scale-Up Path

### Phase 1

- Single backend instance
- MongoDB Atlas
- Memory cache fallback
- Socket.io single-node transport

### Phase 2

- Redis-backed cache and Socket.io adapter
- Dedicated worker for webhook retries, analytics snapshots, and long-running tasks
- Queue-backed notification fanout

### Phase 3

- Read models for analytics and growth dashboards
- Search service for product discovery and supplier intelligence
- Dedicated messaging/media service for chat attachments and meeting integrations

## Deployment Shape

- Frontend: Vercel or AWS Amplify
- Backend API + Socket.io: Railway, Render, ECS/Fargate, or GCP Cloud Run with websocket support
- MongoDB: Atlas
- Redis: Upstash, ElastiCache, or Memorystore when multi-instance realtime becomes necessary
- Object storage for documents and chat attachments: S3 / GCS

## CI/CD Baseline

1. Install workspace dependencies
2. Run frontend production build
3. Run backend import smoke test
4. Run API and model tests
5. Deploy frontend and backend with environment-specific secrets
