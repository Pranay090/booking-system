const { createClient } = require('redis');

const client = createClient({
    socket: {
        host: process.env.REDIS_HOST,
        port: 6379,
    },
});

client.on('connect', () => {
    console.log('Redis connected');
});

client.on('error', (err) => {
    console.error('Redis error', err);
});

(async () => {
    await client.connect();
})();

module.exports = client;
