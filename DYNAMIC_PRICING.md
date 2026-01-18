# Dynamic Pricing Implementation

## Overview

Dynamic pricing is implemented asynchronously using demand signals stored in Redis, without affecting the booking path performance. The system calculates price multipliers based on real-time demand and applies them during booking while ensuring prices never go below the Least Selling Price (LSP).

## Architecture

### Components

1. **Demand Tracker** (`services/demand-tracker.js`)
   - Tracks booking completions in Redis
   - Monitors active seat locks (TTL-based)
   - Calculates booking velocity using sliding windows

2. **Pricing Engine** (`services/pricing-engine.js`)
   - Computes price multipliers based on demand
   - Stores pricing snapshots in Redis (30s TTL)
   - Applies multipliers during booking with LSP floor constraint

3. **Background Worker** (`pricing-worker.js`)
   - Separate Node.js service
   - Runs every 30 seconds
   - Updates pricing snapshots for all active shows

4. **Booking Integration** (`routes/booking.js`)
   - Reads latest pricing snapshot during booking
   - Freezes price inside PostgreSQL transaction
   - Tracks demand after successful booking

## Demand Metrics

The system tracks three key metrics to determine demand:

### 1. Seats Booked (60% weight)
- Total seats booked for the show
- Stored in Redis: `demand:show:{showId}:booked`
- Percentage calculated against total seats

### 2. Active Seat Locks (10% weight)
- Current number of active locks (users in booking flow)
- Keys: `lock:show:{showId}:seat:{seatId}`
- TTL: 300 seconds (5 minutes)
- Counted dynamically using Redis KEYS pattern

### 3. Booking Velocity (30% weight)
- **Recent**: Last 30 minutes booking rate (seats/minute)
- **Baseline**: Last 24 hours booking rate (seats/minute)
- **Ratio**: recent / baseline (normalized to 0-1 range)
- Stored as sorted set: `demand:show:{showId}:booking_times`

## Pricing Formula

```javascript
// 1. Calculate demand factors (0-1 range)
bookedPercentage = seatsBooked / totalSeats
locksPercentage = activeLocks / totalSeats
velocityRatio = min(recentRate / baselineRate, 2.0) / 2.0

// 2. Weighted demand score
demandScore = (bookedPercentage * 0.60) + 
              (locksPercentage * 0.10) + 
              (velocityRatio * 0.30)

// 3. Calculate multiplier (0 to 1.3x)
multiplier = demandScore * 1.3

// 4. Apply to price with LSP floor
finalPrice = max(basePrice * multiplier, leastSellingPrice)
```

### Multiplier Bounds
- **Minimum**: No hard minimum (can go to 0), but LSP acts as price floor
- **Maximum**: 1.3x base price
- **Fallback**: 1.0x (base price) if pricing data unavailable

## Data Flow

### 1. Booking Completion
```
User completes booking
  ↓
Transaction commits
  ↓
DemandTracker.trackBooking(showId, seatCount)
  ↓
Redis: Increment booked count
Redis: Add timestamp to velocity sorted set
```

### 2. Price Calculation (Background)
```
Every 30 seconds:
  ↓
Get all active shows
  ↓
For each show:
  - Calculate multiplier from demand
  - Store in Redis with 30s TTL
  - Log result
  - Cleanup old data
```

### 3. Booking Price Application
```
User initiates booking
  ↓
Get seats from DB (base_price, LSP)
  ↓
PricingEngine.getPricesForSeats(showId, seats)
  ↓
Read pricing snapshot from Redis
  ↓
Apply multiplier with LSP floor
  ↓
Use in transaction (price frozen)
```

## Redis Keys

| Key Pattern | Type | Purpose | TTL |
|------------|------|---------|-----|
| `demand:show:{showId}:booked` | String | Total seats booked count | None |
| `demand:show:{showId}:booking_times` | Sorted Set | Timestamp + seat count for velocity | 2 days |
| `lock:show:{showId}:seat:{seatId}` | String | Active seat lock | 300s |
| `pricing:show:{showId}` | String (JSON) | Pricing snapshot | 30s |

## API Changes

