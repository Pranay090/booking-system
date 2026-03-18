# Booking System

A full-stack application featuring dynamic pricing and real-time seat booking, built using Angular, Node.js + Express, PostgreSQL, and Redis.

## Features

- **Dynamic Pricing**: Algorithms that adjust prices based on real-time and historical demand, locking in prices during the booking flow.
- **Google OAuth Integration**: Secure, frictionless sign-up and login using Google accounts.
- **Concurrency Control**: Robust distributed locking with Redis to prevent double bookings.
- **Performance Tested**: Built to handle concurrent loads with sub-millisecond database queries and fast Redis caching.

## Quick Start

You can run the application either completely inside Docker or with local application servers.

### Option 1: Databases in Docker, App Local
Start the required databases using Docker Compose:
```bash
docker compose up postgres redis -d
```

Start the backend API and pricing worker:
```bash
# Terminal 1: API
cd backend
npm start

# Terminal 2: Worker
cd backend
npm run worker
```

Start the frontend server (Angular):
```bash
# Terminal 3: Frontend
cd frontend
ng serve
```

### Option 2: All in Docker
To run everything directly inside Docker:
```bash
docker compose up -d
```

### Stopping the Services
To stop both local and docker-composed environments:
```bash
docker compose down
```

## Detailed Documentation

For comprehensive guides on the project's sub-systems, refer to [DOCUMENTATION.md](DOCUMENTATION.md) which includes:
- Deployment (Render, Vercel, Neon, Upstash)
- Dynamic Pricing Architecture & Formulas
- Google OAuth Integration Guide
- Performance Testing Setup & Metrics
- Frontend Commands Overview
