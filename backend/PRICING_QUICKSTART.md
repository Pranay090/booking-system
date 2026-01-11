# Dynamic Pricing - Quick Reference

## 🚀 Quick Start

### 1. Apply Database Migration
```bash
psql -U postgres -d booking_system -f sql/migrations/001_add_dynamic_pricing.sql
```

### 2. Run Pricing Job (First Time)
```bash
npm run pricing-job
```

### 3. Test Graceful Degradation
```bash
npm run test:degradation
```

### 4. Schedule with Cron
```bash
crontab -e
# Add: */30 * * * * cd /path/to/backend && npm run pricing-job >> /var/log/pricing-job.log 2>&1
```

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `npm run pricing-job` | Run pricing job manually |
| `npm run test:degradation` | Test graceful degradation |
| `tail -f /var/log/pricing-job.log` | View job logs |
| `crontab -l` | List scheduled jobs |

---

## 🔍 Database Queries

### Check Current Pricing
```sql
SELECT 
  pm.show_id,
  pm.multiplier,
  pm.generated_at,
  s.show_time,
  COUNT(seats.id) AS total_seats,
  COUNT(CASE WHEN seats.status = 'BOOKED' THEN 1 END) AS booked_seats
FROM pricing_multipliers pm
JOIN shows s ON s.id = pm.show_id
LEFT JOIN seats ON seats.show_id = pm.show_id
GROUP BY pm.show_id, pm.multiplier, pm.generated_at, s.show_time
ORDER BY s.show_time;
```

### Revenue Analysis
```sql
SELECT 
  b.show_id,
  COUNT(*) AS bookings,
  SUM(seats.base_price) AS base_revenue,
  SUM(seats.base_price * COALESCE(pm.multiplier, 1.0)) AS actual_revenue,
  SUM(seats.base_price * COALESCE(pm.multiplier, 1.0)) - SUM(seats.base_price) AS uplift
FROM bookings b
JOIN booking_seats bs ON bs.booking_id = b.id
JOIN seats ON seats.id = bs.seat_id
LEFT JOIN pricing_multipliers pm ON pm.show_id = b.show_id
GROUP BY b.show_id;
```

### Clear All Pricing (Reset)
```sql
DELETE FROM pricing_multipliers;
```

---

## 🎯 Pricing Rules

| Occupancy | Multiplier | Description |
|-----------|------------|-------------|
| < 30% | 1.0× | Low demand - base price |
| 30-69% | 1.2× | Medium demand - 20% increase |
| ≥ 70% | 1.5× | High demand - 50% increase |

---

## ✅ Validation Checklist

- [ ] Database migration applied
- [ ] Pricing job runs successfully
- [ ] Multipliers within [1.0, 1.5] range
- [ ] Bookings work with empty pricing table
- [ ] Bookings work with populated pricing table
- [ ] Cron job scheduled (if using)
- [ ] Logs are being written
- [ ] No Redis dependency in pricing
- [ ] PostgreSQL has all pricing data

---

## 🐛 Troubleshooting

### Pricing Always 1.0
**Cause**: Pricing job not run or failed  
**Fix**: Run `npm run pricing-job` and check logs

### Job Fails with Database Error
**Cause**: Connection issues or missing tables  
**Fix**: Verify connection and run migration

### Bookings Fail
**Cause**: Unrelated to pricing (pricing never blocks)  
**Fix**: Check booking logic, locks, seat availability

### Cron Not Running
**Cause**: Cron service not active or wrong path  
**Fix**: `sudo service cron status` and verify paths

---

## 📊 Expected Output

### Pricing Job Success
```
[START] Pricing job started at 2026-01-11T10:30:00.000Z
[INFO] Found 5 future shows
[UPDATE] Show 1: 15/100 seats (15.0%) → multiplier 1.0x, 24h to show
[UPDATE] Show 2: 45/100 seats (45.0%) → multiplier 1.2x, 48h to show
[UPDATE] Show 3: 85/100 seats (85.0%) → multiplier 1.5x, 72h to show
[SUCCESS] Pricing job completed in 245ms
  - Updated: 3 shows
  - Skipped: 0 shows
```

### Booking Response
```json
{
  "bookingId": 42,
  "totalPrice": 240.00,
  "multiplier": 1.2
}
```

---

## 🎓 Learn More

See `PRICING_README.md` for comprehensive documentation including:
- Architecture details
- Monitoring strategies
- Future enhancements
- ML integration path
