# Phase 4: Offline Dynamic Pricing

## Overview

This implementation provides **offline, deterministic, and explainable** dynamic pricing using a batch job that computes price multipliers based on historical demand.

## Key Features

✅ **Offline Processing**: ML/pricing logic runs independently, NOT in booking request path  
✅ **Graceful Degradation**: Booking works even if pricing table is empty or job crashes  
✅ **Deterministic**: Rule-based algorithm with clear, explainable logic  
✅ **Non-blocking**: Zero impact on booking latency  
✅ **Bounded**: Multipliers clamped between 1.0× and 1.5×  
✅ **PostgreSQL-based**: No Redis dependency for pricing  

---

## Architecture

### Database Schema

```sql
CREATE TABLE pricing_multipliers (
  show_id BIGINT PRIMARY KEY REFERENCES shows(id),
  multiplier NUMERIC(3,2) NOT NULL,
  generated_at TIMESTAMP NOT NULL
);

ALTER TABLE seats ADD COLUMN base_price NUMERIC(10,2) NOT NULL DEFAULT 100.00;
```

### Components

1. **Pricing Service** (`src/pricing.js`)
   - Retrieves multipliers from database
   - Returns 1.0 as default (graceful fallback)
   - Never throws errors

2. **Booking Integration** (`src/routes/booking.js`)
   - Fetches multiplier during transaction
   - Calculates: `finalPrice = basePrice × multiplier`
   - Works even if pricing table is empty

3. **Offline Job** (`scripts/run_pricing_job.js`)
   - Runs independently of API servers
   - Computes multipliers for all future shows
   - Idempotent and safe to re-run

---

## Pricing Algorithm

### Rule-Based Logic

```javascript
occupancy = booked_seats / total_seats

if (occupancy < 0.3):
    multiplier = 1.0   // Low demand
else if (occupancy < 0.7):
    multiplier = 1.2   // Medium demand
else:
    multiplier = 1.5   // High demand
```

### Constraints

- **Min**: 1.0 (no discounts)
- **Max**: 1.5 (50% maximum increase)
- **Precision**: 2 decimal places
- **Scope**: Only future shows

---

## Usage

### Running the Pricing Job

#### Manual Execution
```bash
npm run pricing-job
```

#### Via Cron (every 30 minutes)
```bash
*/30 * * * * cd /home/pranay/Desktop/projects/booking-system/backend && npm run pricing-job >> /var/log/pricing-job.log 2>&1
```

#### With Environment Variables
```bash
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_DB=booking_system \
POSTGRES_USER=postgres \
POSTGRES_PASSWORD=postgres \
npm run pricing-job
```

### Job Output

```
[START] Pricing job started at 2026-01-11T10:30:00.000Z
[INFO] Found 5 future shows
[UPDATE] Show 1: 15/100 seats (15.0% occupancy) → multiplier 1.0x, 24h to show
[UPDATE] Show 2: 45/100 seats (45.0% occupancy) → multiplier 1.2x, 48h to show
[UPDATE] Show 3: 85/100 seats (85.0% occupancy) → multiplier 1.5x, 72h to show
[SKIP] Show 4: No seats defined
[SUCCESS] Pricing job completed in 245ms
  - Updated: 4 shows
  - Skipped: 1 shows
[EXIT] Pricing job finished successfully
```

---

## API Changes

### Booking Response (Enhanced)

**Endpoint**: `POST /book`

**Request**:
```json
{
  "showId": 1,
  "seatIds": [10, 11],
  "userId": 5
}
```

**Response** (with pricing):
```json
{
  "bookingId": 42,
  "totalPrice": 240.00,
  "multiplier": 1.2
}
```

### Pricing Calculation

```javascript
// Each seat has a base_price (e.g., $100)
// Multiplier is fetched from pricing_multipliers table
// If no multiplier exists, defaults to 1.0

Seat 1: $100 × 1.2 = $120
Seat 2: $100 × 1.2 = $120
Total: $240
```

---

## Graceful Degradation

### Scenario 1: Pricing Table Empty

```sql
SELECT * FROM pricing_multipliers;
-- (no rows)
```

**Result**: Booking succeeds with multiplier = 1.0 (no price change)

### Scenario 2: Pricing Job Fails

```bash
npm run pricing-job
# Job crashes or database error
```

**Result**: Booking continues using last computed multipliers (or 1.0 if never run)

### Scenario 3: Pricing Query Error

```javascript
// Database connection fails during getMultiplier()
```

**Result**: Function catches error, logs warning, returns 1.0

---

## Testing

### 1. Test Default Pricing (No Multipliers)
```bash
# Start server without running pricing job
npm start

# Make booking - should succeed with multiplier 1.0
curl -X POST http://localhost:3000/book \
  -H "Content-Type: application/json" \
  -d '{"showId": 1, "seatIds": [1, 2], "userId": 1}'
```

