# Booking System Documentation

This document serves as the comprehensive guide for all subsystems in the booking application.

---

## Table of Contents
1. [Dynamic Pricing Implementation](#dynamic-pricing-implementation)
2. [Dynamic Pricing - Quick Start](#dynamic-pricing---quick-start)
3. [Google OAuth Setup](#google-oauth-setup)
4. [Deployment (Free Tier)](#deployment-free-tier)
5. [Performance Testing](#performance-testing)
6. [Frontend Development](#frontend-development)

---

## Dynamic Pricing Implementation

### Overview
Dynamic pricing is implemented asynchronously using demand signals stored in Redis, without affecting the booking path performance. The system calculates price multipliers based on real-time demand and applies them during booking while ensuring prices never go below the Least Selling Price (LSP).

### Architecture
1. **Demand Tracker** (`services/demand-tracker.js`): Tracks booking completions in Redis, monitors active seat locks (TTL-based), and calculates booking velocity using sliding windows.
2. **Pricing Engine** (`services/pricing-engine.js`): Computes price multipliers based on demand, stores pricing snapshots in Redis (30s TTL), and applies multipliers during booking with LSP floor constraint.
3. **Background Worker** (`pricing-worker.js`): Runs every 30 seconds and updates pricing snapshots for all active shows.
4. **Booking Integration** (`routes/booking.js`): Reads latest pricing snapshot during booking, freezes price inside PostgreSQL transaction, and tracks demand after successful booking.

### Demand Metrics
1. **Seats Booked (60% weight)**: Total seats booked for the show vs. total seats.
2. **Active Seat Locks (10% weight)**: Current number of actively locked seats.
3. **Booking Velocity (30% weight)**: Last 30 minutes booking rate divided by baseline last 24 hours rate (normalized to 0-1 range).

### Pricing Formula
```javascript
// 1. Calculate demand factors (0-1 range)
bookedPercentage = seatsBooked / totalSeats
locksPercentage = activeLocks / totalSeats
velocityRatio = min(recentRate / baselineRate, 2.0) / 2.0

// 2. Weighted demand score
demandScore = (bookedPercentage * 0.60) + (locksPercentage * 0.10) + (velocityRatio * 0.30)

// 3. Calculate multiplier (0 to 1.3x)
multiplier = demandScore * 1.3

// 4. Apply to price with LSP floor
finalPrice = max(basePrice * multiplier, leastSellingPrice)
```

**Multiplier Bounds:** 0.0x to 1.3x. Minimum is bounded by LSP.

### Data Flow
1. **Booking Completion**: Transaction commits -> Increments booked count in Redis -> Adds Timestamp to velocity sorted set.
2. **Price Calculation**: Every 30 seconds worker runs -> Calculates multiplier from demand -> Stores in Redis with 30s TTL.
3. **Booking**: Get seats from DB -> Pricing Engine grabs snapshot from Redis -> Applies multiplier -> Freezes price in pg transaction.

---

## Dynamic Pricing - Quick Start

Dynamic pricing runs constantly. Standard responses for seats will now include `current_price` and `multiplier` based on Redis calculations.

### Monitoring Pricing Changes
1. Fetch current seat prices:
   ```bash
   curl http://localhost:3000/shows/1/seats
   ```
2. Make bookings:
   ```bash
   curl -X POST http://localhost:3000/book -H "Content-Type: application/json" -d '{"showId": 1,"seatIds": [1, 2],"userId": 1}'
   ```
3. Watch Prices: Wait 30 seconds for the background worker to cycle, and the prices should be elevated for the next pull.

---

## Google OAuth Setup

Users can sign up and log in using their Google account via OAuth 2.0.

### Prerequisites (Google Cloud)
1. Go to Google Cloud Console. Enable Google+ API.
2. Under Credentials, create OAuth 2.0 Client ID (Web Application).
3. Authorized Origins: `http://localhost:4200`, `http://localhost:3000`.
4. Authorized Redirect: `http://localhost:3000/auth/google/callback`.

### Environment Setup (`backend/.env`)
```env
# OAuth Config
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### Database Requirements
Make sure your database has the updated scheme including fields: `google_id TEXT UNIQUE` and `name TEXT`.

### Architecture
1. Request sent to `/auth/google`.
2. Backend initiates Google flow & user authenticates.
3. Google redirects to `/auth/google/callback`.
4. Backend grabs User Info, writes mapping to Database.
5. Generates JWT, token is returned to Frontend.

---

## Deployment (Free Tier)

Set up a full-stack deployment utilizing completely free tools.

### Stack Breakdown
- **Frontend**: Vercel
- **Backend**: Render
- **PostgreSQL**: Neon
- **Redis**: Upstash

### Integration Steps
1. **Neon PostgreSQL**: Obtain connection string (`postgresql://...sslmode=require`). Save as `DATABASE_URL`. Run `backend/sql/schema.sql` inside Neon to scaffold tables.
2. **Upstash Redis**: Obtain Redis URL connection with TLS string (`rediss://...:6379`). Save as `REDIS_URL`.
3. **Render Backend**: Setup a Node.JS worker with `npm install` and `npm start`. Apply Env variables for Database, Redis, JWT Secret, Enable Worker, and Node Environment. Be sure to note the `BACKEND_URL`.
4. **Vercel Frontend**: Output directory matches `dist/frontend/browser` for Angular. Setup the Enivronment URL for `BACKEND_URL` corresponding to the Render Instance.
5. Validate all CORS and callback URI's directly match between environments!

---

## Concurrency & Data Integrity (Redis & ACID)

To ensure high reliability and prevent booking conflicts (like double-bookings), the system employs a two-layer approach utilizing Redis caching and PostgreSQL's ACID transaction properties.

### 1. Redis Distributed Locks (Fail-Fast)
When a user initiates a booking, the system first attempts to acquire a lock for each requested seat.
- **Implementation**: Utilizes Redis `SET key value NX EX 300` functionality.
- **Fail-Fast Mechanism**: If any seat lock cannot be acquired, the system instantly throws a "Seat temporarily locked" error without querying the database.
- **TTL (Time To Live)**: Locks automatically expire after 5 minutes (300 seconds) to prevent permanent deadlocks if the node/client crashes.

### 2. PostgreSQL ACID Transactions (Final Authority)
While Redis provides the preliminary fast-check, PostgreSQL serves as the definitive source of truth.
- **Atomicity**: The entire booking process (verifying seat status, deducting user credits, creating the booking record, and updating seat statuses) is wrapped in a single `BEGIN ... COMMIT` transaction. If any step fails, the entire block is rolled back seamlessly.
- **Consistency**: Database constraints (such as positive credit balances and accurate booking states) are continuously enforced.
- **Isolation/Durability**: `SELECT ... FOR UPDATE` row-level locks are heavily utilized. This guarantees that if two simultaneous requests bypass the Redis locks, the database will evaluate them sequentially, avoiding race conditions and permanently committing the validated changes.

---

## Performance Testing

Available tests inside `backend/tests/` verify high load functionality.

### Scripts
1. **API Performance Test (`tests/performance-test.js`)**: Measures response times under concurrent load, validates race condition locks.
2. **DB Performance (`tests/db-performance.js`)**: Validates Postgres transactions, latency and queries.
3. **Redis Performance (`tests/redis-performance.js`)**: Tests caching, distributed lock timing and transaction speeds.
4. **Load Test**: Handled via Artillery configs `tests/load-test.yml`

*Use tools such as `autocannon` or `wrk` for high concurrency HTTP connection checks against the node web-sever directly.*

---

## Frontend Development

Generated using Angular CLI version 21.0.5.

- **Start Project Server**: `ng serve` (Available on `localhost:4200`)
- **Scaffold Models**: `ng generate component my-component-name`
- **Build Bundle**: `ng build` (Produces static output to `dist/`)
- **Testing**: Can employ Vitest (`ng test`) or generic e2e implementations.
