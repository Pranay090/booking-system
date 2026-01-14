-- Clean up existing data
TRUNCATE TABLE booking_seats, bookings, seats, shows, events, users RESTART IDENTITY CASCADE;

-- Insert Events
INSERT INTO users (email, password_hash, role) VALUES 
('admin@example.com', '$2b$10$qezJfSkDdhx5iRE8ATwXBudmOZrszOvnMfuG/V/odc59q9/KyxeZK', 'admin'),
('user@example.com', '$2b$10$qezJfSkDdhx5iRE8ATwXBudmOZrszOvnMfuG/V/odc59q9/KyxeZK', 'user');

INSERT INTO events (name) VALUES 
('Rock Concert'),  -- ID 1
('Pop Festival'),  -- ID 2
('Jazz Night');    -- ID 3

-- Insert Shows
-- Event 1: Rock Concert
INSERT INTO shows (event_id, show_time) VALUES 
(1, '2026-02-01 19:00:00'), -- Show 1
(1, '2026-02-02 19:00:00'); -- Show 2

-- Event 2: Pop Festival
INSERT INTO shows (event_id, show_time) VALUES 
(2, '2026-02-14 18:00:00'); -- Show 3

-- Event 3: Jazz Night
INSERT INTO shows (event_id, show_time) VALUES 
(3, '2026-02-20 20:00:00'); -- Show 4

-- Insert Seats for Show 1 (Rock Concert, Day 1)
-- Rows A-E, Seats 1-10 (50 seats)
INSERT INTO seats (show_id, seat_number, status, base_price, least_selling_price)
SELECT 1, chr(row) || num, 'AVAILABLE', 100.00, 80.00
FROM generate_series(65, 69) AS row, generate_series(1, 10) AS num;

-- Insert Seats for Show 2 (Rock Concert, Day 2)
INSERT INTO seats (show_id, seat_number, status, base_price, least_selling_price)
SELECT 2, chr(row) || num, 'AVAILABLE', 100.00, 80.00
FROM generate_series(65, 69) AS row, generate_series(1, 10) AS num;

-- Insert Seats for Show 3 (Pop Festival)
INSERT INTO seats (show_id, seat_number, status, base_price, least_selling_price)
SELECT 3, chr(row) || num, 'AVAILABLE', 150.00, 120.00
FROM generate_series(65, 69) AS row, generate_series(1, 10) AS num;

-- Insert Seats for Show 4 (Jazz Night)
INSERT INTO seats (show_id, seat_number, status, base_price, least_selling_price)
SELECT 4, chr(row) || num, 'AVAILABLE', 80.00, 60.00
FROM generate_series(65, 69) AS row, generate_series(1, 10) AS num;

-- Randomly book some seats to simulate usage
-- Booking a few seats for Show 1
UPDATE seats SET status = 'BOOKED' 
WHERE show_id = 1 AND seat_number IN ('A1', 'A2', 'B5', 'C8');

-- Booking a few seats for Show 3
UPDATE seats SET status = 'BOOKED' 
WHERE show_id = 3 AND seat_number IN ('A1', 'D4', 'E9', 'E10');
