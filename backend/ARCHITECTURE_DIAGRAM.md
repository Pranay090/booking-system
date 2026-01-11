# Phase 4: Dynamic Pricing System Architecture

## System Flow Diagram

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                         BOOKING REQUEST PATH                         ┃
┃                        (Fast, Non-blocking)                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  User Request                API Server               PostgreSQL
       │                           │                        │
       │  POST /book              │                        │
       │  {showId, seatIds}       │                        │
       ├─────────────────────────>│                        │
       │                           │                        │
       │                           │  Acquire Redis Locks   │
       │                           │  (temporary hold)      │
       │                           │                        │
       │                           │  BEGIN TRANSACTION     │
       │                           ├───────────────────────>│
       │                           │                        │
       │                           │  SELECT multiplier     │
       │                           │  FROM pricing_multipliers
       │                           │  WHERE show_id = ?     │
       │                           ├───────────────────────>│
       │                           │<───────────────────────┤
       │                           │  Returns: 1.2          │
       │                           │  (or 1.0 if not found) │
       │                           │                        │
       │                           │  SELECT base_price     │
       │                           │  FROM seats            │
       │                           │  WHERE id IN (...)     │
       │                           │  FOR UPDATE            │
       │                           ├───────────────────────>│
       │                           │<───────────────────────┤
       │                           │  Returns: [100, 100]   │
       │                           │                        │
       │                           │  Calculate:            │
       │                           │  price = 100 × 1.2     │
       │                           │  total = $240          │
       │                           │                        │
       │                           │  INSERT INTO bookings  │
       │                           │  UPDATE seats          │
       │                           ├───────────────────────>│
       │                           │<───────────────────────┤
       │                           │  COMMIT                │
       │                           │                        │
       │                           │  Release Redis Locks   │
       │                           │                        │
       │<──────────────────────────┤                        │
       │  Response:                │                        │
       │  {                        │                        │
       │    bookingId: 42,         │                        │
       │    totalPrice: 240.00,    │                        │
       │    multiplier: 1.2        │                        │
       │  }                        │                        │
       │                           │                        │


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                      OFFLINE PRICING JOB PATH                        ┃
┃                    (Slow, Async, Independent)                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

  Cron Scheduler            Batch Job                PostgreSQL
       │                         │                        │
       │  */30 * * * *           │                        │
       │  (every 30 mins)        │                        │
       ├────────────────────────>│                        │
       │                         │                        │
       │                         │  BEGIN TRANSACTION     │
       │                         ├───────────────────────>│
       │                         │                        │
       │                         │  Query show stats:     │
       │                         │  SELECT                │
       │                         │    show_id,            │
       │                         │    COUNT(seats),       │
       │                         │    COUNT(booked)       │
       │                         │  FROM shows            │
       │                         │  JOIN seats            │
       │                         │  WHERE show_time > NOW()
       │                         ├───────────────────────>│
       │                         │<───────────────────────┤
       │                         │  Returns:              │
       │                         │  [                     │
       │                         │    {show: 1, 15/100},  │
       │                         │    {show: 2, 45/100},  │
       │                         │    {show: 3, 85/100}   │
       │                         │  ]                     │
       │                         │                        │
       │                         │  Apply pricing rules:  │
       │                         │  ─────────────────     │
       │                         │  Show 1: 15% → 1.0×   │
       │                         │  Show 2: 45% → 1.2×   │
       │                         │  Show 3: 85% → 1.5×   │
       │                         │                        │
       │                         │  UPSERT multipliers:   │
       │                         │  INSERT INTO           │
       │                         │  pricing_multipliers   │
       │                         │  ON CONFLICT UPDATE    │
       │                         ├───────────────────────>│
       │                         │<───────────────────────┤
       │                         │  COMMIT                │
       │                         │                        │
       │<────────────────────────┤                        │
       │  Exit: Success          │                        │
       │  (Updated 3 shows)      │                        │
       │                         │                        │


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                      GRACEFUL DEGRADATION                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Scenario 1: Pricing Table Empty
────────────────────────────────
  SELECT multiplier FROM pricing_multipliers WHERE show_id = 1
  → Returns: (no rows)
  → getMultiplier() returns: 1.0
  → Booking succeeds with base price


Scenario 2: Pricing Job Fails
──────────────────────────────
  Cron Job → npm run pricing-job → ERROR!
  → Stale multipliers remain in table
  → Booking continues using last known values
  → No impact on API availability


Scenario 3: Database Query Error
─────────────────────────────────
  getMultiplier(showId) throws exception
  → Caught in try/catch
  → Logs error
  → Returns: 1.0
  → Booking proceeds with default pricing


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                        PRICING ALGORITHM                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Input: booked_seats, total_seats
Output: multiplier ∈ [1.0, 1.5]

┌─────────────────────────────────────────────────────────────┐
│  occupancy = booked_seats / total_seats                     │
│                                                              │
│  if occupancy < 0.3:                                        │
│      multiplier = 1.0    ← Low demand                       │
│                                                              │
│  else if occupancy < 0.7:                                   │
│      multiplier = 1.2    ← Medium demand (+20%)             │
│                                                              │
│  else:                                                      │
│      multiplier = 1.5    ← High demand (+50%)               │
│                                                              │
│  return round(multiplier, 2)                                │
└─────────────────────────────────────────────────────────────┘

Examples:
  15/100 seats (15%) → 1.0× → $100 stays $100
  45/100 seats (45%) → 1.2× → $100 becomes $120
  85/100 seats (85%) → 1.5× → $100 becomes $150


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                      DATABASE SCHEMA                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

pricing_multipliers
┌────────────┬──────────────┬──────────────────────┐
│  show_id   │  multiplier  │    generated_at      │
│  (BIGINT)  │  (NUM 3,2)   │    (TIMESTAMP)       │
├────────────┼──────────────┼──────────────────────┤
│      1     │     1.00     │  2026-01-11 10:30:00 │
│      2     │     1.20     │  2026-01-11 10:30:00 │
│      3     │     1.50     │  2026-01-11 10:30:00 │
└────────────┴──────────────┴──────────────────────┘
     PK           CHECK            indexed
            [1.0, 1.5]


seats (modified)
┌────────┬─────────┬──────────────┬──────────┬────────────┐
│   id   │ show_id │ seat_number  │  status  │ base_price │
├────────┼─────────┼──────────────┼──────────┼────────────┤
│    1   │    1    │     A1       │ AVAILABLE│   100.00   │
│    2   │    1    │     A2       │ BOOKED   │   100.00   │
│    3   │    2    │     B1       │ AVAILABLE│   150.00   │ ← Premium seat
└────────┴─────────┴──────────────┴──────────┴────────────┘
                                              (NEW COLUMN)


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                      KEY BENEFITS                                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

✅  ZERO booking latency impact
    → Pricing computed offline, read during booking

✅  Graceful degradation
    → Defaults to 1.0 if pricing unavailable

✅  Deterministic & explainable
    → Same occupancy always gives same price

✅  PostgreSQL-only for pricing
    → No Redis dependency

✅  Bounded pricing
    → Never exceeds 1.5× base price

✅  Production-ready
    → Comprehensive tests & documentation

✅  Scalable
    → Batch processing handles large show inventories

✅  Observable
    → Clear logging and monitoring queries
```