### GET `/shows/:showId/seats`
**Before:**
```json
{
  "id": 1,
  "seat_number": "A1",
  "status": "AVAILABLE",
  "base_price": 100.00,
  "least_selling_price": 80.00
}
```

**After:**
```json
{
  "id": 1,
  "seat_number": "A1",
  "status": "AVAILABLE",
  "base_price": 100.00,
  "least_selling_price": 80.00,
  "current_price": 115.50,
  "multiplier": 1.155
}
```

### POST `/book`
- Now uses `current_price` (dynamically calculated) instead of `base_price`
- Price is frozen at transaction start
- No change to request/response format

## Deployment

### Running Locally

```bash
# Start main API
npm start

# Start pricing worker (separate terminal)
npm run worker

# Development mode with auto-reload
npm run dev
npm run dev:worker
```

### Docker Compose

The pricing worker runs as a separate service:

```yaml
services:
  api:
    # Main API server
    
  pricing-worker:
    # Background pricing worker
    command: npm run worker
    restart: unless-stopped
```

Start all services:
```bash
docker-compose up -d
```

View worker logs:
```bash
docker-compose logs -f pricing-worker
```

## Monitoring

### Worker Logs
The pricing worker logs every execution:

```
[2026-01-19T10:30:00.000Z] Running pricing update worker...
  Processing 5 show(s)...
  ✓ Show 1: multiplier = 0.8500x
  ✓ Show 2: multiplier = 1.2300x
  ✓ Show 3: multiplier = 0.0000x
  ✓ Show 4: multiplier = 1.3000x
  ✓ Show 5: multiplier = 1.0500x
[2026-01-19T10:30:01.500Z] Pricing update completed
```

### Failure Handling

**Pricing data unavailable:**
- Falls back to base price (multiplier = 1.0)
- Error logged but booking continues
- No impact on booking latency

**Worker failure:**
- Existing pricing snapshots continue serving for 30s
- After TTL expires, system falls back to base prices
- Worker auto-restarts (Docker: `restart: unless-stopped`)

## Performance Characteristics

- **Booking latency**: Unaffected (single Redis GET for snapshot)
- **Worker execution**: ~100-500ms per show depending on seat count
- **Redis operations**: O(log n) for sorted sets, O(1) for other operations
- **Memory usage**: Minimal (timestamps only, auto-cleanup after 2 days)

## Example Scenarios

### Low Demand
- 10% booked, 2% locked, velocity ratio 0.5
- Demand score: (0.1 × 0.6) + (0.02 × 0.1) + (0.25 × 0.3) = 0.137
- Multiplier: 0.137 × 1.3 = 0.178
- Price: max(100 × 0.178, 80) = **80.00** (LSP floor)

### Medium Demand
- 50% booked, 5% locked, velocity ratio 1.0
- Demand score: (0.5 × 0.6) + (0.05 × 0.1) + (0.5 × 0.3) = 0.455
- Multiplier: 0.455 × 1.3 = 0.592
- Price: max(100 × 0.592, 80) = **80.00** (LSP floor)

### High Demand
- 85% booked, 8% locked, velocity ratio 1.5
- Demand score: (0.85 × 0.6) + (0.08 × 0.1) + (0.75 × 0.3) = 0.743
- Multiplier: 0.743 × 1.3 = 0.966
- Price: max(100 × 0.966, 80) = **96.60**

### Peak Demand
- 95% booked, 10% locked, velocity ratio 2.0
- Demand score: (0.95 × 0.6) + (0.1 × 0.1) + (1.0 × 0.3) = 0.880
- Multiplier: 0.880 × 1.3 = 1.144
- Price: max(100 × 1.144, 80) = **114.40**

### Maximum Multiplier
- 100% booked would give demand score ≈ 1.0
- Multiplier: 1.0 × 1.3 = 1.3
- Price: max(100 × 1.3, 80) = **130.00** (max 30% increase)

## Future Enhancements

1. **Per-section pricing**: Apply different multipliers based on seat sections
2. **Time-decay**: Reduce prices as show time approaches (last-minute deals)
3. **Event popularity**: Factor in historical event demand
4. **A/B testing**: Experiment with different formulas
5. **Admin overrides**: Manual price controls for special events
6. **Analytics dashboard**: Visualize pricing trends and revenue impact
