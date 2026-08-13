-- add product price
ALTER TABLE products ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0;
