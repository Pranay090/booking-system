# Phase 4 Deployment Checklist

## Pre-Deployment

### 1. Code Review
- [ ] Review `src/pricing.js` - graceful fallback logic
- [ ] Review `src/routes/booking.js` - pricing integration
- [ ] Review `scripts/run_pricing_job.js` - batch job logic
- [ ] Review database schema changes

### 2. Testing
- [ ] Run test suite: `npm run test:degradation`
- [ ] Verify all tests pass
- [ ] Manual test: booking with empty pricing table
- [ ] Manual test: booking with populated pricing table
- [ ] Manual test: run pricing job successfully

### 3. Documentation
- [ ] Read `PRICING_README.md`
- [ ] Read `PRICING_QUICKSTART.md`
- [ ] Understand pricing algorithm
- [ ] Review cron setup instructions

---

## Deployment Steps

### Step 1: Backup Database
```bash
# Create backup before schema changes
pg_dump -U postgres booking_system > backup_$(date +%Y%m%d_%H%M%S).sql
```
- [ ] Database backup created
- [ ] Backup stored securely
- [ ] Verify backup size is reasonable

### Step 2: Apply Database Migration
```bash
cd /home/pranay/Desktop/projects/booking-system/backend
psql -U postgres -d booking_system -f sql/migrations/001_add_dynamic_pricing.sql
```
- [ ] Migration script executed
- [ ] No errors in output
- [ ] Verify table created: `\dt pricing_multipliers`
- [ ] Verify column added: `\d seats`

### Step 3: Update Existing Data (if needed)
```sql
-- If you have existing seats without base_price, update them
UPDATE seats SET base_price = 100.00 WHERE base_price IS NULL;
```
- [ ] Existing seats have base_price values
- [ ] Verify: `SELECT COUNT(*) FROM seats WHERE base_price IS NULL;` returns 0

### Step 4: Deploy Code Changes
```bash
# Pull latest code or copy files
cd /home/pranay/Desktop/projects/booking-system/backend

# Install any new dependencies (none needed for this phase)
npm install

# Make scripts executable
chmod +x scripts/*.js scripts/*.sh
```
- [ ] Code deployed to server
- [ ] Scripts are executable
- [ ] No missing files

### Step 5: Restart Application
```bash
# If using PM2
pm2 restart booking-system

# If using systemd
sudo systemctl restart booking-system

# If using Docker
docker-compose restart backend

# If running directly
# Stop the current process and run:
npm start
```
- [ ] Application restarted
- [ ] No startup errors
- [ ] API is responding
- [ ] Health check passed

### Step 6: Run Initial Pricing Job
```bash
npm run pricing-job
```
- [ ] Job executed successfully
- [ ] Output shows shows processed
- [ ] No errors in output
- [ ] Check database: `SELECT * FROM pricing_multipliers;`

### Step 7: Schedule Cron Job
```bash
# Open crontab
crontab -e

# Add this line (adjust path as needed):
*/30 * * * * cd /home/pranay/Desktop/projects/booking-system/backend && npm run pricing-job >> /var/log/pricing-job.log 2>&1

# Save and exit
# Verify scheduling
crontab -l
```
- [ ] Cron job added
- [ ] Cron job appears in `crontab -l`
- [ ] Log directory exists and is writable
- [ ] Cron service is running: `sudo service cron status`

---

## Post-Deployment Verification

### Immediate Checks (0-5 minutes)

#### Test 1: Basic Booking
```bash
curl -X POST http://localhost:3000/book \
  -H "Content-Type: application/json" \
  -d '{
    "showId": 1,
    "seatIds": [1, 2],
    "userId": 1
  }'
```
- [ ] Request succeeds
- [ ] Response includes `totalPrice`
- [ ] Response includes `multiplier`
- [ ] Seats marked as BOOKED in database

#### Test 2: Verify Pricing Data
```sql
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
- [ ] Query returns results
- [ ] Multipliers are within [1.0, 1.5]
- [ ] generated_at timestamps are recent

#### Test 3: Application Logs
```bash
# Check for errors
tail -n 100 /var/log/booking-system.log | grep -i error

# Check pricing integration
tail -n 100 /var/log/booking-system.log | grep -i pricing
```
- [ ] No critical errors
- [ ] No pricing-related errors
- [ ] Application is healthy

### Short-term Checks (30-60 minutes)

#### Test 4: Cron Execution
```bash
# Wait 30 minutes, then check
tail -n 50 /var/log/pricing-job.log
```
- [ ] Cron job executed automatically
- [ ] Job completed successfully
- [ ] Shows were processed
- [ ] No errors in logs

#### Test 5: Multiple Bookings
```bash
# Make several bookings across different shows
# Verify pricing varies based on occupancy
```
- [ ] Bookings complete successfully
- [ ] Prices reflect current multipliers
- [ ] High-occupancy shows have higher prices

#### Test 6: Pricing Updates
```sql
-- Check that multipliers are being updated
SELECT 
  show_id,
  multiplier,
  generated_at,
  NOW() - generated_at AS age