### 2. Test With Pricing Job
```bash
# Run pricing job
npm run pricing-job

# Make booking - should use computed multiplier
curl -X POST http://localhost:3000/book \
  -H "Content-Type: application/json" \
  -d '{"showId": 1, "seatIds": [3, 4], "userId": 1}'
```

### 3. Test Pricing Updates
```bash
# Book more seats to increase occupancy
# Run pricing job again
npm run pricing-job

# Multiplier should increase based on new occupancy
```

### 4. Verify Database State
```sql
-- Check current pricing
SELECT 
  pm.show_id,
  pm.multiplier,
  pm.generated_at,
  COUNT(s.id) AS total_seats,
  COUNT(CASE WHEN s.status = 'BOOKED' THEN 1 END) AS booked_seats
FROM pricing_multipliers pm
JOIN shows sh ON sh.id = pm.show_id
LEFT JOIN seats s ON s.show_id = sh.id
GROUP BY pm.show_id, pm.multiplier, pm.generated_at;
```

---

## Monitoring

### Key Metrics to Track

1. **Job Execution**
   - Success rate
   - Execution duration
   - Number of shows processed

2. **Pricing Distribution**
   ```sql
   SELECT 
     multiplier,
     COUNT(*) AS show_count
   FROM pricing_multipliers
   GROUP BY multiplier
   ORDER BY multiplier;
   ```

3. **Revenue Impact**
   ```sql
   SELECT 
     DATE(b.created_at) AS date,
     SUM(s.base_price) AS base_revenue,
     SUM(s.base_price * COALESCE(pm.multiplier, 1.0)) AS actual_revenue
   FROM bookings b
   JOIN booking_seats bs ON bs.booking_id = b.id
   JOIN seats s ON s.id = bs.seat_id
   LEFT JOIN pricing_multipliers pm ON pm.show_id = b.show_id
   GROUP BY DATE(b.created_at);
   ```

---

## Future Enhancements

### Phase 5: Machine Learning (Optional)

Replace rule-based logic with ML model:

```javascript
// Instead of: calculateMultiplier(bookedSeats, totalSeats)
// Use: predictMultiplier(features)

const features = {
  occupancy: bookedSeats / totalSeats,
  hours_to_show: hoursToShow,
  day_of_week: dayOfWeek,
  historical_demand: getHistoricalDemand(eventId)
};

const multiplier = mlModel.predict(features);
```

**Requirements**:
- Model training pipeline (offline)
- Feature engineering
- Model versioning
- A/B testing framework
- Explainability tools (SHAP, LIME)

### Phase 6: Time-Based Adjustments

```javascript
// Increase urgency as show approaches
if (hoursToShow < 24) {
  multiplier *= 1.1; // 10% urgency boost
}
```

### Phase 7: Event-Type Segmentation

```javascript
// Different pricing for different event types
const baseMultiplier = getEventTypeMultiplier(eventType);
const demandMultiplier = calculateMultiplier(bookedSeats, totalSeats);
const finalMultiplier = baseMultiplier * demandMultiplier;
```

---

## Constraints Verification

✅ **ML/pricing NOT in booking path**: Job runs separately  
✅ **Booking works without pricing**: Defaults to 1.0  
✅ **Booking works if job crashes**: Uses last values or 1.0  
✅ **PostgreSQL is source of truth**: All data in postgres  
✅ **Redis NOT required**: Pricing uses only postgres  
✅ **Prices bounded**: Clamped 1.0 - 1.5  
✅ **Offline execution**: Job is independent  
✅ **Deterministic**: Rule-based, no randomness  
✅ **Explainable**: Clear occupancy thresholds  
✅ **Non-blocking**: Zero booking latency impact  

---

## Troubleshooting

### Job Not Updating Prices

1. Check job logs
2. Verify database connectivity
3. Ensure future shows exist
4. Check seat data is populated

### Pricing Always 1.0

1. Verify pricing job has been run
2. Check `pricing_multipliers` table
3. Ensure show_id matches in booking request

### Unexpected Multipliers

1. Review occupancy calculation
2. Check seat status in database
3. Verify rule logic in `calculateMultiplier()`

---

## Summary

This implementation provides a **production-ready, offline dynamic pricing system** that:

- Runs independently without blocking bookings
- Degrades gracefully when pricing data is unavailable
- Uses simple, explainable rules (no black-box ML)
- Maintains PostgreSQL as single source of truth
- Scales efficiently with batch processing
- Provides clear visibility into pricing decisions

The system is ready for production deployment and can be extended with ML models in future phases while maintaining the same architecture.
