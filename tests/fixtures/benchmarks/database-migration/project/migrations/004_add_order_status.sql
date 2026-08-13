-- add order status
ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
