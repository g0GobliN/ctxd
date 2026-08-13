-- create orders
ALTER TABLE orders ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
