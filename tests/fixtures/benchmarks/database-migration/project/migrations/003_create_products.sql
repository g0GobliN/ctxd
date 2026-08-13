-- create products
ALTER TABLE products ADD COLUMN sku TEXT NOT NULL UNIQUE;