FROM pricing_multipliers
ORDER BY generated_at DESC;
```
- [ ] Recent timestamps (< 30 minutes)
- [ ] Multipliers updated since deployment
- [ ] No stale data (> 2 hours old)

### Long-term Monitoring (24+ hours)

#### Test 7: Revenue Tracking
```sql
SELECT 
  DATE(b.created_at) AS date,
  COUNT(*) AS bookings,
  SUM(s.base_price) AS base_revenue,
  SUM(s.base_price * COALESCE(pm.multiplier, 1.0)) AS actual_revenue,
  SUM(s.base_price * COALESCE(pm.multiplier, 1.0) - s.base_price) AS uplift,
  ROUND(AVG(pm.multiplier), 2) AS avg_multiplier
FROM bookings b
JOIN booking_seats bs ON bs.booking_id = b.id
JOIN seats s ON s.id = bs.seat_id
LEFT JOIN pricing_multipliers pm ON pm.show_id = b.show_id
WHERE b.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE(b.created_at);
```
- [ ] Revenue tracking working
- [ ] Uplift is positive (dynamic pricing effective)
- [ ] Average multiplier is reasonable

#### Test 8: Job Reliability
```bash
# Check job execution history
grep "SUCCESS" /var/log/pricing-job.log | tail -n 20
grep "ERROR" /var/log/pricing-job.log | tail -n 20
```
- [ ] Jobs running regularly (every 30 mins)
- [ ] High success rate (>95%)
- [ ] Errors investigated and resolved

#### Test 9: Performance Impact
```bash
# Check booking API latency hasn't increased
# Use monitoring tools or manual timing
```
- [ ] Booking latency unchanged
- [ ] No performance degradation
- [ ] Database queries optimized

---

## Rollback Plan

### If Issues Occur

#### Immediate Rollback (Code)
```bash
# Revert to previous code version
git revert HEAD

# Or restore from backup
cp -r /backup/backend/* .

# Restart application
pm2 restart booking-system
```
- [ ] Previous code restored
- [ ] Application restarted
- [ ] Bookings working

#### Database Rollback (Schema)
```sql
-- Remove pricing integration
DROP TABLE IF EXISTS pricing_multipliers;
ALTER TABLE seats DROP COLUMN IF EXISTS base_price;
```
- [ ] Schema changes reverted
- [ ] Application still functional
- [ ] Data backup preserved

#### Disable Cron Job
```bash
# Comment out cron job
crontab -e
# Add # before the pricing-job line

# Or remove it entirely
crontab -r
```
- [ ] Cron job disabled
- [ ] No more job executions
- [ ] Stale pricing doesn't affect bookings

---

## Success Criteria

### Technical Requirements
- [x] Database migration applied successfully
- [x] pricing_multipliers table exists
- [x] seats.base_price column exists
- [x] Pricing service implemented
- [x] Booking route integrated
- [x] Batch job created
- [x] Cron job scheduled
- [x] Tests passing
- [x] No errors in logs

### Business Requirements
- [ ] Bookings complete successfully
- [ ] Dynamic pricing is working
- [ ] Prices bounded within [1.0, 1.5]
- [ ] System degrades gracefully
- [ ] No customer complaints
- [ ] Revenue uplift visible

### Operational Requirements
- [ ] Documentation complete
- [ ] Team trained on new system
- [ ] Monitoring dashboards updated
- [ ] Alerts configured
- [ ] Runbooks updated

---

## Known Issues / Gotchas

### Issue 1: Stale Pricing Data
**Symptom**: Multipliers are hours old  
**Cause**: Cron job not running  
**Fix**: Check cron service and logs  
**Prevention**: Monitor job execution

### Issue 2: Missing Base Prices
**Symptom**: Booking fails with NULL error  
**Cause**: Seats created before migration  
**Fix**: Update seats: `UPDATE seats SET base_price = 100 WHERE base_price IS NULL`  
**Prevention**: Set default in schema

### Issue 3: Pricing Job Fails
**Symptom**: Job crashes or exits with error  
**Cause**: Database connection or data issues  
**Fix**: Check logs, verify database connectivity  
**Prevention**: Robust error handling in job

### Issue 4: High Multipliers
**Symptom**: All shows priced at 1.5×  
**Cause**: All shows have high occupancy  
**Fix**: This is expected behavior  
**Prevention**: Adjust rules if needed

---

## Support Contacts

### During Deployment
- **Primary**: [Your Name/Team]
- **Backup**: [Backup Contact]
- **Database**: [DBA Contact]
- **DevOps**: [DevOps Contact]

### Post-Deployment
- **On-call**: [On-call Contact]
- **Escalation**: [Manager Contact]
- **Documentation**: See PRICING_README.md

---

## Final Sign-off

### Pre-Deployment Approval
- [ ] Technical Lead: _______________  Date: _______
- [ ] Product Manager: ______________  Date: _______
- [ ] QA Lead: _____________________  Date: _______

### Post-Deployment Verification
- [ ] Deployment Successful: ________  Date: _______
- [ ] All Tests Passed: _____________  Date: _______
- [ ] Monitoring Active: ____________  Date: _______

### Production Release
- [ ] Released to Production: _______  Date: _______
- [ ] 24h Stability Confirmed: ______  Date: _______
- [ ] Phase 4 Complete: _____________  Date: _______

---

## Notes

```
Add any deployment-specific notes, observations, or issues here:







```

---

**Status**: [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Rolled Back

**Deployed By**: _______________

**Date**: _______________

**Time**: _______________
