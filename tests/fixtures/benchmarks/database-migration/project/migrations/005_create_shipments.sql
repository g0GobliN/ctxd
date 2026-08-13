-- create shipments
ALTER TABLE shipments ADD COLUMN order_id TEXT NOT NULL REFERENCES orders(id);
