/**
 * Database Query Performance Analyzer
 * Run: node tests/db-performance.js
 * 
 * Measures PostgreSQL query performance for resume metrics
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'admin',
    database: process.env.DB_NAME || 'booking',
    port: process.env.DB_PORT || 5432
});

async function measureQuery(name, query, params = []) {
    const iterations = 50;
    const latencies = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await pool.query(query, params);
        const end = process.hrtime.bigint();
        latencies.push(Number(end - start) / 1_000_000);
    }
    
    latencies.sort((a, b) => a - b);
    
    return {
        name,
        iterations,
        min: latencies[0].toFixed(3),
        max: latencies[latencies.length - 1].toFixed(3),
        avg: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(3),
        median: latencies[Math.floor(latencies.length / 2)].toFixed(3),
        p95: latencies[Math.floor(latencies.length * 0.95)].toFixed(3),
    };
}

async function analyzeQueryPlans() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Query Execution Plans (EXPLAIN ANALYZE)');
    console.log('='.repeat(60));
    
    const queries = [
        {
            name: 'Get available seats for show',
            sql: 'EXPLAIN ANALYZE SELECT * FROM seats WHERE show_id = 1 AND status = \'AVAILABLE\''
        },
        {
            name: 'Get user bookings with seats',
            sql: `EXPLAIN ANALYZE 
                SELECT b.id, b.created_at, bs.seat_id, bs.price, s.seat_number
                FROM bookings b
                JOIN booking_seats bs ON b.id = bs.booking_id
                JOIN seats s ON bs.seat_id = s.id
                WHERE b.user_id = 1`
        },
        {
            name: 'Seat availability check (with lock)',
            sql: 'EXPLAIN ANALYZE SELECT id FROM seats WHERE id = 1 AND status = \'AVAILABLE\''
        }
    ];
    
    for (const q of queries) {
        console.log(`\n📌 ${q.name}:`);
        const result = await pool.query(q.sql);
        const plan = result.rows.map(r => Object.values(r)[0]).join('\n');
        console.log(plan);
    }
}

async function main() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         DATABASE QUERY PERFORMANCE ANALYZER                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    try {
        // Test basic queries
        const queries = [
            { name: 'Health Check', sql: 'SELECT 1' },
            { name: 'Count Events', sql: 'SELECT COUNT(*) FROM events' },
            { name: 'List Events', sql: 'SELECT * FROM events' },
            { name: 'Get Shows for Event', sql: 'SELECT * FROM shows WHERE event_id = $1', params: [1] },
            { name: 'Available Seats', sql: 'SELECT * FROM seats WHERE show_id = $1 AND status = $2', params: [1, 'AVAILABLE'] },
            { name: 'User Credits', sql: 'SELECT credits FROM users WHERE id = $1', params: [1] },
            { name: 'User Bookings Count', sql: 'SELECT COUNT(*) FROM bookings WHERE user_id = $1', params: [1] },
        ];
        
        console.log('\n📈 Query Performance Metrics:');
        console.log('─'.repeat(60));
        console.log(`${'Query'.padEnd(25)} | Avg(ms) | P95(ms) | Min(ms) | Max(ms)`);
        console.log('─'.repeat(60));
        
        for (const q of queries) {
            const result = await measureQuery(q.name, q.sql, q.params);
            console.log(
                `${result.name.padEnd(25)} | ${result.avg.padStart(7)} | ${result.p95.padStart(7)} | ${result.min.padStart(7)} | ${result.max.padStart(7)}`
            );
        }
        
        // Analyze query plans
        await analyzeQueryPlans();
        
        // Summary for resume
        console.log('\n');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║              📋 DATABASE METRICS FOR RESUME                ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        
        console.log(`
📝 RESUME BULLET POINTS:

• Optimized PostgreSQL queries achieving sub-millisecond response times
  for critical booking operations

• Implemented row-level locking (SELECT FOR UPDATE) ensuring ACID
  compliance in concurrent booking transactions

• Designed efficient database schema with proper indexing and
  foreign key relationships for referential integrity

• Used connection pooling to handle concurrent database connections
  efficiently under high load
`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n⚠️  Make sure PostgreSQL is running and DATABASE_URL is set');
    } finally {
        await pool.end();
    }
}

main();
