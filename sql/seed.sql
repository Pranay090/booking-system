INSERT INTO events (name)
VALUES ('Rock Concert');

INSERT INTO shows (event_id, show_time)
VALUES (1, '2026-01-10 19:00:00');

-- Seats A1 to A20
INSERT INTO seats (show_id, seat_number, status)
SELECT 1, 'A' || generate_series(1,20), 'AVAILABLE';
