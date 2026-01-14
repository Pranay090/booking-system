CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE shows (
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(id),
  show_time TIMESTAMP NOT NULL
);

CREATE TABLE seats (
  id SERIAL PRIMARY KEY,
  show_id INT REFERENCES shows(id),
  seat_number TEXT NOT NULL,
  status TEXT CHECK (status IN ('AVAILABLE','BOOKED')),
  base_price NUMERIC(10,2) NOT NULL,
  least_selling_price NUMERIC(10,2) NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT NOW(),
  credits NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  show_id INT REFERENCES shows(id),
  user_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE booking_seats (
  booking_id INT REFERENCES bookings(id),
  seat_id INT REFERENCES seats(id),
  price NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (booking_id, seat_id)
);
