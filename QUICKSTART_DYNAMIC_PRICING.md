# Quick Start Guide - Dynamic Pricing

## What Changed

Dynamic pricing is now active! Prices automatically adjust based on:
- **60%** - How many seats are booked
- **10%** - How many users are currently booking (active locks)
- **30%** - Recent booking velocity (last 30 min vs last 24 hours)

## Running the System

### Option 1: Docker Compose (Recommended)
```bash
docker-compose up -d
```

This starts:
- Frontend (port 80)
- API (port 3000)
- **Pricing Worker** (background service)
- PostgreSQL (port 5432)
- Redis (port 6379)

### Option 2: Local Development
```bash
# Terminal 1: Start API
cd backend
npm start

# Terminal 2: Start Pricing Worker
cd backend
npm run worker

# Terminal 3: Start Frontend (if needed)
cd frontend
npm start
```

### Development with Auto-Reload
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:worker
```

## Monitoring

### Check Worker Logs
```bash
# Docker
docker-compose logs -f pricing-worker

# Local
# Watch Terminal 2 output
```

### Expected Output (every 30 seconds)
```
[2026-01-19T10:30:00.000Z] Running pricing update worker...
  Processing 3 show(s)...
  ✓ Show 1: multiplier = 0.8500x
  ✓ Show 2: multiplier = 1.2300x
  ✓ Show 3: multiplier = 1.3000x (MAX)
[2026-01-19T10:30:01.200Z] Pricing update completed
```

## Testing Dynamic Pricing

### 1. Check Current Prices
```bash
# Get seats for show ID 1
curl http://localhost:3000/shows/1/seats
```

Response includes dynamic pricing:
```json
{
  "id": 1,
  "seat_number": "A1",
  "status": "AVAILABLE",
  "base_price": 100.00,
  "least_selling_price": 80.00,
  "current_price": 115.50,  // ← Dynamic price!
  "multiplier": 1.155        // ← Current multiplier
}
```

### 2. Make Bookings
```bash
curl -X POST http://localhost:3000/book \
  -H "Content-Type: application/json" \
  -d '{
    "showId": 1,
    "seatIds": [1, 2],
    "userId": 1
  }'
```

### 3. Watch Prices Change
- Make multiple bookings
- Wait 30 seconds for worker to run
- Check prices again - they should increase!

## How Prices Work

### Price Calculation
```
finalPrice = max(basePrice × multiplier, leastSellingPrice)
```

### Multiplier Range
- **Minimum**: No minimum (but price never goes below LSP)
- **Maximum**: 1.3× (30% increase)
- **Fallback**: 1.0× if pricing data unavailable

### Examples
| Base | LSP | Multiplier | Final Price |
|------|-----|-----------|-------------|
| $100 | $80 | 0.5x | $80 (LSP floor) |
| $100 | $80 | 0.8x | $80 (LSP floor) |
| $100 | $80 | 1.0x | $100 |
| $100 | $80 | 1.15x | $115 |
| $100 | $80 | 1.3x | $130 (max) |

## Troubleshooting

### Prices Not Changing?
1. Check worker is running: `docker-compose ps pricing-worker`
2. Check worker logs: `docker-compose logs pricing-worker`
3. Verify Redis is running: `docker-compose ps redis`
4. Wait 30 seconds for next update cycle

### Worker Not Starting?
```bash
# Check Redis connection
docker-compose logs redis

# Check database connection
docker-compose logs postgres

# Restart worker
docker-compose restart pricing-worker
```

### Prices Stuck at Base Price?
- This is normal if demand is very low
- Try making several bookings to increase demand
- Check multiplier in API response (should be > 0)

### Redis Connection Issues?
```bash
# Check Redis is accessible
docker-compose exec api redis-cli -h redis ping
# Should return: PONG

# Check Redis keys
docker-compose exec redis redis-cli keys "demand:*"
docker-compose exec redis redis-cli keys "pricing:*"
```

## Key Redis Commands (Debugging)

```bash
# Enter Redis CLI
docker-compose exec redis redis-cli

# Check demand data for show 1
GET demand:show:1:booked
ZRANGE demand:show:1:booking_times 0 -1 WITHSCORES

# Check pricing snapshot for show 1
GET pricing:show:1

# Check active locks
KEYS lock:show:1:seat:*

# Clear all demand data (reset)
DEL demand:show:1:booked
DEL demand:show:1:booking_times
DEL pricing:show:1
```

## Stopping the System

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (full reset)
docker-compose down -v
```

## Next Steps

1. Review `DYNAMIC_PRICING.md` for detailed architecture
2. Monitor pricing worker logs during peak hours
3. Analyze pricing trends and adjust weights if needed
4. Consider implementing admin overrides for special events

## Support

Check logs for any errors:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f pricing-worker
docker-compose logs -f api
```
