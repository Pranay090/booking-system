# Performance Testing Guide

## Quick Start

```bash
# Start your services first
docker compose up postgres redis -d
npm start &
npm run worker &

# Run performance tests
node tests/performance-test.js
node tests/db-performance.js
node tests/redis-performance.js
```

## Available Tests

### 1. API Performance Test (`tests/performance-test.js`)
- Measures API response times under concurrent load
- Tests race condition prevention
- Generates resume-ready metrics

### 2. Database Performance Test (`tests/db-performance.js`)
- Analyzes PostgreSQL query performance
- Shows EXPLAIN ANALYZE plans
- Measures query latencies

### 3. Redis Performance Test (`tests/redis-performance.js`)
- Tests distributed locking performance
- Measures caching throughput
- Analyzes demand tracking latency

### 4. Load Test with Artillery (`tests/load-test.yml`)
```bash
npm install -g artillery
artillery run tests/load-test.yml
artillery run tests/load-test.yml --output report.json
artillery report report.json
```

## Metrics You Can Quantify

| Metric | Test | Resume Example |
|--------|------|----------------|
| API Response Time | performance-test.js | "Achieved <50ms avg response time" |
| Throughput | performance-test.js | "Handled 1000+ requests/second" |
| Race Condition Prevention | performance-test.js | "Zero double-bookings under concurrent load" |
| Query Performance | db-performance.js | "Sub-millisecond database queries" |
| Lock Acquisition Time | redis-performance.js | "5ms distributed lock acquisition" |
| Cache Throughput | redis-performance.js | "10000+ cache reads/second" |

## Additional Tools

### Using autocannon for quick benchmarks:
```bash
npm install -g autocannon

# Quick health check benchmark
autocannon -c 100 -d 30 http://localhost:3000/health

# Test events endpoint
autocannon -c 50 -d 30 http://localhost:3000/api/events
```

### Using wrk for HTTP benchmarking:
```bash
# Install wrk
sudo apt install wrk

# Run benchmark
wrk -t12 -c400 -d30s http://localhost:3000/health
```
